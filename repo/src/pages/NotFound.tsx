import React from 'react';
import { MessageSquareOff, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC<{ onHome: () => void }> = ({ onHome }) => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div className="max-w-md w-full p-8 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl text-center">
        <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <MessageSquareOff className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-extrabold mb-2 text-[var(--text-primary)]">
          Room Not Found
        </h1>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-6">
          The chat room you are looking for does not exist, has expired, or was auto-deleted due to inactivity.
        </p>

        <button
          onClick={onHome}
          className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Home
        </button>
      </div>
    </div>
  );
};
