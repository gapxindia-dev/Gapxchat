import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { DatabaseAdapter, UserRecord, RoomRecord, MessageRecord } from './types.js';

// Determine save location for local JSON database
const JSON_DB_PATH = path.join(process.cwd(), 'server', 'database.json');

// Ensure server folder exists
const serverDir = path.dirname(JSON_DB_PATH);
if (!fs.existsSync(serverDir)) {
  fs.mkdirSync(serverDir, { recursive: true });
}

// ----------------------------------------------------
// Local JSON File Database Adapter Implementation
// ----------------------------------------------------
class JsonDbAdapter implements DatabaseAdapter {
  private data: {
    users: Record<string, UserRecord>;
    rooms: Record<string, RoomRecord>;
    messages: Record<string, MessageRecord>;
  } = { users: {}, rooms: {}, messages: {} };

  private isWriting = false;
  private writeQueue: (() => void)[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(JSON_DB_PATH)) {
        const fileContent = fs.readFileSync(JSON_DB_PATH, 'utf-8');
        this.data = JSON.parse(fileContent);
      } else {
        this.saveToFileSync();
      }
    } catch (err) {
      console.error('Failed to load JSON database, starting with empty data:', err);
      this.data = { users: {}, rooms: {}, messages: {} };
    }
  }

  private saveToFileSync() {
    try {
      fs.writeFileSync(JSON_DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write JSON database sync:', err);
    }
  }

  private async save(): Promise<void> {
    if (this.isWriting) {
      return new Promise<void>((resolve) => {
        this.writeQueue.push(resolve);
      });
    }

    this.isWriting = true;
    try {
      await fs.promises.writeFile(JSON_DB_PATH, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save JSON database asynchronously:', err);
    } finally {
      this.isWriting = false;
      const next = this.writeQueue.shift();
      if (next) {
        next();
        // Trigger next write in queue
        this.save();
      }
    }
  }

  users = {
    get: async (username: string): Promise<UserRecord | null> => {
      const user = this.data.users[username.toLowerCase()];
      return user ? { ...user } : null;
    },
    save: async (username: string, data: Partial<UserRecord>): Promise<UserRecord> => {
      const key = username.toLowerCase();
      const existing = this.data.users[key] || {
        username,
        joinedRooms: [],
        blockedUsers: [],
        activeStatus: 'online',
        lastSeen: new Date().toISOString(),
      };

      const updated = {
        ...existing,
        ...data,
        username: existing.username || username, // preserve original casing
      };

      this.data.users[key] = updated;
      await this.save();
      return { ...updated };
    },
    updateStatus: async (username: string, status: 'online' | 'idle' | 'offline'): Promise<UserRecord> => {
      return this.users.save(username, { activeStatus: status, lastSeen: new Date().toISOString() });
    },
    blockUser: async (username: string, blockUsername: string): Promise<UserRecord> => {
      const user = await this.users.get(username);
      if (!user) throw new Error('User not found');
      const blocked = new Set(user.blockedUsers);
      blocked.add(blockUsername.toLowerCase());
      return this.users.save(username, { blockedUsers: Array.from(blocked) });
    },
    unblockUser: async (username: string, unblockUsername: string): Promise<UserRecord> => {
      const user = await this.users.get(username);
      if (!user) throw new Error('User not found');
      const blocked = user.blockedUsers.filter(u => u !== unblockUsername.toLowerCase());
      return this.users.save(username, { blockedUsers: blocked });
    }
  };

  rooms = {
    create: async (room: RoomRecord): Promise<RoomRecord> => {
      this.data.rooms[room.code.toUpperCase()] = { ...room };
      await this.save();
      return { ...room };
    },
    get: async (code: string): Promise<RoomRecord | null> => {
      const room = this.data.rooms[code.toUpperCase()];
      return room ? { ...room } : null;
    },
    getAll: async (): Promise<RoomRecord[]> => {
      return Object.values(this.data.rooms).map(r => ({ ...r }));
    },
    update: async (code: string, data: Partial<RoomRecord>): Promise<RoomRecord> => {
      const key = code.toUpperCase();
      const existing = this.data.rooms[key];
      if (!existing) throw new Error('Room not found');

      const updated = { ...existing, ...data };
      this.data.rooms[key] = updated;
      await this.save();
      return { ...updated };
    },
    delete: async (code: string): Promise<boolean> => {
      const key = code.toUpperCase();
      if (this.data.rooms[key]) {
        delete this.data.rooms[key];
        // Clean up messages in room too
        Object.keys(this.data.messages).forEach(msgId => {
          if (this.data.messages[msgId].roomId === key) {
            delete this.data.messages[msgId];
          }
        });
        await this.save();
        return true;
      }
      return false;
    }
  };

  messages = {
    create: async (message: MessageRecord): Promise<MessageRecord> => {
      this.data.messages[message.id] = { ...message };
      await this.save();
      return { ...message };
    },
    get: async (id: string): Promise<MessageRecord | null> => {
      const msg = this.data.messages[id];
      return msg ? { ...msg } : null;
    },
    getByRoom: async (roomId: string, limit = 50, beforeTimestamp?: string): Promise<MessageRecord[]> => {
      const roomKey = roomId.toUpperCase();
      let roomMsgs = Object.values(this.data.messages).filter(m => m.roomId.toUpperCase() === roomKey);

      // Sort chronological
      roomMsgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (beforeTimestamp) {
        const timeCutoff = new Date(beforeTimestamp).getTime();
        roomMsgs = roomMsgs.filter(m => new Date(m.timestamp).getTime() < timeCutoff);
      }

      // Return last N messages (newest ones)
      return roomMsgs.slice(-limit);
    },
    update: async (id: string, data: Partial<MessageRecord>): Promise<MessageRecord> => {
      const existing = this.data.messages[id];
      if (!existing) throw new Error('Message not found');

      const updated = { ...existing, ...data };
      this.data.messages[id] = updated;
      await this.save();
      return { ...updated };
    },
    delete: async (id: string): Promise<boolean> => {
      if (this.data.messages[id]) {
        delete this.data.messages[id];
        await this.save();
        return true;
      }
      return false;
    },
    addReaction: async (id: string, username: string, emoji: string): Promise<MessageRecord> => {
      const msg = this.data.messages[id];
      if (!msg) throw new Error('Message not found');

      const reactions = [...msg.reactions];
      const existingReaction = reactions.find(r => r.emoji === emoji);

      if (existingReaction) {
        if (!existingReaction.users.includes(username)) {
          existingReaction.users.push(username);
        }
      } else {
        reactions.push({ emoji, users: [username] });
      }

      msg.reactions = reactions;
      await this.save();
      return { ...msg };
    },
    removeReaction: async (id: string, username: string, emoji: string): Promise<MessageRecord> => {
      const msg = this.data.messages[id];
      if (!msg) throw new Error('Message not found');

      let reactions = [...msg.reactions];
      const existingReaction = reactions.find(r => r.emoji === emoji);

      if (existingReaction) {
        existingReaction.users = existingReaction.users.filter(u => u !== username);
        if (existingReaction.users.length === 0) {
          reactions = reactions.filter(r => r.emoji !== emoji);
        }
      }

      msg.reactions = reactions;
      await this.save();
      return { ...msg };
    },
    markRead: async (roomId: string, username: string): Promise<void> => {
      const roomKey = roomId.toUpperCase();
      const now = new Date().toISOString();
      let changed = false;

      Object.values(this.data.messages).forEach(m => {
        if (m.roomId.toUpperCase() === roomKey && m.sender !== username) {
          const alreadyRead = m.readBy.some(r => r.username === username);
          if (!alreadyRead) {
            m.readBy.push({ username, readAt: now });
            changed = true;
          }
        }
      });

      if (changed) {
        await this.save();
      }
    }
  };
}

// ----------------------------------------------------
// MongoDB/Mongoose Schema Definitions
// ----------------------------------------------------
const MUserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  avatar: String,
  joinedRooms: [String],
  blockedUsers: [String],
  activeStatus: { type: String, enum: ['online', 'idle', 'offline'], default: 'online' },
  lastSeen: { type: Date, default: Date.now },
});

const MRoomSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String },
  owner: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  autoDeleteHours: { type: Number, default: 24 },
  lastActiveAt: { type: Date, default: Date.now },
  activeVoiceChannel: { type: Boolean, default: false },
});

const MMessageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  roomId: { type: String, required: true },
  sender: { type: String, required: true },
  content: String,
  type: { type: String, default: 'text' },
  attachmentUrl: String,
  attachmentName: String,
  attachmentSize: Number,
  replyTo: String,
  timestamp: { type: Date, default: Date.now },
  reactions: [{ emoji: String, users: [String] }],
  readBy: [{ username: String, readAt: Date }],
  edited: { type: Boolean, default: false },
  editHistory: [{ content: String, editedAt: Date }],
  pinned: { type: Boolean, default: false },
});

// Compile Models
const MUser = mongoose.model('User', MUserSchema);
const MRoom = mongoose.model('Room', MRoomSchema);
const MMessage = mongoose.model('Message', MMessageSchema);

// ----------------------------------------------------
// MongoDB/Mongoose Database Adapter Implementation
// ----------------------------------------------------
class MongoDbAdapter implements DatabaseAdapter {
  users = {
    get: async (username: string): Promise<UserRecord | null> => {
      const user = await MUser.findOne({ username: new RegExp(`^${username}$`, 'i') });
      if (!user) return null;
      return {
        username: user.username,
        avatar: user.avatar || undefined,
        joinedRooms: user.joinedRooms || [],
        blockedUsers: user.blockedUsers || [],
        activeStatus: user.activeStatus as 'online' | 'idle' | 'offline',
        lastSeen: user.lastSeen.toISOString(),
      };
    },
    save: async (username: string, data: Partial<UserRecord>): Promise<UserRecord> => {
      const updateData: any = { ...data };
      if (data.lastSeen) updateData.lastSeen = new Date(data.lastSeen);

      const user = await MUser.findOneAndUpdate(
        { username: new RegExp(`^${username}$`, 'i') },
        { $set: updateData },
        { new: true, upsert: true }
      );
      return {
        username: user.username,
        avatar: user.avatar || undefined,
        joinedRooms: user.joinedRooms || [],
        blockedUsers: user.blockedUsers || [],
        activeStatus: user.activeStatus as 'online' | 'idle' | 'offline',
        lastSeen: user.lastSeen.toISOString(),
      };
    },
    updateStatus: async (username: string, status: 'online' | 'idle' | 'offline'): Promise<UserRecord> => {
      return this.users.save(username, { activeStatus: status, lastSeen: new Date().toISOString() });
    },
    blockUser: async (username: string, blockUsername: string): Promise<UserRecord> => {
      const user = await MUser.findOneAndUpdate(
        { username: new RegExp(`^${username}$`, 'i') },
        { $addToSet: { blockedUsers: blockUsername.toLowerCase() } },
        { new: true }
      );
      if (!user) throw new Error('User not found');
      return {
        username: user.username,
        avatar: user.avatar || undefined,
        joinedRooms: user.joinedRooms || [],
        blockedUsers: user.blockedUsers || [],
        activeStatus: user.activeStatus as 'online' | 'idle' | 'offline',
        lastSeen: user.lastSeen.toISOString(),
      };
    },
    unblockUser: async (username: string, unblockUsername: string): Promise<UserRecord> => {
      const user = await MUser.findOneAndUpdate(
        { username: new RegExp(`^${username}$`, 'i') },
        { $pull: { blockedUsers: unblockUsername.toLowerCase() } },
        { new: true }
      );
      if (!user) throw new Error('User not found');
      return {
        username: user.username,
        avatar: user.avatar || undefined,
        joinedRooms: user.joinedRooms || [],
        blockedUsers: user.blockedUsers || [],
        activeStatus: user.activeStatus as 'online' | 'idle' | 'offline',
        lastSeen: user.lastSeen.toISOString(),
      };
    }
  };

  rooms = {
    create: async (room: RoomRecord): Promise<RoomRecord> => {
      const newRoom = new MRoom({
        ...room,
        createdAt: new Date(room.createdAt),
        lastActiveAt: new Date(room.lastActiveAt),
      });
      await newRoom.save();
      return room;
    },
    get: async (code: string): Promise<RoomRecord | null> => {
      const room = await MRoom.findOne({ code: code.toUpperCase() });
      if (!room) return null;
      return {
        code: room.code,
        name: room.name,
        password: room.password || undefined,
        owner: room.owner,
        createdAt: room.createdAt.toISOString(),
        autoDeleteHours: room.autoDeleteHours,
        lastActiveAt: room.lastActiveAt.toISOString(),
        activeVoiceChannel: room.activeVoiceChannel,
      };
    },
    getAll: async (): Promise<RoomRecord[]> => {
      const rooms = await MRoom.find({});
      return rooms.map(room => ({
        code: room.code,
        name: room.name,
        password: room.password || undefined,
        owner: room.owner,
        createdAt: room.createdAt.toISOString(),
        autoDeleteHours: room.autoDeleteHours,
        lastActiveAt: room.lastActiveAt.toISOString(),
        activeVoiceChannel: room.activeVoiceChannel,
      }));
    },
    update: async (code: string, data: Partial<RoomRecord>): Promise<RoomRecord> => {
      const updateData: any = { ...data };
      if (data.createdAt) updateData.createdAt = new Date(data.createdAt);
      if (data.lastActiveAt) updateData.lastActiveAt = new Date(data.lastActiveAt);

      const room = await MRoom.findOneAndUpdate(
        { code: code.toUpperCase() },
        { $set: updateData },
        { new: true }
      );
      if (!room) throw new Error('Room not found');
      return {
        code: room.code,
        name: room.name,
        password: room.password || undefined,
        owner: room.owner,
        createdAt: room.createdAt.toISOString(),
        autoDeleteHours: room.autoDeleteHours,
        lastActiveAt: room.lastActiveAt.toISOString(),
        activeVoiceChannel: room.activeVoiceChannel,
      };
    },
    delete: async (code: string): Promise<boolean> => {
      const result = await MRoom.deleteOne({ code: code.toUpperCase() });
      if (result.deletedCount && result.deletedCount > 0) {
        await MMessage.deleteMany({ roomId: code.toUpperCase() });
        return true;
      }
      return false;
    }
  };

  messages = {
    create: async (message: MessageRecord): Promise<MessageRecord> => {
      const newMsg = new MMessage({
        ...message,
        timestamp: new Date(message.timestamp),
        reactions: message.reactions,
        readBy: message.readBy.map(r => ({ username: r.username, readAt: new Date(r.readAt) })),
        editHistory: message.editHistory.map(h => ({ content: h.content, editedAt: new Date(h.editedAt) })),
      });
      await newMsg.save();
      return message;
    },
    get: async (id: string): Promise<MessageRecord | null> => {
      const msg = await MMessage.findOne({ id });
      if (!msg) return null;
      return this.mapMessage(msg);
    },
    getByRoom: async (roomId: string, limit = 50, beforeTimestamp?: string): Promise<MessageRecord[]> => {
      const query: any = { roomId: roomId.toUpperCase() };
      if (beforeTimestamp) {
        query.timestamp = { $lt: new Date(beforeTimestamp) };
      }
      const msgs = await MMessage.find(query)
        .sort({ timestamp: -1 })
        .limit(limit);

      // mongoose returns reverse order, so we reverse it to be chronological for display
      return msgs.reverse().map(this.mapMessage);
    },
    update: async (id: string, data: Partial<MessageRecord>): Promise<MessageRecord> => {
      const updateData: any = { ...data };
      if (data.timestamp) updateData.timestamp = new Date(data.timestamp);
      if (data.readBy) {
        updateData.readBy = data.readBy.map(r => ({ username: r.username, readAt: new Date(r.readAt) }));
      }
      if (data.editHistory) {
        updateData.editHistory = data.editHistory.map(h => ({ content: h.content, editedAt: new Date(h.editedAt) }));
      }

      const msg = await MMessage.findOneAndUpdate({ id }, { $set: updateData }, { new: true });
      if (!msg) throw new Error('Message not found');
      return this.mapMessage(msg);
    },
    delete: async (id: string): Promise<boolean> => {
      const result = await MMessage.deleteOne({ id });
      return !!(result.deletedCount && result.deletedCount > 0);
    },
    addReaction: async (id: string, username: string, emoji: string): Promise<MessageRecord> => {
      // Try adding to existing reaction
      const result = await MMessage.findOneAndUpdate(
        { id, 'reactions.emoji': emoji },
        { $addToSet: { 'reactions.$.users': username } },
        { new: true }
      );

      if (result) {
        return this.mapMessage(result);
      }

      // Create new reaction entry
      const updated = await MMessage.findOneAndUpdate(
        { id },
        { $push: { reactions: { emoji, users: [username] } } },
        { new: true }
      );
      if (!updated) throw new Error('Message not found');
      return this.mapMessage(updated);
    },
    removeReaction: async (id: string, username: string, emoji: string): Promise<MessageRecord> => {
      // Remove user from the reaction
      let msg = await MMessage.findOneAndUpdate(
        { id, 'reactions.emoji': emoji },
        { $pull: { 'reactions.$.users': username } },
        { new: true }
      );

      if (msg) {
        // Clean up any reaction collections that now have empty users lists
        msg = await MMessage.findOneAndUpdate(
          { id },
          { $pull: { reactions: { users: { $size: 0 } } } },
          { new: true }
        );
        return this.mapMessage(msg!);
      }

      const rawMsg = await MMessage.findOne({ id });
      if (!rawMsg) throw new Error('Message not found');
      return this.mapMessage(rawMsg);
    },
    markRead: async (roomId: string, username: string): Promise<void> => {
      const now = new Date();
      await MMessage.updateMany(
        {
          roomId: roomId.toUpperCase(),
          sender: { $ne: username },
          'readBy.username': { $ne: username }
        },
        {
          $push: { readBy: { username, readAt: now } }
        }
      );
    }
  };

  private mapMessage(msg: any): MessageRecord {
    return {
      id: msg.id,
      roomId: msg.roomId,
      sender: msg.sender,
      content: msg.content,
      type: msg.type as any,
      attachmentUrl: msg.attachmentUrl,
      attachmentName: msg.attachmentName,
      attachmentSize: msg.attachmentSize,
      replyTo: msg.replyTo,
      timestamp: msg.timestamp.toISOString(),
      reactions: msg.reactions.map((r: any) => ({
        emoji: r.emoji,
        users: r.users,
      })),
      readBy: msg.readBy.map((r: any) => ({
        username: r.username,
        readAt: r.readAt.toISOString(),
      })),
      edited: msg.edited || false,
      editHistory: msg.editHistory.map((h: any) => ({
        content: h.content,
        editedAt: h.editedAt.toISOString(),
      })),
      pinned: msg.pinned || false,
    };
  }
}

// ----------------------------------------------------
// Global Connection Handler & Adapter Selection
// ----------------------------------------------------
let db: DatabaseAdapter = new JsonDbAdapter(); // Default to JSON db
let isMongoConnected = false;

export async function connectDb(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.log('-----------------------------------------------------------');
    console.log('⚠️  MONGODB_URI is not set in environment variables.');
    console.log('👉 Falling back to local file database: "server/database.json"');
    console.log('-----------------------------------------------------------');
    db = new JsonDbAdapter();
    return;
  }

  try {
    console.log('🔄 Attempting connection to MongoDB...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // wait up to 5s before failing
    });
    isMongoConnected = true;
    db = new MongoDbAdapter();
    console.log('-----------------------------------------------------------');
    console.log('🚀 Connected to MongoDB successfully.');
    console.log('👉 Running in high-performance cloud database mode.');
    console.log('-----------------------------------------------------------');
  } catch (err) {
    console.error('-----------------------------------------------------------');
    console.error('❌ Failed to connect to MongoDB:', err instanceof Error ? err.message : err);
    console.error('👉 Falling back to local file database: "server/database.json"');
    console.error('-----------------------------------------------------------');
    db = new JsonDbAdapter();
  }
}

export { db, isMongoConnected };
