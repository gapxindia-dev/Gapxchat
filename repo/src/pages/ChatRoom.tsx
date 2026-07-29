import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext.js';
import type { Message } from '../contexts/SocketContext.js';
import { Sidebar } from '../components/Sidebar.js';
import { ChatHeader } from '../components/ChatHeader.js';
import { MessageList } from '../components/MessageList.js';
import { ChatInput } from '../components/ChatInput.js';
import { RoomDrawer } from '../components/RoomDrawer.js';

export const ChatRoom: React.FC = () => {
  const {
    activeRoom,
    roomMembers,
    typingUsers,
    messages,
    sendMessage,
    markMessagesRead,
  } = useSocket();

  // Layout drawers & modals state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // In-chat search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentUsername = activeRoom?.username || '';
  const currentMember = roomMembers.find(
    (m) => m.username.toLowerCase() === currentUsername.toLowerCase()
  );
  const isOwner = currentMember?.isOwner || false;

  // Mark messages as read when active
  useEffect(() => {
    if (messages.length > 0) {
      markMessagesRead();
    }
  }, [messages.length, markMessagesRead]);

  // Filter messages if search is active
  const displayedMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.content?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const handleSendMessage = (
    content: string,
    type?: Message['type'],
    attachment?: { url: string; name: string; size: number }
  ) => {
    sendMessage(content, type, attachment);
    setReplyToMessage(null);
  };

  return (
    <div className="h-screen w-screen flex bg-[var(--bg-base)] overflow-hidden font-sans select-none">
      
      {/* WhatsApp Left Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onCloseMobile={() => setIsSidebarOpen(false)}
      />

      {/* Mobile Sidebar backdrop overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      {/* Main Conversation Pane */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Header */}
        <ChatHeader
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
          onToggleSearch={() => setShowSearch(!showSearch)}
        />

        {/* Search Bar Overlay */}
        {showSearch && (
          <div className="px-4 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-color)] flex items-center gap-2">
            <Search className="w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search in chat messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="p-1 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Messages Feed */}
        <MessageList
          messages={displayedMessages}
          currentUsername={currentUsername}
          isOwner={isOwner}
          typingUsers={typingUsers}
          onReply={(msg) => setReplyToMessage(msg)}
          onImageClick={(url) => setLightboxImage(url)}
        />

        {/* Messaging Input Footer */}
        <ChatInput
          onSendMessage={handleSendMessage}
          replyToMessage={replyToMessage}
          onCancelReply={() => setReplyToMessage(null)}
        />
      </div>

      {/* WhatsApp Right Room Info Drawer */}
      <RoomDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* Image Lightbox Preview Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-md"
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Full Preview"
            className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
