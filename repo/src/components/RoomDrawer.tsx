import React, { useState } from 'react';
import {
  X, Hash, Copy, Check, Users, UserMinus, Image as ImageIcon
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext.js';
import { useToast } from './Toast.js';

interface RoomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
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

export const RoomDrawer: React.FC<RoomDrawerProps> = ({ isOpen, onClose }) => {
  const { activeRoom, roomMembers, kickUser, messages } = useSocket();
  const { addToast } = useToast();
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const currentUsername = activeRoom?.username || '';
  const currentMember = roomMembers.find(
    (m) => m.username.toLowerCase() === currentUsername.toLowerCase()
  );
  const isOwner = currentMember?.isOwner || false;

  const handleCopyCode = () => {
    if (!activeRoom?.code) return;
    navigator.clipboard.writeText(activeRoom.code);
    setCopiedCode(true);
    addToast('Room code copied!', 'info');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Filter image attachments sent in room
  const imageAttachments = messages.filter(
    (m) => m.type === 'image' && m.attachmentUrl
  );

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-80 bg-[var(--bg-surface)] border-l border-[var(--border-color)] flex flex-col shadow-2xl transition-transform duration-300">
      {/* Header */}
      <div className="h-16 px-4 bg-[var(--bg-header)] flex items-center justify-between border-b border-[var(--border-color)] shrink-0">
        <h3 className="font-bold text-sm text-[var(--text-primary)]">Room Details</h3>
        <button
          onClick={onClose}
          type="button"
          className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Room Avatar & Name Hero */}
        <div className="flex flex-col items-center text-center pb-4 border-b border-[var(--border-color)]">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-500 border-2 border-emerald-500/40 flex items-center justify-center font-bold text-2xl mb-3 shadow-md">
            <Hash className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{activeRoom?.name}</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Created room chat</p>

          <button
            onClick={handleCopyCode}
            type="button"
            className="mt-3 flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 transition-colors shadow-xs"
          >
            {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>CODE: {activeRoom?.code}</span>
          </button>
        </div>

        {/* Members List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-500" /> Members ({roomMembers.length})
            </h4>
          </div>

          <div className="space-y-2">
            {roomMembers.map((member) => (
              <div
                key={member.username}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs"
                      style={{ background: getAvatarColor(member.username) }}
                    >
                      {member.username.substring(0, 2).toUpperCase()}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-surface)] ${
                        member.status === 'online' ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold truncate text-[var(--text-primary)]">
                        {member.username}
                      </span>
                      {member.isOwner && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-400">
                          OWNER
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {member.status === 'online' ? 'Active' : 'Offline'}
                    </span>
                  </div>
                </div>

                {/* Kick Action (Owner only & cannot kick self) */}
                {isOwner && !member.isOwner && (
                  <button
                    onClick={() => kickUser(member.username)}
                    type="button"
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                    title={`Kick ${member.username}`}
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Shared Media Gallery */}
        {imageAttachments.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-3 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-emerald-500" /> Shared Media ({imageAttachments.length})
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {imageAttachments.slice(0, 6).map((img, idx) => (
                <a
                  key={idx}
                  href={img.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-square rounded-xl overflow-hidden border border-black/10 hover:opacity-80 transition-opacity"
                >
                  <img
                    src={img.attachmentUrl}
                    alt="shared media"
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
