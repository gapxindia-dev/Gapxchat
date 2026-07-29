import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../database/db.js';
import { RoomRecord } from '../database/types.js';
import {
  generateToken,
  authenticateJWT,
  requireRoomOwner,
  AuthenticatedRequest,
  joinRoomRateLimiter,
  uploadRateLimiter
} from '../middleware/security.js';

const router = Router();

// Configure local uploads folder
const UPLOADS_DIR = path.join(process.cwd(), 'server', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Disk Storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Save with unique name but preserve extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

// Configure file filters
const allowedMimeTypes = [
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime',
  'audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/m4a', 'audio/aac', 'audio/x-m4a',
  'application/pdf', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/zip', 'application/x-zip-compressed'
];

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max size
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype) || file.originalname.match(/\.(png|jpg|jpeg|webp|gif|mp4|mov|webm|wav|mp3|ogg|m4a|aac|pdf|txt|docx|zip)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only standard images, videos, audio/voice notes, PDF, docx, txt, and ZIP files are allowed.'));
    }
  },
});

// Generate random room code helper
function generateRoomCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters like I, O, 0, 1
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ----------------------------------------------------
// Room Endpoints
// ----------------------------------------------------

/**
 * GET: Verify if room exists and checks password status
 */
router.post('/rooms/verify', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: 'Room code is required' });
    return;
  }

  try {
    const room = await db.rooms.get(code);
    if (!room) {
      res.status(404).json({ exists: false, error: 'Room not found' });
      return;
    }

    res.json({
      exists: true,
      code: room.code,
      name: room.name,
      requiresPassword: !!room.password,
    });
  } catch (err) {
    console.error('Verify room error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

/**
 * POST: Create a new room
 */
router.post('/rooms/create', async (req, res) => {
  const { roomName, password, ownerUsername, autoDeleteHours } = req.body;

  if (!roomName || !ownerUsername) {
    res.status(400).json({ error: 'Room name and owner username are required' });
    return;
  }

  try {
    // Generate unique room code and check duplicates
    let roomCode = generateRoomCode();
    let attempts = 0;
    while (await db.rooms.get(roomCode) && attempts < 10) {
      roomCode = generateRoomCode();
      attempts++;
    }

    let hashedPassword = undefined;
    if (password && password.trim() !== '') {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const room: RoomRecord = {
      code: roomCode,
      name: roomName.trim(),
      password: hashedPassword,
      owner: ownerUsername.trim(),
      createdAt: new Date().toISOString(),
      autoDeleteHours: Number(autoDeleteHours) || 24,
      lastActiveAt: new Date().toISOString(),
      activeVoiceChannel: false,
    };

    // Save to Database
    await db.rooms.create(room);

    // Save/create owner user record
    await db.users.save(ownerUsername, {
      joinedRooms: [roomCode],
      activeStatus: 'online',
      lastSeen: new Date().toISOString(),
    });

    // Generate JWT token bound to this room session
    const token = generateToken(ownerUsername, roomCode);

    res.status(201).json({
      message: 'Room created successfully',
      room: {
        code: roomCode,
        name: room.name,
        owner: room.owner,
        createdAt: room.createdAt,
        autoDeleteHours: room.autoDeleteHours,
        requiresPassword: !!room.password,
      },
      token,
      username: ownerUsername,
    });
  } catch (err) {
    console.error('Room creation failed:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * POST: Join a room (Verify password if needed, issue session token)
 */
router.post('/rooms/join', joinRoomRateLimiter, async (req, res) => {
  const { code, password, username } = req.body;

  if (!code || !username) {
    res.status(400).json({ error: 'Room code and username are required' });
    return;
  }

  const cleanCode = code.toUpperCase().trim();
  const cleanUsername = username.trim();

  try {
    const room = await db.rooms.get(cleanCode);
    if (!room) {
      res.status(404).json({ error: 'Room not found. Check the code.' });
      return;
    }

    // Check if room requires password
    if (room.password) {
      if (!password) {
        res.status(401).json({ error: 'Room password is required' });
        return;
      }
      const match = await bcrypt.compare(password, room.password);
      if (!match) {
        res.status(401).json({ error: 'Incorrect room password.' });
        return;
      }
    }

    // Check if username is already taken by an ACTIVE user in the room
    const existingUser = await db.users.get(cleanUsername);
    if (existingUser && existingUser.activeStatus !== 'offline') {
      // If user has been seen in the last 1 minute, prevent taking their name
      const lastSeenDiff = Date.now() - new Date(existingUser.lastSeen).getTime();
      if (lastSeenDiff < 60 * 1000) {
        res.status(409).json({ error: 'Username is currently active in this room. Please choose another.' });
        return;
      }
    }

    // Save/Update user joined rooms list
    const joinedRooms = existingUser ? [...existingUser.joinedRooms] : [];
    if (!joinedRooms.includes(cleanCode)) {
      joinedRooms.push(cleanCode);
    }

    await db.users.save(cleanUsername, {
      joinedRooms,
      activeStatus: 'online',
      lastSeen: new Date().toISOString(),
    });

    // Create session JWT token
    const token = generateToken(cleanUsername, cleanCode);

    res.json({
      message: 'Joined room successfully',
      room: {
        code: room.code,
        name: room.name,
        owner: room.owner,
        createdAt: room.createdAt,
        autoDeleteHours: room.autoDeleteHours,
        requiresPassword: !!room.password,
      },
      token,
      username: cleanUsername,
    });
  } catch (err) {
    console.error('Join room failed:', err);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// ----------------------------------------------------
// Authenticated Room Operations
// ----------------------------------------------------

/**
 * GET: Fetch room messages (paginated chat history)
 */
router.get('/rooms/:roomCode/messages', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const { roomCode } = req.params;
  const { limit, before } = req.query;

  if (req.user?.roomCode !== (roomCode as string).toUpperCase()) {
    res.status(403).json({ error: 'Forbidden: You do not have access to this room.' });
    return;
  }

  try {
    const msgLimit = limit ? Math.min(Number(limit), 100) : 50;
    const beforeTime = before ? (before as string) : undefined;

    const messages = await db.messages.getByRoom(roomCode as string, msgLimit, beforeTime);
    res.json(messages);
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * PUT: Update room settings (Requires Room Owner)
 */
router.put('/rooms/:roomCode/settings', authenticateJWT, requireRoomOwner(db), async (req: AuthenticatedRequest, res) => {
  const { roomCode } = req.params;
  const { name, password, autoDeleteHours } = req.body;

  try {
    const updateData: Partial<RoomRecord> = {};
    if (name) updateData.name = name.trim();
    if (autoDeleteHours) updateData.autoDeleteHours = Number(autoDeleteHours);

    if (password !== undefined) {
      if (password.trim() === '') {
        updateData.password = undefined; // clear password
      } else {
        updateData.password = await bcrypt.hash(password, 10);
      }
    }

    const updated = await db.rooms.update(roomCode as string, updateData);
    res.json({
      message: 'Room settings updated successfully',
      room: {
        code: updated.code,
        name: updated.name,
        owner: updated.owner,
        autoDeleteHours: updated.autoDeleteHours,
        requiresPassword: !!updated.password,
      },
    });
  } catch (err) {
    console.error('Update room settings error:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ----------------------------------------------------
// File Upload Endpoint
// ----------------------------------------------------

/**
 * POST: Upload a file attachment (Supports dragging, copy-paste, images, videos, zip, pdf, docx)
 */
router.post('/uploads', authenticateJWT, uploadRateLimiter, (req: AuthenticatedRequest, res: Response) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Generate attachment URL
    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      message: 'File uploaded successfully',
      file: {
        name: req.file.originalname,
        url: fileUrl,
        size: req.file.size,
        type: req.file.mimetype,
      },
    });
  });
});

export default router;
