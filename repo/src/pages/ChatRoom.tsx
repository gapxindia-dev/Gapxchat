import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Shield, Mic, MicOff, PhoneCall, PhoneOff, Settings, Search,
  Paperclip, Smile, FileText, Download, Trash2, Edit2, Pin,
  CornerDownRight, X, ZoomIn, Play, Pause, UserMinus, LogOut,
  Check, CheckCheck, Menu, Moon, Sun, Copy, Hash
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext.js';
import type { Message } from '../contexts/SocketContext.js';
import { useVoice } from '../contexts/VoiceContext.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import { useToast } from '../components/Toast.js';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

// ============================================================
// Helper: Avatar color from username
// ============================================================
function getAvatarColor(username: string): string {
  const colors = [
    '#7C3AED', '#8B5CF6', '#6D28D9',
    '#EC4899', '#DB2777', '#BE185D',
    '#2563EB', '#1D4ED8', '#1E40AF',
    '#059669', '#047857', '#065F46',
    '#D97706', '#B45309', '#92400E',
    '#DC2626', '#B91C1C', '#991B1B',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ============================================================
// Avatar Component
// ============================================================
const Avatar: React.FC<{ username: string; size?: number; className?: string }> = ({
  username, size = 32, className = ''
}) => {
  const color = getAvatarColor(username);
  const initials = username.substring(0, 2).toUpperCase();
  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white shrink-0 ${className}`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.35 }}
      aria-label={username}
    >
      {initials}
    </div>
  );
};

// ============================================================
// Audio Player Component
// ============================================================
const AudioPlayer: React.FC<{ url: string; isVoiceNote?: boolean }> = memo(({ url, isVoiceNote }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const changeSpeed = () => {
    if (!audioRef.current) return;
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    audioRef.current.playbackRate = nextRate;
  };

  const formatTime = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl w-64 sm:w-72"
      style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-color)' }}>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
      <button
        onClick={togglePlay}
        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 hover:scale-105 transition-transform"
        style={{ background: 'var(--brand-gradient)' }}
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[10px] mb-1.5"
          style={{ color: 'var(--text-tertiary)' }}>
          <span>{isVoiceNote ? '🎤 Voice message' : 'Audio file'}</span>
          <span>{playbackRate}x</span>
        </div>
        <div className="w-full h-1.5 rounded-full relative cursor-pointer overflow-hidden"
          style={{ background: 'var(--bg-elevated)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--brand-gradient)' }} />
        </div>
        <div className="flex justify-between text-[9px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <button
        onClick={changeSpeed}
        className="text-[10px] font-extrabold px-1.5 py-1 rounded shrink-0"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-brand)' }}
        aria-label="Change playback speed"
      >
        {playbackRate}x
      </button>
    </div>
  );
});
AudioPlayer.displayName = 'AudioPlayer';

// ============================================================
// Message Bubble Component (memoized)
// ============================================================
interface MessageBubbleProps {
  msg: Message;
  isMe: boolean;
  isGrouped: boolean; // same sender as previous message
  isLastInGroup: boolean;
  activeRoomUsername?: string;
  isOwner: boolean;
  onReply: (msg: Message) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onReact: (id: string, emoji: string, action: 'add' | 'remove') => void;
  onZoomImage: (url: string) => void;
  messages: Message[];
  editingMessageId: string | null;
  editText: string;
  setEditText: (t: string) => void;
  setEditingMessageId: (id: string | null) => void;
  socket: any;
}

const MessageBubble: React.FC<MessageBubbleProps> = memo(({
  msg, isMe, isGrouped, isLastInGroup, activeRoomUsername, isOwner,
  onReply, onEdit, onDelete, onPin, onReact,
  onZoomImage, messages, editingMessageId, editText, setEditText,
  setEditingMessageId, socket
}) => {
  const quickEmojis = ['👍', '❤️', '🔥', '😂'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex items-end gap-2 group relative ${isMe ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
    >
      {/* Other person's avatar */}
      {!isMe && (
        <div className="w-8 shrink-0">
          {!isGrouped && <Avatar username={msg.sender} size={32} />}
        </div>
      )}

      <div className={`flex flex-col max-w-[78%] sm:max-w-[65%] ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Sender name (first in group) */}
        {!isMe && !isGrouped && (
          <span className="text-xs font-semibold mb-1 ml-1" style={{ color: getAvatarColor(msg.sender) }}>
            {msg.sender}
          </span>
        )}

        {/* Bubble */}
        <div className={`relative group/bubble ${isMe ? 'bubble-me' : 'bubble-them'} px-3.5 py-2.5`}>

          {/* Reply preview */}
          {msg.replyTo && (() => {
            const replyMsg = messages.find(m => m.id === msg.replyTo);
            return (
              <div className="flex items-center gap-2 mb-2 pl-2 text-xs rounded"
                style={{ borderLeft: '2px solid var(--brand-primary)', opacity: 0.75 }}>
                <CornerDownRight className="h-3 w-3 shrink-0" style={{ color: 'var(--text-brand)' }} />
                <span className="truncate max-w-[180px]" style={{ color: 'var(--text-secondary)' }}>
                  {replyMsg ? replyMsg.content : 'Deleted message'}
                </span>
              </div>
            );
          })()}

          {/* Edit mode */}
          {editingMessageId === msg.id ? (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none resize-none"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid var(--border-brand)',
                  color: 'var(--text-primary)',
                  minHeight: '60px'
                }}
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button onClick={() => setEditingMessageId(null)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (editText.trim() && socket) {
                      socket.emit('message_edit', { messageId: msg.id, newContent: editText });
                      setEditingMessageId(null);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white"
                  style={{ background: 'var(--brand-primary)' }}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            /* Message text content */
            <div className="text-sm leading-relaxed whitespace-pre-wrap break-words markdown-body select-text"
              style={{ color: 'var(--text-primary)' }}>
              {msg.content}
            </div>
          )}

          {/* Attachment rendering */}
          {msg.attachmentUrl && (
            <div className="mt-2.5">
              {msg.type === 'image' && (
                <div
                  onClick={() => onZoomImage(msg.attachmentUrl!)}
                  className="relative rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ border: '1px solid var(--border-color)', maxHeight: '240px' }}>
                  <img src={msg.attachmentUrl} alt="attachment"
                    className="w-full object-contain" style={{ maxHeight: '240px', background: 'var(--bg-elevated)' }} />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                    <ZoomIn className="h-6 w-6 text-white" />
                  </div>
                </div>
              )}
              {msg.type === 'video' && (
                <video src={msg.attachmentUrl} controls playsInline
                  className="rounded-xl w-full" style={{ maxHeight: '240px', border: '1px solid var(--border-color)' }} />
              )}
              {(msg.type === 'audio' || msg.type === 'voice') && (
                <AudioPlayer url={msg.attachmentUrl} isVoiceNote={msg.type === 'voice'} />
              )}
              {msg.type === 'file' && (
                <a href={msg.attachmentUrl} download={msg.attachmentName}
                  className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                  style={{ border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.12)' }}>
                  <FileText className="h-8 w-8 shrink-0" style={{ color: 'var(--text-brand)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {msg.attachmentName}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      {msg.attachmentSize ? `${(msg.attachmentSize / (1024 * 1024)).toFixed(2)} MB` : 'File'}
                    </p>
                  </div>
                  <Download className="h-4 w-4 shrink-0" style={{ color: 'var(--text-secondary)' }} />
                </a>
              )}
            </div>
          )}

          {/* Hover actions tray */}
          <div className={`absolute top-[-38px] z-20 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-0.5 rounded-xl p-1 shadow-xl ${isMe ? 'right-0' : 'left-0'}`}
            style={{ background: 'var(--bg-modal)', border: '1px solid var(--border-color)' }}>
            <button onClick={() => onReply(msg)} className="icon-btn p-1.5 border-0 rounded-lg !bg-transparent" title="Reply">
              <CornerDownRight className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onPin(msg.id)}
              className={`icon-btn p-1.5 border-0 rounded-lg !bg-transparent ${msg.pinned ? '!text-violet-400' : ''}`} title={msg.pinned ? 'Unpin' : 'Pin'}>
              <Pin className="h-3.5 w-3.5" />
            </button>
            {isMe && (
              <button onClick={() => onEdit(msg.id, msg.content)}
                className="icon-btn p-1.5 border-0 rounded-lg !bg-transparent" title="Edit">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
            {(isMe || isOwner) && (
              <button onClick={() => onDelete(msg.id)}
                className="icon-btn p-1.5 border-0 rounded-lg !bg-transparent hover:!text-red-400" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-color)' }} />
            {quickEmojis.map(emoji => {
              const alreadyReacted = msg.reactions.find(r => r.emoji === emoji)?.users.includes(activeRoomUsername ?? '');
              return (
                <button key={emoji}
                  onClick={() => onReact(msg.id, emoji, alreadyReacted ? 'remove' : 'add')}
                  className="p-1.5 rounded-lg hover:scale-125 transition-transform text-sm"
                  title={emoji}>
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reactions */}
        {msg.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {msg.reactions.map(react => {
              const isMyReact = react.users.includes(activeRoomUsername ?? '');
              return (
                <button
                  key={react.emoji}
                  onClick={() => onReact(msg.id, react.emoji, isMyReact ? 'remove' : 'add')}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all"
                  style={{
                    border: `1px solid ${isMyReact ? 'var(--border-brand)' : 'var(--border-color)'}`,
                    background: isMyReact ? 'rgba(124,58,237,0.12)' : 'var(--bg-card)',
                    color: isMyReact ? 'var(--text-brand)' : 'var(--text-secondary)',
                    fontWeight: isMyReact ? '700' : '400',
                  }}
                  title={react.users.join(', ')}
                >
                  {react.emoji} {react.users.length}
                </button>
              );
            })}
          </div>
        )}

        {/* Meta row: time, edited, read receipt */}
        {isLastInGroup && (
          <div className={`flex items-center gap-1.5 mt-0.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {msg.edited && (
              <span className="text-[9px] italic" style={{ color: 'var(--text-muted)' }}>edited</span>
            )}
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isMe && (
              <span title={msg.readBy.length > 1 ? `Read by ${msg.readBy.length - 1}` : 'Sent'}>
                {msg.readBy.length > 1
                  ? <CheckCheck className="h-3 w-3 text-violet-400" />
                  : <Check className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
                }
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
});
MessageBubble.displayName = 'MessageBubble';

// ============================================================
// Main ChatRoom Component
// ============================================================
export const ChatRoom: React.FC = () => {
  const {
    socket, activeRoom, messages, roomMembers, typingUsers,
    isConnected, deleteMessage, togglePinMessage, reactToMessage,
    markMessagesRead, updateStatus, kickUser, disconnectFromRoom,
  } = useSocket();

  const {
    isInVoice, isLocalMuted, isPushToTalk, voiceParticipants,
    joinVoice, leaveVoice, toggleLocalMute, setPushToTalk,
  } = useVoice();

  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // UI state
  const [inputText, setInputText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const {
    isRecording, recordingTime, startRecording, stopRecording, cancelRecording,
  } = useAudioRecorder();

  // Derived state
  const isOwner = useMemo(
    () => !!roomMembers.find(m => m.username.toLowerCase() === activeRoom?.username?.toLowerCase())?.isOwner,
    [roomMembers, activeRoom?.username]
  );

  const sharedMedia = useMemo(
    () => messages.filter(m => m.type === 'image' || m.type === 'video'),
    [messages]
  );

  const filteredMessages = useMemo(
    () => searchQuery.trim()
      ? messages.filter(m => m.sender !== 'System' && m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      : [],
    [messages, searchQuery]
  );

  const pinnedMessages = useMemo(
    () => messages.filter(m => m.pinned),
    [messages]
  );

  // ============================================================
  // Effects
  // ============================================================

  // Simulate loading state
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // Idle detection
  useEffect(() => {
    let idleTimer: number;
    const resetIdleTimer = () => {
      updateStatus('online');
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => updateStatus('idle'), 5 * 60 * 1000);
    };
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    resetIdleTimer();
    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      clearTimeout(idleTimer);
    };
  }, [updateStatus]);

  // Room countdown timer
  useEffect(() => {
    if (!activeRoom) return;
    const update = () => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(24, 0, 0, 0);
      const diff = endOfDay.getTime() - now.getTime();
      if (diff <= 0) { setTimeRemaining('Expired'); return; }
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setTimeRemaining(`${h}:${m}:${s}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeRoom]);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
    markMessagesRead();
  }, [messages, scrollToBottom, markMessagesRead]);

  // Textarea auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputText]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowEmojiPicker(false);
        setShowGifPicker(false);
        setShowSettings(false);
        setShowPinned(false);
        setShowSearch(false);
        setShowSidebar(false);
        setZoomedImageUrl(null);
        setEditingMessageId(null);
        setReplyingToMessage(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ============================================================
  // Handlers
  // ============================================================

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    if (socket && isConnected) {
      if (e.target.value.trim().length > 0) {
        socket.emit('typing_start');
      } else {
        socket.emit('typing_stop');
      }
    }
  };

  const handleSendMessage = useCallback(() => {
    if (!inputText.trim() || !socket || !isConnected) return;
    socket.emit('message_send', {
      content: inputText,
      type: 'text',
      replyTo: replyingToMessage?.id,
    });
    socket.emit('typing_stop');
    setInputText('');
    setReplyingToMessage(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    scrollToBottom();
  }, [inputText, socket, isConnected, replyingToMessage, scrollToBottom]);

  // Enter = send, Shift+Enter = newline
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const processUpload = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      addToast('File size exceeds the 100 MB limit.', 'error');
      return;
    }
    const token = localStorage.getItem('chat_token');
    const formData = new FormData();
    formData.append('file', file);
    setUploadProgress(10);
    try {
      const response = await fetch('/api/uploads', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      setUploadProgress(70);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');
      setUploadProgress(100);

      let msgType: Message['type'] = 'file';
      if (file.type.startsWith('image/')) msgType = 'image';
      else if (file.type.startsWith('video/')) msgType = 'video';
      else if (file.type.startsWith('audio/')) msgType = 'audio';

      if (socket && isConnected) {
        socket.emit('message_send', {
          content: `Shared: ${file.name}`,
          type: msgType,
          attachmentUrl: data.file.url,
          attachmentName: data.file.name,
          attachmentSize: data.file.size,
          replyTo: replyingToMessage?.id,
        });
      }
      addToast(`${file.name} uploaded!`, 'success');
    } catch (err: any) {
      addToast(err.message || 'File upload failed.', 'error');
    } finally {
      setTimeout(() => setUploadProgress(null), 800);
      setReplyingToMessage(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) processUpload(e.dataTransfer.files[0]);
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files?.length) {
      e.preventDefault();
      processUpload(e.clipboardData.files[0]);
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) processUpload(e.target.files[0]);
  };

  const finishVoiceNote = async () => {
    const blob = await stopRecording();
    if (!blob) return;
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
    const token = localStorage.getItem('chat_token');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('/api/uploads', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (response.ok && socket && isConnected) {
        socket.emit('message_send', {
          content: '🎤 Voice message',
          type: 'voice',
          attachmentUrl: data.file.url,
          attachmentName: 'Voice Note.webm',
          attachmentSize: data.file.size,
        });
      }
    } catch (err) {
      console.error('Voice note upload failed:', err);
      addToast('Failed to send voice message.', 'error');
    }
  };

  const handleGifSearch = async () => {
    if (!gifSearch.trim()) return;
    setGifLoading(true);
    try {
      const url = `https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(gifSearch)}&limit=15`;
      const response = await fetch(url);
      const data = await response.json();
      setGifs(data.data || []);
    } catch {
      addToast('GIF search failed.', 'error');
    } finally {
      setGifLoading(false);
    }
  };

  const selectGif = (gifUrl: string) => {
    if (socket && isConnected) {
      socket.emit('message_send', { content: 'GIF', type: 'image', attachmentUrl: gifUrl, attachmentName: 'giphy.gif' });
    }
    setShowGifPicker(false);
    setGifs([]);
    setGifSearch('');
  };

  const addEmojiToText = (emojiData: any) => {
    setInputText(prev => prev + emojiData.native);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeRoom?.code || '')
      .then(() => addToast('Room code copied!', 'success', 2000))
      .catch(() => addToast('Could not copy to clipboard.', 'error'));
  };

  const handleDisconnect = () => {
    disconnectFromRoom();
    window.location.reload();
  };

  // ============================================================
  // Loading skeleton
  // ============================================================
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center animate-pulse"
            style={{ background: 'var(--brand-gradient)' }}>
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-violet-500 typing-dot" />
            <span className="h-2 w-2 rounded-full bg-violet-500 typing-dot" />
            <span className="h-2 w-2 rounded-full bg-violet-500 typing-dot" />
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      className="h-screen w-screen flex flex-col overflow-hidden transition-colors duration-300"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Drag & Drop overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center m-4 rounded-2xl pointer-events-none"
            style={{ background: 'rgba(124,58,237,0.15)', border: '3px dashed rgba(124,58,237,0.6)', backdropFilter: 'blur(8px)' }}
          >
            <Paperclip className="h-16 w-16 text-violet-400 animated-float" />
            <h2 className="text-2xl font-bold mt-4" style={{ color: 'var(--text-primary)' }}>Drop to attach</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Up to 100 MB</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== MAIN LAYOUT ==================== */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ======== SIDEBAR (desktop fixed, mobile drawer) ======== */}
        {/* Mobile overlay backdrop */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSidebar(false)}
              className="fixed inset-0 z-30 md:hidden"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            />
          )}
        </AnimatePresence>

        <aside className={`
          w-72 lg:w-80 flex flex-col shrink-0 z-40
          fixed md:relative inset-y-0 left-0 h-full
          transition-transform duration-300 ease-out
          ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
          style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border-color)' }}>

          {/* Sidebar Header */}
          <div className="p-4 flex flex-col gap-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
            {/* Mobile close button */}
            <div className="flex items-center justify-between md:hidden">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Room Info</span>
              <button onClick={() => setShowSidebar(false)} className="icon-btn p-1.5 rounded-lg" aria-label="Close sidebar">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Room name + timer */}
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-base truncate" style={{ color: 'var(--text-primary)' }}>
                {activeRoom?.name || 'Loading...'}
              </h2>
              {timeRemaining && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    color: '#FBBF24',
                    background: 'rgba(251,191,36,0.08)',
                    border: '1px solid rgba(251,191,36,0.2)'
                  }}>
                  ⏱ {timeRemaining}
                </span>
              )}
            </div>

            {/* Room Code copy */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5" style={{ color: 'var(--text-tertiary)' }}>
                <Hash className="h-3.5 w-3.5" />
                <span className="text-xs">Invite Code</span>
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg font-mono font-bold text-xs transition-all hover:scale-105"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-brand)'
                }}
                aria-label="Copy room code"
              >
                {activeRoom?.code}
                <Copy className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Voice Channel */}
          <div className="p-3" style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isInVoice ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Voice Channel</span>
              </div>
              {!isInVoice ? (
                <button
                  onClick={joinVoice}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white transition-colors hover:opacity-90"
                  style={{ background: 'var(--brand-primary)' }}
                  aria-label="Join voice channel"
                >
                  <PhoneCall className="h-3 w-3" /> Connect
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    onClick={toggleLocalMute}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{
                      background: isLocalMuted ? 'rgba(239,68,68,0.15)' : 'var(--bg-elevated)',
                      color: isLocalMuted ? '#EF4444' : 'var(--text-secondary)',
                      border: isLocalMuted ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border-color)'
                    }}
                    aria-label={isLocalMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isLocalMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={leaveVoice}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-white"
                    style={{ background: '#EF4444' }}
                    aria-label="Leave voice channel"
                  >
                    <PhoneOff className="h-3 w-3" /> Leave
                  </button>
                </div>
              )}
            </div>

            {isInVoice && voiceParticipants.length > 0 && (
              <div className="space-y-1 mt-2 p-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <span className="text-[9px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-muted)' }}>Speaking Mesh</span>
                {voiceParticipants.map(v => (
                  <div key={v.socketId} className="flex items-center justify-between text-xs py-0.5">
                    <span style={{ color: v.isSpeaking ? '#10B981' : 'var(--text-secondary)', fontWeight: v.isSpeaking ? '700' : '400' }}>
                      🎙️ {v.username} {v.isSpeaking && '(Speaking)'}
                    </span>
                    {v.isMuted && <MicOff className="h-3 w-3 text-red-500" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Members List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>
                Members ({roomMembers.length})
              </span>
              <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}
                title={isConnected ? 'Connected' : 'Disconnected'} />
            </div>

            <div className="space-y-0.5">
              {roomMembers.map(member => {
                const isCurrentUser = member.username.toLowerCase() === activeRoom?.username?.toLowerCase();
                const statusColor = member.status === 'online' ? '#10B981' : member.status === 'idle' ? '#F59E0B' : '#6B7280';
                return (
                  <div
                    key={member.username}
                    className="flex items-center justify-between py-2 px-2.5 rounded-xl group transition-colors hover:bg-white/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <Avatar username={member.username} size={34} />
                        <span
                          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full"
                          style={{ background: statusColor, border: '2px solid var(--bg-sidebar)' }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {member.username}
                          </span>
                          {member.isOwner && <span title="Room Owner">👑</span>}
                          {isCurrentUser && (
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>(You)</span>
                          )}
                        </div>
                        {member.status === 'offline' && (
                          <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                            seen {new Date(member.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Kick button (owner only, not self) */}
                    {!isCurrentUser && isOwner && (
                      <button
                        onClick={() => kickUser(member.username)}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                        style={{ color: 'var(--text-tertiary)' }}
                        aria-label={`Kick ${member.username}`}
                        title="Kick user"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shared Media Thumbnails */}
          {sharedMedia.length > 0 && (
            <div className="p-3" style={{ borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.05)' }}>
              <span className="text-xs uppercase tracking-wider font-bold block mb-2" style={{ color: 'var(--text-muted)' }}>
                Shared Media
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {sharedMedia.slice(0, 8).map(m => (
                  <div
                    key={m.id}
                    onClick={() => setZoomedImageUrl(m.attachmentUrl || '')}
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                  >
                    {m.type === 'image'
                      ? <img src={m.attachmentUrl} alt="shared media" className="h-full w-full object-cover" />
                      : <div className="h-full w-full flex items-center justify-center"><FileText className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} /></div>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sidebar Footer */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
              <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>Secured Sandbox</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="icon-btn p-1.5 rounded-lg hover:!text-red-400 hover:!border-red-500/30"
              title="Leave Room"
              aria-label="Leave room"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* ======== CENTER: Chat Panel ======== */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Chat Header */}
          <header className="h-14 sm:h-16 px-3 sm:px-5 flex items-center justify-between shrink-0 z-20"
            style={{
              background: 'var(--bg-header)',
              borderBottom: '1px solid var(--border-color)',
              backdropFilter: 'blur(20px)'
            }}>
            <div className="flex items-center gap-2.5">
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setShowSidebar(true)}
                className="icon-btn p-2 rounded-xl md:hidden"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--shadow-brand)' }}>
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5 truncate max-w-[120px] sm:max-w-none"
                  style={{ color: 'var(--text-primary)' }}>
                  {activeRoom?.name}
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </h3>
                <p className="text-[10px] sm:text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {roomMembers.filter(m => m.status !== 'offline').length} online
                </p>
              </div>
            </div>

            {/* Header actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleTheme}
                className="icon-btn p-2 rounded-xl"
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <button
                onClick={() => setShowPinned(prev => !prev)}
                className={`icon-btn p-2 rounded-xl ${showPinned ? 'active' : ''}`}
                aria-label="Pinned messages"
                title="Pinned Messages"
              >
                <Pin className="h-4 w-4" />
              </button>

              <button
                onClick={() => setShowSearch(prev => !prev)}
                className={`icon-btn p-2 rounded-xl ${showSearch ? 'active' : ''}`}
                aria-label="Search messages (Ctrl+K)"
                title="Search Messages (Ctrl+K)"
              >
                <Search className="h-4 w-4" />
              </button>

              <button
                onClick={() => setShowSettings(prev => !prev)}
                className="icon-btn p-2 rounded-xl"
                aria-label="Room settings"
                title="Room Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* ========== Message List ========== */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-5 py-4"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="h-16 w-16 rounded-full flex items-center justify-center mb-4"
                  style={{ border: '2px dashed var(--border-strong)' }}>
                  <Shield className="h-7 w-7" style={{ color: 'var(--text-muted)' }} />
                </div>
                <h4 className="font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>No Messages Yet</h4>
                <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>
                  This room is secure. Say hello! Drag & drop files or type below.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const prevMsg = index > 0 ? messages[index - 1] : null;
                const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
                const showDateSeparator = !prevMsg ||
                  new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
                const isMe = msg.sender.toLowerCase() === activeRoom?.username?.toLowerCase();
                const isSystem = msg.sender === 'System';
                const isGrouped = !showDateSeparator && !!prevMsg && prevMsg.sender === msg.sender && prevMsg.sender !== 'System' && !isSystem;
                const isLastInGroup = !nextMsg || nextMsg.sender !== msg.sender || isSystem;

                return (
                  <React.Fragment key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex items-center gap-4 my-5">
                        <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
                        <span className="text-[10px] uppercase font-bold tracking-wider px-1"
                          style={{ color: 'var(--text-muted)' }}>
                          {new Date(msg.timestamp).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
                      </div>
                    )}

                    {isSystem ? (
                      <div className="flex justify-center my-3">
                        <div className="px-4 py-1 rounded-full text-[11px] font-semibold"
                          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)', color: 'var(--text-brand)' }}>
                          ⚡ {msg.content}
                        </div>
                      </div>
                    ) : (
                      <MessageBubble
                        msg={msg}
                        isMe={isMe}
                        isGrouped={isGrouped}
                        isLastInGroup={isLastInGroup}
                        activeRoomUsername={activeRoom?.username}
                        isOwner={isOwner}
                        onReply={setReplyingToMessage}
                        onEdit={(id, content) => { setEditingMessageId(id); setEditText(content); }}
                        onDelete={deleteMessage}
                        onPin={togglePinMessage}
                        onReact={reactToMessage}
                        onZoomImage={setZoomedImageUrl}
                        messages={messages}
                        editingMessageId={editingMessageId}
                        editText={editText}
                        setEditText={setEditText}
                        setEditingMessageId={setEditingMessageId}
                        socket={socket}
                      />
                    )}
                  </React.Fragment>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Typing Indicator */}
          <AnimatePresence>
            {typingUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="px-4 sm:px-6 py-2 flex items-center gap-2 shrink-0"
                style={{ color: 'var(--text-secondary)', fontSize: '12px' }}
              >
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full typing-dot" style={{ background: 'var(--text-secondary)' }} />
                  <span className="h-2 w-2 rounded-full typing-dot" style={{ background: 'var(--text-secondary)' }} />
                  <span className="h-2 w-2 rounded-full typing-dot" style={{ background: 'var(--text-secondary)' }} />
                </div>
                <span className="italic">
                  {typingUsers.length === 1
                    ? `${typingUsers[0]} is typing...`
                    : `${typingUsers.join(', ')} are typing...`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ========== INPUT AREA ========== */}
          <footer className="px-3 sm:px-4 py-3 sm:py-4 relative shrink-0 pb-safe"
            style={{ background: 'var(--bg-header)', borderTop: '1px solid var(--border-color)', backdropFilter: 'blur(20px)' }}>

            {/* Reply preview */}
            <AnimatePresence>
              {replyingToMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="flex items-center justify-between mb-2.5 px-3 py-2 rounded-xl text-xs"
                  style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CornerDownRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-brand)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Replying to</span>
                    <span className="font-semibold truncate" style={{ color: 'var(--text-brand)' }}>
                      @{replyingToMessage.sender}
                    </span>
                    <span className="truncate italic" style={{ color: 'var(--text-tertiary)' }}>
                      "{replyingToMessage.content.slice(0, 40)}{replyingToMessage.content.length > 40 ? '...' : ''}"
                    </span>
                  </div>
                  <button onClick={() => setReplyingToMessage(null)} className="ml-2 shrink-0 p-1 rounded-lg"
                    style={{ color: 'var(--text-tertiary)' }} aria-label="Cancel reply">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload progress bar */}
            {uploadProgress !== null && (
              <div className="mb-2.5 rounded-full overflow-hidden" style={{ height: '3px', background: 'var(--bg-elevated)' }}>
                <div className="h-full transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%`, background: 'var(--brand-gradient)' }} />
              </div>
            )}

            {/* Input row */}
            <div className="flex items-end gap-2">

              {/* Attachment */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="icon-btn p-2.5 rounded-xl"
                aria-label="Attach file"
                title="Attach Files"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.pdf,.txt,.docx,.zip"
                aria-label="File upload input"
              />

              {/* GIF button */}
              <button
                onClick={() => setShowGifPicker(prev => !prev)}
                className="icon-btn px-2 py-2.5 rounded-xl text-xs font-extrabold"
                aria-label="Search and send GIF"
                title="GIF"
              >
                GIF
              </button>

              {/* Emoji button */}
              <button
                onClick={() => setShowEmojiPicker(prev => !prev)}
                className="icon-btn p-2.5 rounded-xl"
                aria-label="Open emoji picker"
                title="Emojis"
              >
                <Smile className="h-5 w-5" />
              </button>

              {/* Textarea */}
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Message... (Enter to send, Shift+Enter for newline)"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm custom-scrollbar auto-resize-textarea"
                  aria-label="Message input"
                />
              </div>

              {/* Mic (hold to record) */}
              {!inputText.trim() && (
                <button
                  onMouseDown={startRecording}
                  onMouseUp={finishVoiceNote}
                  onMouseLeave={cancelRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={finishVoiceNote}
                  className={`icon-btn p-2.5 rounded-xl ${isRecording ? '!bg-red-600 !border-red-600 !text-white animate-pulse' : ''}`}
                  aria-label="Hold to record voice message"
                  title="Hold to record voice message"
                >
                  <Mic className="h-5 w-5" />
                </button>
              )}

              {/* Send button */}
              <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="p-2.5 rounded-xl text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
                style={{
                  background: inputText.trim() ? 'var(--brand-gradient)' : 'var(--bg-elevated)',
                  boxShadow: inputText.trim() ? 'var(--shadow-brand)' : 'none'
                }}
                aria-label="Send message"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>

            {/* Voice recording overlay */}
            {isRecording && (
              <div className="absolute inset-0 flex items-center justify-between px-4 rounded-none"
                style={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <div className="flex items-center gap-3">
                  <div className="flex items-end gap-0.5 h-6">
                    {[3, 5, 4, 2, 5, 3].map((h, i) => (
                      <span key={i} className="w-1 bg-red-500 rounded-full voice-wave-bar"
                        style={{ height: `${h * 4}px`, animationDelay: `${-i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-red-400 animate-pulse">Recording...</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Release to send</span>
                </div>
              </div>
            )}

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className="absolute bottom-full mb-2 right-3 sm:right-4 z-50">
                <div className="absolute inset-0 -m-2" onClick={() => setShowEmojiPicker(false)} />
                <div className="relative shadow-2xl rounded-2xl overflow-hidden"
                  style={{ border: '1px solid var(--border-strong)' }}>
                  <Picker data={data} onEmojiSelect={addEmojiToText} theme={theme} />
                </div>
              </div>
            )}

            {/* GIF Picker */}
            {showGifPicker && (
              <div className="absolute bottom-full mb-2 left-3 sm:left-4 z-50 w-72 sm:w-80 rounded-2xl p-4 shadow-2xl"
                style={{ background: 'var(--bg-modal)', border: '1px solid var(--border-strong)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>GIPHY Search</span>
                  <button onClick={() => setShowGifPicker(false)} className="icon-btn p-1 border-0 rounded-lg !bg-transparent">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Search GIFs..."
                    value={gifSearch}
                    onChange={(e) => setGifSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGifSearch()}
                    className="flex-1 px-3 py-1.5 rounded-xl glass-input text-xs"
                  />
                  <button onClick={handleGifSearch}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                    style={{ background: 'var(--brand-primary)' }}>
                    Go
                  </button>
                </div>
                <div className="h-52 overflow-y-auto custom-scrollbar grid grid-cols-3 gap-1.5">
                  {gifLoading ? (
                    <div className="col-span-3 h-full flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                      Loading GIFs...
                    </div>
                  ) : gifs.length === 0 ? (
                    <div className="col-span-3 h-full flex items-center justify-center text-xs italic" style={{ color: 'var(--text-muted)' }}>
                      Search to find GIFs
                    </div>
                  ) : (
                    gifs.map((g: any) => (
                      <img key={g.id} src={g.images.fixed_height_small.url} alt="GIF"
                        onClick={() => selectGif(g.images.original.url)}
                        className="h-20 w-full object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform"
                        style={{ background: 'var(--bg-elevated)' }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </footer>
        </main>
      </div>

      {/* ==================== OVERLAYS/MODALS ==================== */}
      <AnimatePresence>

        {/* Image Lightbox */}
        {zoomedImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.97)' }}
          >
            <button
              onClick={() => setZoomedImageUrl(null)}
              className="absolute top-4 right-4 p-3 rounded-full"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
              aria-label="Close image lightbox"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={zoomedImageUrl} alt="Full size preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            <a
              href={zoomedImageUrl}
              download
              className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'var(--brand-gradient)' }}
            >
              <Download className="h-4 w-4" /> Download
            </a>
          </motion.div>
        )}

        {/* Pinned Messages Drawer */}
        {showPinned && (
          <div className="fixed inset-0 z-40 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPinned(false)}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="w-full max-w-sm h-full z-10 flex flex-col"
              style={{ background: 'var(--bg-modal)', borderLeft: '1px solid var(--border-strong)' }}
            >
              <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Pin className="h-5 w-5" style={{ color: 'var(--text-brand)' }} />
                  Pinned Messages
                </h3>
                <button onClick={() => setShowPinned(false)} className="icon-btn p-1.5 rounded-lg" aria-label="Close pinned panel">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {pinnedMessages.length === 0 ? (
                  <div className="text-center py-10 text-xs italic" style={{ color: 'var(--text-muted)' }}>
                    No pinned messages. Hover any message and click the pin icon.
                  </div>
                ) : pinnedMessages.map(m => (
                  <div key={m.id} className="p-3.5 rounded-xl text-xs"
                    style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                    <div className="flex justify-between mb-1.5">
                      <span className="font-bold" style={{ color: 'var(--text-brand)' }}>@{m.sender}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{new Date(m.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{m.content}</p>
                    <button onClick={() => togglePinMessage(m.id)}
                      className="flex items-center gap-1 mt-2 text-[10px] hover:text-red-400 transition-colors"
                      style={{ color: 'var(--text-muted)' }}>
                      <X className="h-3 w-3" /> Unpin
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Search Drawer */}
        {showSearch && (
          <div className="fixed inset-0 z-40 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSearch(false)}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="w-full max-w-sm h-full z-10 flex flex-col"
              style={{ background: 'var(--bg-modal)', borderLeft: '1px solid var(--border-strong)' }}
            >
              <div className="flex items-center justify-between p-5 pb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Search className="h-5 w-5" style={{ color: 'var(--text-brand)' }} /> Search
                </h3>
                <button onClick={() => setShowSearch(false)} className="icon-btn p-1.5 rounded-lg" aria-label="Close search panel">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-4 pt-4 pb-2">
                <div className="relative">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2.5 pl-10 rounded-xl glass-input text-sm"
                    aria-label="Search messages"
                  />
                  <Search className="absolute left-3.5 top-3 h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
                {!searchQuery.trim() ? (
                  <p className="text-center text-xs italic py-6" style={{ color: 'var(--text-muted)' }}>Type to search messages</p>
                ) : filteredMessages.length === 0 ? (
                  <p className="text-center text-xs italic py-6" style={{ color: 'var(--text-muted)' }}>No matching messages</p>
                ) : filteredMessages.map(m => (
                  <div
                    key={m.id}
                    onClick={() => setShowSearch(false)}
                    className="p-3.5 rounded-xl text-xs cursor-pointer transition-colors"
                    style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
                  >
                    <div className="flex justify-between mb-1">
                      <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>@{m.sender}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{m.content}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md z-10 rounded-2xl"
              style={{ background: 'var(--bg-modal)', border: '1px solid var(--border-strong)' }}
            >
              <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Settings className="h-5 w-5" style={{ color: 'var(--text-brand)' }} /> Room Settings
                </h2>
                <button onClick={() => setShowSettings(false)} className="icon-btn p-1.5 rounded-lg" aria-label="Close settings">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-3">
                {/* Push to Talk */}
                <div className="flex items-center justify-between p-4 rounded-xl"
                  style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Push to Talk (PTT)</h4>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Hold SPACE to talk in Voice Channel</p>
                  </div>
                  <button
                    onClick={() => setPushToTalk(p => !p)}
                    className={`relative w-10 h-6 rounded-full transition-colors`}
                    style={{ background: isPushToTalk ? 'var(--brand-primary)' : 'var(--bg-elevated)' }}
                    aria-label={`Push to talk ${isPushToTalk ? 'enabled' : 'disabled'}`}
                  >
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${isPushToTalk ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Theme toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl"
                  style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                    </h4>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Toggle appearance theme</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="relative w-10 h-6 rounded-full transition-colors"
                    style={{ background: theme === 'dark' ? 'var(--brand-primary)' : 'var(--bg-elevated)' }}
                    aria-label="Toggle theme"
                  >
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${theme === 'dark' ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Export conversation */}
                <div className="flex items-center justify-between p-4 rounded-xl"
                  style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                  <div>
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Export Conversation</h4>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Download full chat transcript as .txt</p>
                  </div>
                  <button
                    onClick={() => {
                      const transcript = messages.map(m =>
                        `[${new Date(m.timestamp).toLocaleTimeString()}] ${m.sender}: ${m.content}`
                      ).join('\n');
                      const blob = new Blob([transcript], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `chat-${activeRoom?.code}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                      addToast('Conversation exported!', 'success', 2500);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                    style={{ background: 'var(--brand-primary)' }}
                    aria-label="Export conversation"
                  >
                    <Download className="h-3.5 w-3.5" /> Export
                  </button>
                </div>

                {/* Leave room */}
                <div className="flex items-center justify-between p-4 rounded-xl"
                  style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
                  <div>
                    <h4 className="text-sm font-semibold text-red-400">Leave Room</h4>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Disconnect and return to homepage</p>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white"
                    style={{ background: '#EF4444' }}
                    aria-label="Leave room"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Leave
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
};
