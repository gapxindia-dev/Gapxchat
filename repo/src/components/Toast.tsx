import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

// ============================================================
// Toast Types & Context
// ============================================================
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ============================================================
// Toast Item Component
// ============================================================
const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 280);
  }, [toast.id, onRemove]);

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const timer = setTimeout(handleRemove, duration);
    return () => clearTimeout(timer);
  }, [toast.duration, handleRemove]);

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="h-5 w-5 shrink-0" />,
    error: <XCircle className="h-5 w-5 shrink-0" />,
    warning: <AlertCircle className="h-5 w-5 shrink-0" />,
    info: <Info className="h-5 w-5 shrink-0" />,
  };

  const colorMap: Record<ToastType, { bg: string; icon: string; bar: string }> = {
    success: {
      bg: 'bg-emerald-950/90 border-emerald-500/30',
      icon: 'text-emerald-400',
      bar: 'bg-emerald-500',
    },
    error: {
      bg: 'bg-red-950/90 border-red-500/30',
      icon: 'text-red-400',
      bar: 'bg-red-500',
    },
    warning: {
      bg: 'bg-amber-950/90 border-amber-500/30',
      icon: 'text-amber-400',
      bar: 'bg-amber-500',
    },
    info: {
      bg: 'bg-violet-950/90 border-violet-500/30',
      icon: 'text-violet-400',
      bar: 'bg-violet-500',
    },
  };

  const colors = colorMap[toast.type];
  const duration = toast.duration ?? 4000;

  return (
    <div
      className={`relative w-full max-w-sm pointer-events-auto rounded-xl border backdrop-blur-xl overflow-hidden shadow-2xl ${colors.bg} ${isExiting ? 'toast-exit' : 'toast-enter'}`}
      style={{ minWidth: '280px' }}
    >
      {/* Content */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={colors.icon}>{icons[toast.type]}</span>
        <p className="flex-1 text-sm font-medium text-slate-100 leading-snug">{toast.message}</p>
        <button
          onClick={handleRemove}
          className="ml-1 p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors shrink-0"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${colors.bar} rounded-full`}
        style={{
          animation: `shrink-bar ${duration}ms linear forwards`,
          transformOrigin: 'left',
        }}
      />
      <style>{`
        @keyframes shrink-bar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

// ============================================================
// Toast Provider
// ============================================================
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen for global events dispatched by SocketContext
  useEffect(() => {
    const handleKicked = (e: Event) => {
      const reason = (e as CustomEvent).detail?.reason || 'You were removed from this room.';
      addToast(`⚠️ ${reason}`, 'warning', 6000);
    };

    const handleError = (e: Event) => {
      const message = (e as CustomEvent).detail?.message || 'An error occurred.';
      addToast(message, 'error');
    };

    window.addEventListener('chat:kicked', handleKicked);
    window.addEventListener('chat:error', handleError);

    return () => {
      window.removeEventListener('chat:kicked', handleKicked);
      window.removeEventListener('chat:error', handleError);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      {/* Toast Container */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: 'calc(100vw - 2rem)' }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ============================================================
// Hook
// ============================================================
// eslint-disable-next-line react/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
