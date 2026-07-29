import React, { useState, useRef } from 'react';
import {
  Send, Smile, Paperclip, Mic, X, Trash2, Image, FileText
} from 'lucide-react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import type { Message } from '../contexts/SocketContext.js';
import { useAudioRecorder } from '../hooks/useAudioRecorder.js';
import { useTheme } from '../contexts/ThemeContext.js';

interface ChatInputProps {
  onSendMessage: (
    content: string,
    type?: Message['type'],
    attachment?: { url: string; name: string; size: number }
  ) => void;
  replyToMessage: Message | null;
  onCancelReply: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  replyToMessage,
  onCancelReply,
}) => {
  const { theme } = useTheme();
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const handleSendText = () => {
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText('');
    setShowEmojiPicker(false);
    if (replyToMessage) onCancelReply();

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleEmojiSelect = (emojiData: any) => {
    setText((prev) => prev + emojiData.native);
  };

  // Upload file helper
  const uploadFile = async (file: File, type: Message['type']) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('chat_token');
      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error('File upload failed');
      const data = await res.json();

      onSendMessage('', type, {
        url: data.file.url,
        name: data.file.name,
        size: data.file.size,
      });
      setShowAttachMenu(false);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: Message['type']) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0], type);
    }
  };

  // Handle Voice Note Send
  const handleStopAndSendVoice = async () => {
    const audioBlob = await stopRecording();
    if (!audioBlob) return;

    setIsUploading(true);
    try {
      const file = new File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('chat_token');
      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Voice note upload failed');
      const data = await res.json();

      onSendMessage('', 'voice', {
        url: data.file.url,
        name: 'Voice Message',
        size: data.file.size,
      });
    } catch (err) {
      console.error('Voice send error:', err);
      alert('Could not send voice note.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatRecTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <footer className="relative px-3 py-2 bg-[var(--bg-header)] border-t border-[var(--border-color)] shrink-0 z-30">
      
      {/* Reply Banner preview */}
      {replyToMessage && (
        <div className="flex items-center justify-between p-2 mb-2 rounded-xl bg-black/20 dark:bg-white/10 border-l-4 border-emerald-500 text-xs">
          <div className="min-w-0">
            <span className="font-bold text-emerald-400">Replying to {replyToMessage.sender}</span>
            <p className="truncate text-gray-300">{replyToMessage.content || '[Media Attachment]'}</p>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-full hover:bg-black/20 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Emoji Mart Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-full mb-2 left-4 z-50 shadow-2xl rounded-2xl overflow-hidden">
          <Picker
            data={data}
            onEmojiSelect={handleEmojiSelect}
            theme={theme === 'dark' ? 'dark' : 'light'}
          />
        </div>
      )}

      {/* Attachment Options Popover */}
      {showAttachMenu && (
        <div className="absolute bottom-full mb-2 left-12 flex gap-2 p-2 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)] shadow-xl z-50">
          <button
            onClick={() => imageInputRef.current?.click()}
            type="button"
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold text-emerald-400 transition-colors"
          >
            <Image className="w-4 h-4" /> Photo & Video
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            type="button"
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold text-sky-400 transition-colors"
          >
            <FileText className="w-4 h-4" /> Document
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*,video/*"
        onChange={(e) => handleFileChange(e, 'image')}
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileChange(e, 'file')}
        className="hidden"
      />

      {/* Main Input Row */}
      <div className="flex items-center gap-2">
        {isRecording ? (
          /* Voice Recording Mode bar */
          <div className="flex-1 flex items-center justify-between px-4 py-2.5 rounded-full bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-xs font-mono font-bold text-red-400">
                Recording {formatRecTime(recordingTime)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={cancelRecording}
                type="button"
                className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400 transition-colors"
                title="Cancel Voice Note"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleStopAndSendVoice}
                type="button"
                className="px-3 py-1.5 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow hover:bg-emerald-600 transition-transform active:scale-95"
              >
                <Send className="w-3.5 h-3.5" /> Send Voice
              </button>
            </div>
          </div>
        ) : (
          /* Normal Messaging Bar */
          <>
            {/* Attachment Button */}
            <button
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              type="button"
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors shrink-0"
              title="Attach File"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Emoji Button */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              type="button"
              className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors shrink-0"
              title="Emojis"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Textarea */}
            <div className="flex-1 min-w-0 relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="w-full px-4 py-2.5 rounded-2xl bg-[var(--bg-input)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] border border-[var(--border-input)] focus:outline-none focus:border-emerald-500 resize-none max-h-32 leading-relaxed"
              />
            </div>

            {/* Send OR Record Mic Button */}
            {text.trim() ? (
              <button
                onClick={handleSendText}
                disabled={isUploading}
                type="button"
                className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95 disabled:opacity-50"
                title="Send Message"
              >
                <Send className="w-4 h-4 fill-white ml-0.5" />
              </button>
            ) : (
              <button
                onClick={startRecording}
                type="button"
                className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-xs transition-colors"
                title="Record Voice Note"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </>
        )}
      </div>
    </footer>
  );
};
