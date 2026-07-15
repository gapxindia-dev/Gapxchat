import { Server, Socket } from 'socket.io';
import { verifyToken } from '../middleware/security.js';
import { db } from '../database/db.js';
import { MessageRecord } from '../database/types.js';

// Keep track of active users in voice channels per room code
// RoomCode -> Set of Socket IDs
const voiceRooms: Record<string, Set<string>> = {};

// Keep track of socket mapping: socketId -> { username, roomCode }
const activeSockets: Record<string, { username: string; roomCode: string; status: string }> = {};

// Keep track of typing users per room
// RoomCode -> Record<Username, TimerRef>
const typingUsers: Record<string, Set<string>> = {};

export function setupSocketHandlers(io: Server) {
  // Socket.io JWT Authentication Middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Authentication error: Token not provided'));
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return next(new Error('Authentication error: Invalid token'));
    }

    // Attach data to socket object
    socket.data.username = decoded.username;
    socket.data.roomCode = decoded.roomCode.toUpperCase();
    next();
  });

  io.on('connection', async (socket: Socket) => {
    const username = socket.data.username;
    const roomCode = socket.data.roomCode;
    const socketId = socket.id;

    console.log(`🔌 Socket connected: ${username} joined room ${roomCode} (${socketId})`);

    // Track active socket info
    activeSockets[socketId] = { username, roomCode, status: 'online' };

    // Automatically join the Socket.io room channel
    socket.join(roomCode);

    // Save user record status as online
    try {
      await db.users.save(username, {
        activeStatus: 'online',
        lastSeen: new Date().toISOString(),
        joinedRooms: [roomCode], // simple tracker
      });

      // Fetch room details to check if it exists
      const room = await db.rooms.get(roomCode);
      if (room) {
        // Mark all messages in room as read by this user
        await db.messages.markRead(roomCode, username);
      }

      // Broadcast user connected / status change to the room
      io.to(roomCode).emit('user_status_changed', {
        username,
        status: 'online',
        lastSeen: new Date().toISOString(),
      });

      // Send current room members list to the joining user
      sendRoomMembersList(io, roomCode);
    } catch (err) {
      console.error('Error in socket connection setup:', err);
    }

    // ----------------------------------------------------
    // Typing Indicators
    // ----------------------------------------------------
    socket.on('typing_start', () => {
      if (!typingUsers[roomCode]) {
        typingUsers[roomCode] = new Set();
      }
      typingUsers[roomCode].add(username);
      socket.to(roomCode).emit('typing_update', Array.from(typingUsers[roomCode]));
    });

    socket.on('typing_stop', () => {
      if (typingUsers[roomCode]) {
        typingUsers[roomCode].delete(username);
        socket.to(roomCode).emit('typing_update', Array.from(typingUsers[roomCode]));
      }
    });

    // ----------------------------------------------------
    // Message Actions
    // ----------------------------------------------------
    // Send message
    socket.on('message_send', async (msgData: {
      content: string;
      type?: 'text' | 'image' | 'video' | 'file' | 'audio' | 'voice' | 'system';
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentSize?: number;
      replyTo?: string;
    }) => {
      try {
        const message: MessageRecord = {
          id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
          roomId: roomCode,
          sender: username,
          content: msgData.content,
          type: msgData.type || 'text',
          attachmentUrl: msgData.attachmentUrl,
          attachmentName: msgData.attachmentName,
          attachmentSize: msgData.attachmentSize,
          replyTo: msgData.replyTo,
          timestamp: new Date().toISOString(),
          reactions: [],
          readBy: [{ username, readAt: new Date().toISOString() }],
          edited: false,
          editHistory: [],
        };

        // Save message to database
        const savedMsg = await db.messages.create(message);

        // Update lastActiveAt for room to delay auto-delete
        await db.rooms.update(roomCode, { lastActiveAt: new Date().toISOString() });

        // Broadcast message to everyone in the room
        io.to(roomCode).emit('message_received', savedMsg);

        // Auto-mark read for other active sockets in room
        // and trigger read receipt event
        await markRoomMessagesReadExceptSender(io, roomCode, username);
      } catch (err) {
        console.error('Failed to process message_send:', err);
        socket.emit('error_message', { error: 'Failed to send message' });
      }
    });

    // Edit message
    socket.on('message_edit', async ({ messageId, newContent }: { messageId: string; newContent: string }) => {
      try {
        const msg = await db.messages.get(messageId);
        if (!msg) return;

        // Verify sender
        if (msg.sender.toLowerCase() !== username.toLowerCase()) {
          socket.emit('error_message', { error: 'Forbidden: You can only edit your own messages' });
          return;
        }

        const editHistory = [...msg.editHistory, { content: msg.content, editedAt: new Date().toISOString() }];
        const updatedMsg = await db.messages.update(messageId, {
          content: newContent,
          edited: true,
          editHistory,
        });

        io.to(roomCode).emit('message_updated', updatedMsg);
      } catch (err) {
        console.error('Failed to edit message:', err);
      }
    });

    // Delete message
    socket.on('message_delete', async ({ messageId }: { messageId: string }) => {
      try {
        const msg = await db.messages.get(messageId);
        if (!msg) return;

        // Verify sender or room owner
        const room = await db.rooms.get(roomCode);
        const isOwner = room?.owner.toLowerCase() === username.toLowerCase();
        const isSender = msg.sender.toLowerCase() === username.toLowerCase();

        if (!isSender && !isOwner) {
          socket.emit('error_message', { error: 'Forbidden: You cannot delete this message' });
          return;
        }

        await db.messages.delete(messageId);
        io.to(roomCode).emit('message_deleted', { messageId });
      } catch (err) {
        console.error('Failed to delete message:', err);
      }
    });

    // Pin/Unpin message
    socket.on('message_pin_toggle', async ({ messageId }: { messageId: string }) => {
      try {
        const msg = await db.messages.get(messageId);
        if (!msg) return;

        const isPinned = !msg.pinned;
        const updatedMsg = await db.messages.update(messageId, { pinned: isPinned });

        io.to(roomCode).emit('message_updated', updatedMsg);

        // System message logging the pin action
        const sysMsg: MessageRecord = {
          id: 'sys-' + Math.random().toString(36).substring(2, 9),
          roomId: roomCode,
          sender: 'System',
          content: `${username} ${isPinned ? 'pinned' : 'unpinned'} a message (id: ${messageId.substring(0, 5)}...)`,
          type: 'system',
          timestamp: new Date().toISOString(),
          reactions: [],
          readBy: [],
          edited: false,
          editHistory: [],
        };
        await db.messages.create(sysMsg);
        io.to(roomCode).emit('message_received', sysMsg);
      } catch (err) {
        console.error('Pin action failed:', err);
      }
    });

    // Add/Remove reactions
    socket.on('message_react', async ({ messageId, emoji, action }: { messageId: string; emoji: string; action: 'add' | 'remove' }) => {
      try {
        let updatedMsg: MessageRecord;
        if (action === 'add') {
          updatedMsg = await db.messages.addReaction(messageId, username, emoji);
        } else {
          updatedMsg = await db.messages.removeReaction(messageId, username, emoji);
        }
        io.to(roomCode).emit('message_updated', updatedMsg);
      } catch (err) {
        console.error('Reaction failed:', err);
      }
    });

    // Mark messages as read manually (e.g. when scroll to bottom or focus window)
    socket.on('mark_read', async () => {
      try {
        await db.messages.markRead(roomCode, username);
        // Inform others of updated read receipts
        const messages = await db.messages.getByRoom(roomCode, 100);
        io.to(roomCode).emit('read_receipts_updated', { username, roomId: roomCode, messages });
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
    });

    // User status update (e.g. going idle after browser tab inactivity)
    socket.on('status_update', async ({ status }: { status: 'online' | 'idle' }) => {
      try {
        if (activeSockets[socketId]) {
          activeSockets[socketId].status = status;
        }
        await db.users.save(username, { activeStatus: status, lastSeen: new Date().toISOString() });
        io.to(roomCode).emit('user_status_changed', {
          username,
          status,
          lastSeen: new Date().toISOString(),
        });
        sendRoomMembersList(io, roomCode);
      } catch (err) {
        console.error('Status update failed:', err);
      }
    });

    // ----------------------------------------------------
    // WebRTC Voice Chat Signaling (Full Mesh Routing)
    // ----------------------------------------------------
    // 1. User wants to join the voice channel
    socket.on('webrtc_join', () => {
      if (!voiceRooms[roomCode]) {
        voiceRooms[roomCode] = new Set();
      }

      // Tell existing participants in this room that a new user has joined
      const currentParticipants = Array.from(voiceRooms[roomCode]);
      
      // Add this user to voice roster
      voiceRooms[roomCode].add(socketId);
      
      console.log(`🔊 Voice join: ${username} (${socketId}) joined Voice Channel in room ${roomCode}`);

      // Send the newcomer a list of other participants' socketIds
      socket.emit('webrtc_participants_list', currentParticipants.map(sid => ({
        socketId: sid,
        username: activeSockets[sid]?.username || 'Unknown',
      })));

      // Notify other participants to initiate P2P peer connection with this newcomer
      socket.to(roomCode).emit('webrtc_user_joined', {
        socketId: socketId,
        username: username,
      });

      // Update room voice active status in db
      db.rooms.update(roomCode, { activeVoiceChannel: true }).catch(console.error);
    });

    // 2. Relay SDP offers/answers or ICE candidates between peers
    socket.on('webrtc_signal', ({ targetSocketId, signalData }: { targetSocketId: string; signalData: any }) => {
      io.to(targetSocketId).emit('webrtc_signal_received', {
        senderSocketId: socketId,
        username: username,
        signalData: signalData,
      });
    });

    // 3. User leaves the voice channel explicitly
    socket.on('webrtc_leave', () => {
      handleVoiceCleanup(socket);
    });

    // 4. Mute indicator toggle
    socket.on('voice_mute_toggle', ({ isMuted }: { isMuted: boolean }) => {
      socket.to(roomCode).emit('webrtc_user_mute_status', {
        socketId: socketId,
        username: username,
        isMuted,
      });
    });

    // 5. Speak indicator toggle (micro-animations on client)
    socket.on('voice_speaking', ({ isSpeaking }: { isSpeaking: boolean }) => {
      socket.to(roomCode).emit('webrtc_user_speaking', {
        socketId: socketId,
        isSpeaking,
      });
    });

    // ----------------------------------------------------
    // Admin Controls
    // ----------------------------------------------------
    socket.on('admin_kick_user', async ({ targetUsername }: { targetUsername: string }) => {
      try {
        const room = await db.rooms.get(roomCode);
        if (!room) return;

        // Check if current user is owner
        if (room.owner.toLowerCase() !== username.toLowerCase()) {
          socket.emit('error_message', { error: 'Admin action forbidden: Only room owner can kick users' });
          return;
        }

        if (targetUsername.toLowerCase() === username.toLowerCase()) {
          socket.emit('error_message', { error: 'Admin action forbidden: You cannot kick yourself' });
          return;
        }

        // Find targets sockets in room
        const roomSockets = await io.in(roomCode).fetchSockets();
        const targetSockets = roomSockets.filter(s => s.data.username?.toLowerCase() === targetUsername.toLowerCase());

        targetSockets.forEach(s => {
          s.emit('kicked_from_room', { roomCode, reason: 'You have been kicked by the room administrator.' });
          s.leave(roomCode);
          s.disconnect(true);
        });

        // Insert system message logging the kick
        const sysMsg: MessageRecord = {
          id: 'sys-' + Math.random().toString(36).substring(2, 9),
          roomId: roomCode,
          sender: 'System',
          content: `${targetUsername} has been kicked from the room by the administrator.`,
          type: 'system',
          timestamp: new Date().toISOString(),
          reactions: [],
          readBy: [],
          edited: false,
          editHistory: [],
        };
        await db.messages.create(sysMsg);
        io.to(roomCode).emit('message_received', sysMsg);

        // Update list
        sendRoomMembersList(io, roomCode);
      } catch (err) {
        console.error('Kick user error:', err);
      }
    });

    // ----------------------------------------------------
    // Disconnect Action
    // ----------------------------------------------------
    socket.on('disconnect', async () => {
      console.log(`🔌 Socket disconnected: ${username} left (${socketId})`);

      // 1. Cleanup typing indicator
      if (typingUsers[roomCode]) {
        typingUsers[roomCode].delete(username);
        socket.to(roomCode).emit('typing_update', Array.from(typingUsers[roomCode]));
      }

      // 2. Cleanup voice channels
      handleVoiceCleanup(socket);

      // 3. Remove tracker
      delete activeSockets[socketId];

      // 4. Update Database user status
      // We set status to offline and capture lastSeen timestamp
      try {
        const remainingSockets = Object.values(activeSockets).some(s => s.username.toLowerCase() === username.toLowerCase());
        if (!remainingSockets) {
          // If no other active tabs for this user, mark offline in DB
          const offlineTime = new Date().toISOString();
          await db.users.save(username, {
            activeStatus: 'offline',
            lastSeen: offlineTime,
          });

          // Broadcast offline status to room
          io.to(roomCode).emit('user_status_changed', {
            username,
            status: 'offline',
            lastSeen: offlineTime,
          });
        }

        // Update remaining members list
        sendRoomMembersList(io, roomCode);
      } catch (err) {
        console.error('Error on socket disconnect status update:', err);
      }
    });
  });
}

/**
 * Cleanup function when a user leaves the WebRTC voice channel
 */
function handleVoiceCleanup(socket: Socket) {
  const roomCode = socket.data.roomCode;
  const socketId = socket.id;

  if (voiceRooms[roomCode] && voiceRooms[roomCode].has(socketId)) {
    voiceRooms[roomCode].delete(socketId);
    console.log(`🔊 Voice leave: Socket ${socketId} left Voice Channel in room ${roomCode}`);

    // Notify other voice members that this user left
    socket.to(roomCode).emit('webrtc_user_left', {
      socketId: socketId,
      username: socket.data.username,
    });

    // If room voice is now empty, set voice status to inactive
    if (voiceRooms[roomCode].size === 0) {
      delete voiceRooms[roomCode];
      db.rooms.update(roomCode, { activeVoiceChannel: false }).catch(console.error);
    }
  }
}

/**
 * Calculates current room members list based on database and socket connections
 */
async function sendRoomMembersList(io: Server, roomCode: string) {
  try {
    // Get all sockets currently in this room to establish exact online/offline flags
    const roomSockets = await io.in(roomCode).fetchSockets();
    const activeUsernames = new Set(roomSockets.map(s => s.data.username?.toLowerCase()));

    // Get messages to list all unique senders (this constitutes the room participants list historically)
    const messages = await db.messages.getByRoom(roomCode, 200);
    const room = await db.rooms.get(roomCode);
    
    const usernames = new Set<string>();
    if (room) {
      usernames.add(room.owner);
    }
    messages.forEach(m => {
      if (m.sender !== 'System') {
        usernames.add(m.sender);
      }
    });

    // Retrieve active details for each member
    const membersData = await Promise.all(
      Array.from(usernames).map(async (uname) => {
        const u = await db.users.get(uname);
        const isSocketActive = activeUsernames.has(uname.toLowerCase());
        
        let status = 'offline';
        if (isSocketActive) {
          // Check if any tab is online vs idle
          const matchSockets = roomSockets.filter(s => s.data.username?.toLowerCase() === uname.toLowerCase());
          const isAnyOnline = matchSockets.some(s => {
            const entry = activeSockets[s.id];
            return entry?.status === 'online';
          });
          status = isAnyOnline ? 'online' : 'idle';
        }

        return {
          username: u?.username || uname,
          avatar: u?.avatar || '',
          status: status as 'online' | 'idle' | 'offline',
          lastSeen: u?.lastSeen || new Date().toISOString(),
          isOwner: room?.owner.toLowerCase() === uname.toLowerCase(),
        };
      })
    );

    // Broadcast members list back to room
    io.to(roomCode).emit('room_members_list', membersData);
  } catch (err) {
    console.error('Failed to emit room members list:', err);
  }
}

/**
 * Marks messages as read by a user and pushes the updated receipt count to the room
 */
async function markRoomMessagesReadExceptSender(io: Server, roomCode: string, senderUsername: string) {
  try {
    const roomSockets = await io.in(roomCode).fetchSockets();
    
    // Mark messages read for each user currently active in the room sockets
    for (const socket of roomSockets) {
      const u = socket.data.username;
      if (u && u.toLowerCase() !== senderUsername.toLowerCase()) {
        await db.messages.markRead(roomCode, u);
        
        // Notify others
        io.to(roomCode).emit('read_receipts_updated', {
          username: u,
          roomId: roomCode,
        });
      }
    }
  } catch (err) {
    console.error('Failed to mark messages read during broadcast:', err);
  }
}
