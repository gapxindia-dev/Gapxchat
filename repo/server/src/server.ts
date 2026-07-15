import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { connectDb, db } from './database/db.js';
import { setupHelmet, setupCors, apiRateLimiter } from './middleware/security.js';
import apiRouter from './routes/api.js';
import { setupSocketHandlers } from './socket/socketHandler.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Handled securely via custom middleware or allowed origins
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e8, // Allow up to 100MB socket payloads (e.g. buffering chunks if needed)
});

const PORT = process.env.PORT || 5000;

// Serve uploads folder as static files
const UPLOADS_DIR = path.join(process.cwd(), 'server', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Standard security middlewares
app.use(setupHelmet());
app.use(setupCors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply global API rate limiting
app.use('/api', apiRateLimiter);

// Register API router
app.use('/api', apiRouter);

// Set up Socket.io connection events
setupSocketHandlers(io);

// Serve Frontend client in production mode
const CLIENT_BUILD_DIR = path.join(process.cwd(), 'dist');
if (fs.existsSync(CLIENT_BUILD_DIR)) {
  app.use(express.static(CLIENT_BUILD_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(CLIENT_BUILD_DIR, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('🏠 Real-Time Chat Server Running. Frontend client building or in dev mode.');
  });
}

// ----------------------------------------------------
// Auto-Delete Daemon for Inactive Rooms
// ----------------------------------------------------
/**
 * Scans the database and deletes rooms inactive beyond their autoDeleteHours threshold.
 */
async function runRoomCleanupDaemon() {
  console.log('🧹 Inactive Room Cleanup Daemon: Checking for idle rooms...');
  try {
    const rooms = await db.rooms.getAll();
    const now = Date.now();
    let cleanupCount = 0;

    for (const room of rooms) {
      const lastActiveTime = new Date(room.lastActiveAt).getTime();
      const inactivityThresholdMs = room.autoDeleteHours * 60 * 60 * 1000;

      if (now - lastActiveTime > inactivityThresholdMs) {
        console.log(`🗑️ Auto-Deleting room ${room.code} ("${room.name}") due to inactivity of ${room.autoDeleteHours} hours.`);
        
        // Delete room and messages (handled inside adapter deletion)
        await db.rooms.delete(room.code);
        cleanupCount++;
      }
    }

    if (cleanupCount > 0) {
      console.log(`🧹 Inactive Room Cleanup Daemon: Deleted ${cleanupCount} rooms.`);
    } else {
      console.log('🧹 Inactive Room Cleanup Daemon: No idle rooms to clean.');
    }
  } catch (err) {
    console.error('🧹 Inactive Room Cleanup Daemon Error:', err);
  }
}

// Run cleanup check immediately on start, and then every 30 minutes
setInterval(runRoomCleanupDaemon, 30 * 60 * 1000);

// Initialize DB and startup HTTP server
async function startServer() {
  await connectDb();

  // Run initial cleanup check once DB is loaded
  runRoomCleanupDaemon();

  httpServer.listen(PORT, () => {
    console.log('===========================================================');
    console.log(`🚀 Chat application server listening on PORT ${PORT}`);
    console.log(`👉 API Endpoint: http://localhost:${PORT}/api`);
    console.log('===========================================================');
  });
}

startServer().catch((err) => {
  console.error('Fatal Server Initialization Error:', err);
  process.exit(1);
});
