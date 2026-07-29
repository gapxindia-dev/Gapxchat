import React, { useState } from 'react';
import {
  MessageSquare, ArrowRight, Moon, Sun, Sparkles, Zap
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { useToast } from '../components/Toast.js';

export const LandingPage: React.FC = () => {
  const { connectToRoom } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<'join' | 'create'>('join');

  // Form states
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [loading, setLoading] = useState(false);

  // Quick Demo Room handler
  const handleQuickDemo = async () => {
    setLoading(true);
    const demoUsername = `User_${Math.floor(1000 + Math.random() * 9000)}`;
    const demoRoomName = `Demo Room`;

    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: demoRoomName,
          ownerUsername: demoUsername,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create demo room');

      addToast(`Joined Demo Room as ${demoUsername}!`, 'success');
      connectToRoom(data.token, data.room.code, data.room.name);
    } catch (err: any) {
      addToast(err.message || 'Could not launch demo room', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Submit Join Form
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomCode.trim()) {
      addToast('Please enter both your username and room code.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: roomCode.trim(),
          username: username.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join room');
      }

      addToast(`Connected to room ${data.room.name}!`, 'success');
      connectToRoom(data.token, data.room.code, data.room.name);
    } catch (err: any) {
      addToast(err.message || 'Failed to join room', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Submit Create Form
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomName.trim()) {
      addToast('Please enter both your username and a room name.', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: roomName.trim(),
          ownerUsername: username.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create room');

      addToast(`Room "${data.room.name}" created!`, 'success');
      connectToRoom(data.token, data.room.code, data.room.name);
    } catch (err: any) {
      addToast(err.message || 'Failed to create room', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between selection:bg-emerald-500/30">
      
      {/* Top Navbar */}
      <nav className="h-16 px-6 max-w-6xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <MessageSquare className="w-5 h-5 fill-white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-[var(--text-primary)]">
            Gap<span className="text-emerald-500">Chat</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            type="button"
            className="p-2.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Main Content Body */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">
          
          {/* Header Tagline */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-3 border border-emerald-500/20">
              <Zap className="w-3.5 h-3.5" /> Instant & Minimal Messaging
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Connect. Chat. Simple.
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-2">
              WhatsApp minimalist design with Voice Notes, file sharing, and instant room codes.
            </p>
          </div>

          {/* Card Container */}
          <div className="p-6 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xl relative overflow-hidden backdrop-blur-xl">
            
            {/* Tab Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-black/10 dark:bg-white/5 mb-6 border border-[var(--border-color)]">
              <button
                onClick={() => setActiveTab('join')}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                  activeTab === 'join'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Join Room
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`py-2.5 text-xs font-bold rounded-xl transition-all ${
                  activeTab === 'create'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Create Room
              </button>
            </div>

            {/* Forms */}
            {activeTab === 'join' ? (
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alex"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] text-sm text-[var(--text-primary)] border border-[var(--border-input)] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Room Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. X9K2LM"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] text-sm font-mono tracking-widest text-[var(--text-primary)] border border-[var(--border-input)] focus:outline-none focus:border-emerald-500 uppercase"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-transform active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Joining Room...' : 'Join Chat Room'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Your Display Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] text-sm text-[var(--text-primary)] border border-[var(--border-input)] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                    Room Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Project Discussion"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] text-sm text-[var(--text-primary)] border border-[var(--border-input)] focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-transform active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Creating Room...' : 'Create Instant Room'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            )}

            {/* Divider & Quick Demo Launcher */}
            <div className="mt-6 pt-5 border-t border-[var(--border-color)] flex flex-col items-center">
              <span className="text-[11px] text-[var(--text-tertiary)] mb-2">Want to test right now?</span>
              <button
                onClick={handleQuickDemo}
                disabled={loading}
                type="button"
                className="w-full py-2.5 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/15 text-[var(--text-primary)] font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" /> Launch Quick Demo Room
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[var(--text-tertiary)] border-t border-[var(--border-color)]">
        GapChat Minimalist Messaging App &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};
