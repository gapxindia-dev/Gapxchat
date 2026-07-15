export interface UserRecord {
  username: string;
  avatar?: string;
  joinedRooms: string[];
  blockedUsers: string[];
  activeStatus: 'online' | 'idle' | 'offline';
  lastSeen: string; // ISO String
}

export interface Reaction {
  emoji: string;
  users: string[]; // array of usernames
}

export interface ReadReceipt {
  username: string;
  readAt: string; // ISO String
}

export interface EditHistoryEntry {
  content: string;
  editedAt: string; // ISO String
}

export interface MessageRecord {
  id: string;
  roomId: string;
  sender: string; // username
  content: string;
  type: 'text' | 'image' | 'video' | 'file' | 'audio' | 'voice' | 'system';
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  replyTo?: string; // messageId
  timestamp: string; // ISO String
  reactions: Reaction[];
  readBy: ReadReceipt[];
  edited: boolean;
  editHistory: EditHistoryEntry[];
  pinned?: boolean;
}

export interface RoomRecord {
  code: string; // unique short ID (e.g. A8XJQ2)
  name: string;
  password?: string; // hashed password if set
  owner: string; // creator's username
  createdAt: string; // ISO String
  autoDeleteHours: number; // default 24
  lastActiveAt: string; // ISO String for auto-deletion checks
  activeVoiceChannel: boolean;
}

export interface DatabaseAdapter {
  users: {
    get(username: string): Promise<UserRecord | null>;
    save(username: string, data: Partial<UserRecord>): Promise<UserRecord>;
    updateStatus(username: string, status: 'online' | 'idle' | 'offline'): Promise<UserRecord>;
    blockUser(username: string, blockUsername: string): Promise<UserRecord>;
    unblockUser(username: string, unblockUsername: string): Promise<UserRecord>;
  };
  rooms: {
    create(room: RoomRecord): Promise<RoomRecord>;
    get(code: string): Promise<RoomRecord | null>;
    getAll(): Promise<RoomRecord[]>;
    update(code: string, data: Partial<RoomRecord>): Promise<RoomRecord>;
    delete(code: string): Promise<boolean>;
  };
  messages: {
    create(message: MessageRecord): Promise<MessageRecord>;
    get(id: string): Promise<MessageRecord | null>;
    getByRoom(roomId: string, limit?: number, beforeTimestamp?: string): Promise<MessageRecord[]>;
    update(id: string, data: Partial<MessageRecord>): Promise<MessageRecord>;
    delete(id: string): Promise<boolean>;
    addReaction(id: string, username: string, emoji: string): Promise<MessageRecord>;
    removeReaction(id: string, username: string, emoji: string): Promise<MessageRecord>;
    markRead(roomId: string, username: string): Promise<void>;
  };
}
