import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { Message } from '../contexts/SocketContext.js';
import { MessageItem } from './MessageItem.js';

interface MessageListProps {
  messages: Message[];
  currentUsername: string;
  isOwner?: boolean;
  typingUsers: string[];
  onReply: (msg: Message) => void;
  onImageClick?: (url: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUsername,
  isOwner,
  typingUsers,
  onReply,
  onImageClick,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  // Scroll to bottom on initial render and on new messages
  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBottom(isUp);
  };

  // Helper to group messages by date
  const formatDateHeader = (timestampStr: string) => {
    try {
      const date = new Date(timestampStr);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) return 'TODAY';
      if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="relative flex-1 min-h-0 bg-[var(--bg-base)]">
      {/* Scrollable messages container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto py-4 px-2 sm:px-4 space-y-1"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
              👋
            </div>
            <h3 className="font-bold text-base text-[var(--text-primary)]">No messages yet</h3>
            <p className="text-xs text-[var(--text-tertiary)] max-w-xs mt-1">
              Be the first to send a message or voice note in this room!
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const dateStr = formatDateHeader(message.timestamp);
            const prevMessage = messages[index - 1];
            const prevDateStr = prevMessage ? formatDateHeader(prevMessage.timestamp) : null;
            const showDateHeader = dateStr && dateStr !== prevDateStr;

            return (
              <React.Fragment key={message.id || index}>
                {showDateHeader && (
                  <div className="flex justify-center my-4">
                    <span className="px-3 py-1 rounded-full bg-black/20 dark:bg-white/10 text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider shadow-xs">
                      {dateStr}
                    </span>
                  </div>
                )}

                <MessageItem
                  message={message}
                  currentUsername={currentUsername}
                  isOwner={isOwner}
                  onReply={onReply}
                  onImageClick={onImageClick}
                />
              </React.Fragment>
            );
          })
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 my-2 px-4 text-xs text-emerald-500 font-medium animate-pulse">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce delay-200"></span>
            </div>
            <span>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}
      </div>

      {/* Floating Scroll-to-Bottom button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom(true)}
          type="button"
          className="absolute bottom-4 right-4 p-2.5 rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600 transition-transform active:scale-90 z-30"
          title="Scroll to latest messages"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
