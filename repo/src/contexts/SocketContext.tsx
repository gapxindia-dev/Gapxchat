import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RoomMember {
  username: string;
  avatar: string;
  status: 'online' | 'idle' | 'offline';
  lastSeen: string;
  isOwner: boolean;
}

export interface Reaction {
  emoji: string;
  users: string[];
}

export interface ReadReceipt {
  username: string;
  readAt: string;
}

export interface EditHistoryEntry {
  content: string;
  editedAt: string;
}

export interface Message {
  id: string;
  roomId: string;
  sender: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'file' | 'audio' | 'voice' | 'system';
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
  replyTo?: string;
  timestamp: string;
  reactions: Reaction[];
  readBy: ReadReceipt[];
  edited: boolean;
  editHistory: EditHistoryEntry[];
  pinned?: boolean;
}

export interface ActiveRoom {
  code: string;
  name: string;
  username: string;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  roomMembers: RoomMember[];
  typingUsers: string[];
  messages: Message[];
  activeRoom: ActiveRoom | null;
  error: string | null;
  connectToRoom: (token: string, roomCode: string, roomName?: string) => void;
  disconnectFromRoom: () => void;
  sendMessage: (content: string, type?: Message['type'], attachment?: { url: string; name: string; size: number }) => void;
  editMessage: (messageId: string, newContent: string) => void;
  deleteMessage: (messageId: string) => void;
  togglePinMessage: (messageId: string) => void;
  reactToMessage: (messageId: string, emoji: string, action: 'add' | 'remove') => void;
  markMessagesRead: () => void;
  updateStatus: (status: 'online' | 'idle') => void;
  kickUser: (username: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Helper to load chat history via HTTP API
  const fetchChatHistory = useCallback(async (token: string, roomCode: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomCode}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to load chat history');
      }
      const data = await response.json();
      setMessages(data);
    } catch (err: any) {
      console.error(err);
    }
  }, []);

  const connectToRoom = useCallback((token: string, roomCode: string, roomName?: string) => {
    // Disconnect existing socket if any
    setSocket((prevSocket) => {
      if (prevSocket) prevSocket.disconnect();
      return null;
    });

    // Decode username from JWT
    let username = 'User';
    try {
      const payloadBase64 = token.split('.')[1];
      const payloadJson = JSON.parse(atob(payloadBase64));
      username = payloadJson.username || 'User';
    } catch (e) {
      console.error('Failed to decode JWT:', e);
    }

    // Initialize socket connection
    const newSocket = io('/', {
      auth: { token },
      transports: ['websocket'],
    });

    setSocket(newSocket);

    // Save session for refresh recovery
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_room_code', roomCode);
    if (roomName) {
      localStorage.setItem('chat_room_name', roomName);
    }

    // Set active room immediately so the UI can render
    setActiveRoom({
      code: roomCode,
      name: roomName || localStorage.getItem('chat_room_name') || roomCode,
      username,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('🔌 Connected to Socket.io signaling server');
      fetchChatHistory(token, roomCode);
    });

    newSocket.on('connect_error', (err) => {
      setIsConnected(false);
      setError(err.message);
      console.error('Connection error:', err);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Chat event listeners
    newSocket.on('message_received', (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    newSocket.on('message_updated', (updatedMessage: Message) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg))
      );
    });

    newSocket.on('message_deleted', ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    });

    newSocket.on('room_members_list', (members: RoomMember[]) => {
      setRoomMembers(members);
    });

    newSocket.on('typing_update', (users: string[]) => {
      // Filter out current user — use the decoded username
      setTypingUsers(users.filter((u) => u.toLowerCase() !== username.toLowerCase()));
    });

    newSocket.on('user_status_changed', ({ username: u, status: s, lastSeen: ls }) => {
      setRoomMembers((prev) =>
        prev.map((member) =>
          member.username.toLowerCase() === u.toLowerCase()
            ? { ...member, status: s, lastSeen: ls }
            : member
        )
      );
    });

    newSocket.on('read_receipts_updated', ({ username: u, messages: newMsgs }) => {
      if (newMsgs) {
        setMessages(newMsgs);
      } else {
        setMessages((prev) =>
          prev.map((msg) => {
            const alreadyRead = msg.readBy.some((r) => r.username === u);
            if (!alreadyRead && msg.sender !== u) {
              return {
                ...msg,
                readBy: [...msg.readBy, { username: u, readAt: new Date().toISOString() }],
              };
            }
            return msg;
          })
        );
      }
    });

    newSocket.on('kicked_from_room', ({ reason }) => {
      // Dispatch a custom event so components can show toast instead of alert
      window.dispatchEvent(new CustomEvent('chat:kicked', { detail: { reason } }));
      disconnectFromRoomInternal(newSocket);
    });

    newSocket.on('error_message', ({ error: errMsg }) => {
      window.dispatchEvent(new CustomEvent('chat:error', { detail: { message: errMsg } }));
    });
  }, [fetchChatHistory]);

  // Internal disconnect that takes socket as param (avoids stale closure)
  const disconnectFromRoomInternal = (socketInstance: Socket | null) => {
    if (socketInstance) {
      socketInstance.disconnect();
    }
    setSocket(null);
    setIsConnected(false);
    setRoomMembers([]);
    setTypingUsers([]);
    setMessages([]);
    setActiveRoom(null);
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_room_code');
    localStorage.removeItem('chat_room_name');
  };

  const disconnectFromRoom = useCallback(() => {
    setSocket((currentSocket) => {
      disconnectFromRoomInternal(currentSocket);
      return null;
    });
  }, []);

  const sendMessage = useCallback((content: string, type: Message['type'] = 'text', attachment?: { url: string; name: string; size: number }) => {
    if (socket && isConnected) {
      socket.emit('message_send', {
        content,
        type,
        attachmentUrl: attachment?.url,
        attachmentName: attachment?.name,
        attachmentSize: attachment?.size,
      });
    }
  }, [socket, isConnected]);

  const editMessage = useCallback((messageId: string, newContent: string) => {
    if (socket && isConnected) {
      socket.emit('message_edit', { messageId, newContent });
    }
  }, [socket, isConnected]);

  const deleteMessage = useCallback((messageId: string) => {
    if (socket && isConnected) {
      socket.emit('message_delete', { messageId });
    }
  }, [socket, isConnected]);

  const togglePinMessage = useCallback((messageId: string) => {
    if (socket && isConnected) {
      socket.emit('message_pin_toggle', { messageId });
    }
  }, [socket, isConnected]);

  const reactToMessage = useCallback((messageId: string, emoji: string, action: 'add' | 'remove') => {
    if (socket && isConnected) {
      socket.emit('message_react', { messageId, emoji, action });
    }
  }, [socket, isConnected]);

  const markMessagesRead = useCallback(() => {
    if (socket && isConnected) {
      socket.emit('mark_read');
    }
  }, [socket, isConnected]);

  const updateStatus = useCallback((status: 'online' | 'idle') => {
    if (socket && isConnected) {
      socket.emit('status_update', { status });
    }
  }, [socket, isConnected]);

  const kickUser = useCallback((targetUsername: string) => {
    if (socket && isConnected) {
      socket.emit('admin_kick_user', { targetUsername });
    }
  }, [socket, isConnected]);

  // Handle reload state recovery
  useEffect(() => {
    const savedToken = localStorage.getItem('chat_token');
    const savedRoom = localStorage.getItem('chat_room_code');
    const savedRoomName = localStorage.getItem('chat_room_name');

    if (savedToken && savedRoom) {
      try {
        const payloadBase64 = savedToken.split('.')[1];
        const payloadJson = JSON.parse(atob(payloadBase64));
        const username = payloadJson.username || 'User';
        setActiveRoom({
          code: savedRoom,
          name: savedRoomName || savedRoom,
          username,
        });
        connectToRoom(savedToken, savedRoom, savedRoomName || savedRoom);
      } catch (err) {
        console.error('Failed to parse saved room session:', err);
        localStorage.removeItem('chat_token');
        localStorage.removeItem('chat_room_code');
        localStorage.removeItem('chat_room_name');
      }
    }
  }, [connectToRoom]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        roomMembers,
        typingUsers,
        messages,
        activeRoom,
        error,
        connectToRoom,
        disconnectFromRoom,
        sendMessage,
        editMessage,
        deleteMessage,
        togglePinMessage,
        reactToMessage,
        markMessagesRead,
        updateStatus,
        kickUser,
        setMessages,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

// eslint-disable-next-line react/only-export-components
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
