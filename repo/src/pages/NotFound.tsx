import React from 'react';
import { MessageSquareOff, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC<{ onHome: () => void }> = ({ onHome }) => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-300"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      
      {/* Background radial glow */}
      <div className="bg-orb w-[500px] h-[500px] bg-cyan-500 top-[25%] left-[25%]" />

      <div className="glass-panel max-w-md p-8 rounded-3xl text-center shadow-2xl z-10"
        style={{ background: 'var(--bg-modal)', border: '1px solid var(--border-strong)' }}>
        <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <MessageSquareOff className="h-8 w-8" />
        </div>
        
        <h1 className="text-3xl font-black tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>Room Not Found</h1>
        <p className="text-sm leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
          The GapChat room you are trying to access does not exist, has expired, or was auto-deleted.
        </p>

        <button
          onClick={onHome}
          className="btn-primary glow-btn w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to GapChat
        </button>
      </div>
    </div>
  );
};
