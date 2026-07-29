import React, { useState } from 'react';
import {
  Check, CheckCheck, CornerDownRight, Download, FileText,
  Smile, Pin, Edit2, Trash2
} from 'lucide-react';
import type { Message } from '../contexts/SocketContext.js';
import { useSocket } from '../contexts/SocketContext.js';
import { AudioPlayer } from './AudioPlayer.js';

interface MessageItemProps {
  message: Message;
  currentUsername: string;
  isOwner?: boolean;
  onReply: (msg: Message) => void;
  onImageClick?: (url: string) => void;
}

// Avatar color helper
function getAvatarColor(username: string): string {
  const colors = [
    '#10B981', '#06B6D4', '#3B82F6', '#6366F1',
    '#8B5CF6', '#EC4899', '#F59E0B', '#14B8A6'
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const EMOJI_PRESETS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉'];

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  currentUsername,
  isOwner,
  onReply,
  onImageClick,
}) => {
  const { reactToMessage, deleteMessage, togglePinMessage, editMessage } = useSocket();
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isMe = message.sender.toLowerCase() === currentUsername.toLowerCase();
  const isSystem = message.type === 'system';

  // System Message render
  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="px-3 py-1 rounded-full bg-black/20 dark:bg-white/10 text-[11px] font-medium text-[var(--text-tertiary)] border border-white/5 shadow-xs">
          {message.content}
        </div>
      </div>
    );
  }

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      editMessage(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleReactionClick = (emoji: string) => {
    const userReacted = message.reactions?.some(
      (r) => r.emoji === emoji && r.users.includes(currentUsername)
    );
    reactToMessage(message.id, emoji, userReacted ? 'remove' : 'add');
    setShowReactionsMenu(false);
  };

  const isRead = message.readBy && message.readBy.length > 0;

  return (
    <div
      className={`group relative flex gap-2.5 my-1.5 px-2 md:px-4 ${
        isMe ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Sender Avatar for incoming messages */}
      {!isMe && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-[11px] shrink-0 mt-1 shadow-sm"
          style={{ background: getAvatarColor(message.sender) }}
        >
          {message.sender.substring(0, 2).toUpperCase()}
        </div>
      )}

      {/* Message Bubble Container */}
      <div className={`relative max-w-[85%] sm:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        
        {/* Reply Context Banner */}
        {message.replyTo && (
          <div
            className={`text-xs px-3 py-1.5 rounded-t-xl mb-0.5 border-l-4 border-emerald-500 bg-black/20 text-gray-300 w-full truncate cursor-pointer opacity-90`}
          >
            <span className="font-semibold text-emerald-400">Replying to message</span>
          </div>
        )}

        <div
          className={`relative px-3.5 py-2.5 rounded-2xl shadow-sm border transition-shadow ${
            isMe
              ? 'bg-[var(--bg-bubble-me)] text-white border-emerald-600/30 rounded-tr-xs'
              : 'bg-[var(--bg-bubble-them)] text-[var(--text-primary)] border-[var(--border-color)] rounded-tl-xs'
          }`}
        >
          {/* Pinned Badge */}
          {message.pinned && (
            <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 mb-1">
              <Pin className="w-3 h-3 fill-amber-400" /> Pinned Message
            </div>
          )}

          {/* Sender Username */}
          {!isMe && (
            <p className="text-[11px] font-bold text-emerald-400 mb-1 leading-none">
              {message.sender}
            </p>
          )}

          {/* Message Content / Attachments */}
          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="px-2 py-1 rounded bg-black/30 text-white text-xs border border-emerald-500 focus:outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-2 py-0.5 rounded bg-gray-600 text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-2 py-0.5 rounded bg-emerald-500 text-white font-semibold"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Text */}
              {message.content && (
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed select-text">
                  {message.content}
                </p>
              )}

              {/* Image Attachment */}
              {message.type === 'image' && message.attachmentUrl && (
                <div className="mt-1.5 rounded-xl overflow-hidden max-w-sm cursor-pointer border border-black/10">
                  <img
                    src={message.attachmentUrl}
                    alt="attachment"
                    onClick={() => onImageClick?.(message.attachmentUrl!)}
                    className="w-full max-h-72 object-cover rounded-xl hover:scale-102 transition-transform"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Voice Note / Audio Attachment */}
              {(message.type === 'voice' || message.type === 'audio') && message.attachmentUrl && (
                <div className="mt-1.5">
                  <AudioPlayer url={message.attachmentUrl} isVoiceNote={message.type === 'voice'} />
                </div>
              )}

              {/* Document / File Attachment */}
              {message.type === 'file' && message.attachmentUrl && (
                <a
                  href={message.attachmentUrl}
                  download={message.attachmentName || 'file'}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 flex items-center gap-3 p-2.5 rounded-xl bg-black/10 dark:bg-white/5 border border-white/10 hover:bg-black/20 transition-colors"
                >
                  <FileText className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate text-[var(--text-primary)]">
                      {message.attachmentName || 'Attachment'}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">Click to download file</p>
                  </div>
                  <Download className="w-4 h-4 text-gray-400 shrink-0" />
                </a>
              )}
            </>
          )}

          {/* Footer: Timestamp & Read Status */}
          <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] opacity-75 float-right ml-3">
            {message.edited && <span className="italic">edited</span>}
            <span>{formatTime(message.timestamp)}</span>
            {isMe && (
              <span title={isRead ? 'Read' : 'Sent'}>
                {isRead ? (
                  <CheckCheck className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-gray-300 stroke-[2.5]" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Emoji Reactions List Pill */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => handleReactionClick(r.emoji)}
                type="button"
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border shadow-2xs transition-transform active:scale-90 ${
                  r.users.includes(currentUsername)
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 font-bold'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-color)] text-gray-300'
                }`}
              >
                <span>{r.emoji}</span>
                <span className="text-[10px]">{r.users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Hover Popover Quick Actions */}
        <div
          className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-0.5 p-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-md z-20 ${
            isMe ? '-left-24' : '-right-24'
          }`}
        >
          {/* Reaction Picker Button */}
          <div className="relative">
            <button
              onClick={() => setShowReactionsMenu(!showReactionsMenu)}
              className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-amber-400 transition-colors"
              title="React"
            >
              <Smile className="w-4 h-4" />
            </button>

            {showReactionsMenu && (
              <div className="absolute bottom-full mb-2 left-0 flex gap-1 p-1.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-xl z-30">
                {EMOJI_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReactionClick(emoji)}
                    className="p-1.5 hover:scale-125 transition-transform text-base"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply */}
          <button
            onClick={() => onReply(message)}
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-emerald-400 transition-colors"
            title="Reply"
          >
            <CornerDownRight className="w-4 h-4" />
          </button>

          {/* Pin */}
          <button
            onClick={() => togglePinMessage(message.id)}
            className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-amber-400 transition-colors"
            title="Pin message"
          >
            <Pin className="w-4 h-4" />
          </button>

          {/* Edit (Author only) */}
          {isMe && message.type === 'text' && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-gray-400 hover:text-blue-400 transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          {/* Delete (Author or Room Owner) */}
          {(isMe || isOwner) && (
            <button
              onClick={() => deleteMessage(message.id)}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
