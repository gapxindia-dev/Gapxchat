import React, { useState } from 'react';
import {
  Search, Moon, Sun, LogOut, Copy, Check, Plus, Hash
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { useToast } from './Toast.js';

interface SidebarProps {
  isOpen: boolean;
  onCloseMobile?: () => void;
  onOpenRoomModal?: () => void;
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

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onOpenRoomModal }) => {
  const { activeRoom, roomMembers, disconnectFromRoom } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const username = activeRoom?.username || 'User';

  const handleCopyCode = () => {
    if (!activeRoom?.code) return;
    navigator.clipboard.writeText(activeRoom.code);
    setCopiedCode(true);
    addToast('Room code copied to clipboard!', 'info');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const filteredMembers = roomMembers.filter((m) =>
    m.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-80 bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col transition-transform duration-300 md:static md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Top Sidebar Header */}
      <div className="h-16 px-4 bg-[var(--bg-header)] flex items-center justify-between border-b border-[var(--border-color)] shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm"
            style={{ background: getAvatarColor(username) }}
          >
            {username.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate text-[var(--text-primary)]">{username}</h2>
            <p className="text-[11px] text-emerald-500 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Online
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            type="button"
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <button
            onClick={disconnectFromRoom}
            type="button"
            className="p-2 rounded-full hover:bg-red-500/10 text-red-400 transition-colors"
            title="Leave room"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Active Room Card */}
      <div className="p-3 border-b border-[var(--border-color)] bg-black/5 dark:bg-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Active Chat Room
          </span>
          {onOpenRoomModal && (
            <button
              onClick={onOpenRoomModal}
              className="text-xs text-emerald-500 hover:underline font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Switch Room
            </button>
          )}
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <Hash className="w-4 h-4 text-emerald-500 shrink-0" />
              <h3 className="font-bold text-sm truncate text-[var(--text-primary)]">
                {activeRoom?.name || 'General Chat'}
              </h3>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
              {roomMembers.length} online
            </span>
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-color)]">
            <span className="text-xs font-mono text-[var(--text-tertiary)]">
              Code: <strong className="text-[var(--text-primary)] tracking-wide">{activeRoom?.code}</strong>
            </span>
            <button
              onClick={handleCopyCode}
              type="button"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-xs font-medium transition-colors"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCode ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-[var(--border-color)]">
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-tertiary)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--bg-input)] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] border border-[var(--border-input)] focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Member List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1 text-xs font-semibold text-[var(--text-tertiary)] flex justify-between items-center">
          <span>ROOM MEMBERS ({filteredMembers.length})</span>
        </div>

        {filteredMembers.map((member) => (
          <div
            key={member.username}
            className="flex items-center justify-between p-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-sm"
                  style={{ background: getAvatarColor(member.username) }}
                >
                  {member.username.substring(0, 2).toUpperCase()}
                </div>
                <span
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-sidebar)] ${
                    member.status === 'online' ? 'bg-emerald-500' : 'bg-gray-400'
                  }`}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold truncate text-[var(--text-primary)]">
                    {member.username}
                  </span>
                  {member.isOwner && (
                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-400">
                      OWNER
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] truncate">
                  {member.status === 'online' ? 'Active now' : 'Offline'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
