import React, { useState } from 'react';
import { Menu, Hash, Copy, Check, Search, Info, LogOut } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext.js';
import { useToast } from './Toast.js';

interface ChatHeaderProps {
  onToggleSidebar: () => void;
  onToggleDrawer: () => void;
  onToggleSearch?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleSidebar,
  onToggleDrawer,
  onToggleSearch,
}) => {
  const { activeRoom, roomMembers, disconnectFromRoom } = useSocket();
  const { addToast } = useToast();
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    if (!activeRoom?.code) return;
    navigator.clipboard.writeText(activeRoom.code);
    setCopiedCode(true);
    addToast('Room code copied!', 'info');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <header className="h-16 px-4 bg-[var(--bg-header)] border-b border-[var(--border-color)] flex items-center justify-between shrink-0 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu trigger button */}
        <button
          onClick={onToggleSidebar}
          type="button"
          className="md:hidden p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Room Avatar & Info */}
        <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={onToggleDrawer}>
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
            <Hash className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold truncate text-[var(--text-primary)]">
                {activeRoom?.name || 'General Chat'}
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] truncate flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              {roomMembers.length} member{roomMembers.length === 1 ? '' : 's'} online
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons Header */}
      <div className="flex items-center gap-1.5">
        {/* Quick Room Code Pill */}
        <button
          onClick={handleCopyCode}
          type="button"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition-colors"
          title="Copy room code"
        >
          {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{activeRoom?.code}</span>
        </button>

        {/* Search inside chat button */}
        {onToggleSearch && (
          <button
            onClick={onToggleSearch}
            type="button"
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
            title="Search in conversation"
          >
            <Search className="w-5 h-5" />
          </button>
        )}

        {/* Room Info Drawer Toggle */}
        <button
          onClick={onToggleDrawer}
          type="button"
          className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
          title="Room Details"
        >
          <Info className="w-5 h-5" />
        </button>

        {/* Leave Room Button */}
        <button
          onClick={disconnectFromRoom}
          type="button"
          className="p-2 rounded-full hover:bg-red-500/10 text-red-400 transition-colors"
          title="Exit Room"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
