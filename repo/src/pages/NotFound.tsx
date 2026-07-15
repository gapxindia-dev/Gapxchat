import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const NotFound: React.FC<{ onHome: () => void }> = ({ onHome }) => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-slate-950 text-slate-100">
      
      {/* Background radial glow */}
      <div className="absolute w-[50%] h-[50%] bg-violet-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="glass-panel max-w-md p-8 rounded-2xl text-center shadow-2xl border border-slate-800 z-10">
        <div className="h-16 w-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
          <ShieldAlert className="h-8 w-8" />
        </div>
        
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">404: Not Found</h1>
        <p className="text-sm text-slate-400 mb-8">
          The private chat room you are trying to access does not exist, has expired, or has been deleted by its administrator.
        </p>

        <button
          onClick={onHome}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-semibold flex items-center justify-center gap-2 hover:from-violet-500 hover:to-pink-400 transition-colors shadow-lg shadow-violet-600/10"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Landing Page
        </button>
      </div>
    </div>
  );
};
