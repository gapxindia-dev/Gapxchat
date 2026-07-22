import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Shield, Users, Zap, Clock, Key, ArrowRight,
  Moon, Sun, X, Eye, EyeOff, ChevronDown, Lock, Sparkles, CheckCircle2, Mic, Paperclip
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { useToast } from '../components/Toast.js';

export const LandingPage: React.FC = () => {
  const { connectToRoom } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();

  // Modal state
  const [activeModal, setActiveModal] = useState<'create' | 'join' | null>(null);

  // Create Room form
  const [createUsername, setCreateUsername] = useState('');
  const [createRoomName, setCreateRoomName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createShowPassword, setCreateShowPassword] = useState(false);
  const [createAutoDelete, setCreateAutoDelete] = useState('24');
  const [createLoading, setCreateLoading] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  // Join Room form
  const [joinCode, setJoinCode] = useState('');
  const [joinUsername, setJoinUsername] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [joinShowPassword, setJoinShowPassword] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinErrors, setJoinErrors] = useState<Record<string, string>>({});
  const [joinStep, setJoinStep] = useState<1 | 2>(1);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [roomNameFound, setRoomNameFound] = useState('');

  // Validation helpers
  const validateCreate = () => {
    const errors: Record<string, string> = {};
    if (!createUsername.trim()) errors.username = 'Username is required.';
    else if (createUsername.trim().length < 2) errors.username = 'At least 2 characters.';
    if (!createRoomName.trim()) errors.roomName = 'Room name is required.';
    return errors;
  };

  const validateJoinStep1 = () => {
    const errors: Record<string, string> = {};
    if (!joinCode.trim()) errors.code = 'Room code is required.';
    else if (joinCode.trim().length < 4) errors.code = 'Enter a valid room code.';
    return errors;
  };

  const validateJoinStep2 = () => {
    const errors: Record<string, string> = {};
    if (!joinUsername.trim()) errors.username = 'Username is required.';
    else if (joinUsername.trim().length < 2) errors.username = 'At least 2 characters.';
    if (requiresPassword && !joinPassword.trim()) errors.password = 'This room requires a password.';
    return errors;
  };

  // Handler: Create Room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateCreate();
    if (Object.keys(errors).length > 0) { setCreateErrors(errors); return; }
    setCreateErrors({});
    setCreateLoading(true);

    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomName: createRoomName,
          password: createPassword,
          ownerUsername: createUsername,
          autoDeleteHours: Number(createAutoDelete),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create room');

      addToast(`Room "${createRoomName}" created! Joining...`, 'success');
      connectToRoom(data.token, data.room.code, data.room.name || createRoomName);
    } catch (err: any) {
      addToast(err.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  // Handler: Verify Room Code (Join Step 1)
  const handleVerifyRoomCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateJoinStep1();
    if (Object.keys(errors).length > 0) { setJoinErrors(errors); return; }
    setJoinErrors({});
    setJoinLoading(true);

    try {
      const response = await fetch('/api/rooms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.toUpperCase().trim() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Invalid room code');

      setRoomNameFound(data.name);
      setRequiresPassword(data.requiresPassword);
      setJoinStep(2);
    } catch (err: any) {
      setJoinErrors({ code: err.message || 'Room not found.' });
    } finally {
      setJoinLoading(false);
    }
  };

  // Handler: Submit Join (Join Step 2)
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateJoinStep2();
    if (Object.keys(errors).length > 0) { setJoinErrors(errors); return; }
    setJoinErrors({});
    setJoinLoading(true);

    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: joinCode.toUpperCase().trim(),
          username: joinUsername,
          password: joinPassword,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to join room');

      addToast(`Joined "${roomNameFound}"! Loading chat...`, 'success');
      connectToRoom(data.token, data.room.code, data.room.name || roomNameFound);
    } catch (err: any) {
      addToast(err.message || 'Authentication failed.', 'error');
    } finally {
      setJoinLoading(false);
    }
  };

  const resetJoinForm = () => {
    setJoinStep(1);
    setJoinCode('');
    setJoinUsername('');
    setJoinPassword('');
    setRequiresPassword(false);
    setJoinErrors({});
    setRoomNameFound('');
  };

  const closeModal = () => {
    setActiveModal(null);
    setCreateErrors({});
    resetJoinForm();
  };

  const features = [
    { icon: Clock, title: 'Self-Destructing', desc: 'Rooms automatically delete after expiration' },
    { icon: Key, title: 'Password Gated', desc: 'Optional PIN security for your private channels' },
    { icon: Zap, title: 'Real-Time Voice Mesh', desc: 'Crystal-clear peer-to-peer audio calls' },
    { icon: Users, title: 'Rich Media & Reactions', desc: 'Share files, GIFs, voice notes & emojis' },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden transition-colors duration-300"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* Ambient background glow orbs */}
      <div className="bg-orb w-[650px] h-[650px] bg-cyan-500 top-[-220px] left-[-160px]" />
      <div className="bg-orb w-[550px] h-[550px] bg-indigo-600 bottom-[-120px] right-[-120px]" />
      <div className="bg-orb w-[350px] h-[350px] bg-blue-500 top-[45%] left-[25%]" />

      {/* HEADER */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--shadow-brand)' }}>
            <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              GapChat
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(6,182,212,0.12)', color: 'var(--text-brand)', border: '1px solid rgba(6,182,212,0.25)' }}>
              Ephemeral Sandbox
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="icon-btn p-2.5 rounded-xl"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark'
              ? <Sun className="h-5 w-5" />
              : <Moon className="h-5 w-5" />
            }
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">

        {/* Left Column: Branding & Actions */}
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-2xl w-full">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide mb-6"
            style={{
              border: '1px solid rgba(6, 182, 212, 0.3)',
              background: 'rgba(6, 182, 212, 0.08)',
              color: 'var(--text-brand)'
            }}
          >
            <Shield className="h-3.5 w-3.5" />
            Zero Accounts · Zero Logs · 100% Temporary
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] mb-5"
          >
            Bridge the gap with{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Instant Private Rooms.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg leading-relaxed mb-8 max-w-xl"
            style={{ color: 'var(--text-secondary)' }}
          >
            Create disposable, password-protected rooms in seconds. Share text, files, voice notes, and live audio channels without leaving a digital footprint.
          </motion.p>

          {/* Main Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-10"
          >
            <button
              onClick={() => setActiveModal('create')}
              className="btn-primary glow-btn px-7 py-3.5 rounded-2xl text-base font-bold flex items-center justify-center gap-3 w-full sm:w-auto group"
            >
              <Users className="h-5 w-5" />
              Create a Room
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>

            <button
              onClick={() => setActiveModal('join')}
              className="btn-ghost px-7 py-3.5 rounded-2xl text-base font-bold flex items-center justify-center gap-3 w-full sm:w-auto hover:scale-[1.02] transition-transform"
            >
              <Key className="h-5 w-5" style={{ color: 'var(--text-brand)' }} />
              Join with Code
            </button>
          </motion.div>

          {/* Feature Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-2 gap-4 sm:gap-6 w-full pt-2"
          >
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 items-start text-left">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-brand)' }}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</h4>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right Column: Live App Preview Mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex-1 w-full max-w-lg relative"
        >
          {/* Glass Card Container simulating Chat interface */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)' }}>

            {/* Mockup Header */}
            <div className="flex items-center justify-between pb-4 mb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}># Dev Sync Alpha</h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      GAP-982X
                    </span>
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>3 members online · Auto-deletes in 23h</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                <Sparkles className="h-3 w-3" /> Encrypted
              </div>
            </div>

            {/* Mockup Messages Stream */}
            <div className="space-y-3.5 py-2 text-xs">
              {/* Message 1 */}
              <div className="flex items-end gap-2">
                <div className="h-7 w-7 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                  AL
                </div>
                <div className="bubble-them px-3.5 py-2.5 max-w-[80%]">
                  <span className="font-bold text-[11px] block mb-0.5 text-indigo-400">Alex</span>
                  Hey team! Joined the room. Is the new encryption layer deployed? 🚀
                  <span className="text-[9px] block text-right mt-1 text-slate-500">10:42 AM</span>
                </div>
              </div>

              {/* Message 2 (Me) */}
              <div className="flex items-end gap-2 justify-end">
                <div className="bubble-me px-3.5 py-2.5 max-w-[80%]">
                  <span className="font-bold text-[11px] block mb-0.5 text-cyan-300">You</span>
                  Yes! All messages self-destruct after expiry. Voice channel is also active.
                  <span className="text-[9px] block text-right mt-1 text-cyan-400/70">10:43 AM · Read ✓✓</span>
                </div>
              </div>

              {/* Voice Message preview */}
              <div className="flex items-end gap-2">
                <div className="h-7 w-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-[10px]">
                  KA
                </div>
                <div className="bubble-them px-3.5 py-2.5 max-w-[85%]">
                  <span className="font-bold text-[11px] block mb-1 text-emerald-400">Kunal</span>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-black/20 border border-white/5">
                    <button className="h-7 w-7 rounded-full bg-cyan-500 text-white flex items-center justify-center shrink-0">
                      ▶
                    </button>
                    <div className="flex-1">
                      <div className="h-1.5 bg-cyan-500/40 rounded-full w-full overflow-hidden">
                        <div className="h-full bg-cyan-400 w-2/3" />
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 block">🎤 Voice note · 0:14</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mockup Input Box */}
            <div className="mt-4 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-color)' }}>
              <div className="flex-1 px-3.5 py-2 rounded-xl glass-input text-xs text-slate-400 flex items-center justify-between">
                <span>Type a message in #Dev Sync...</span>
                <div className="flex items-center gap-2 text-slate-500">
                  <Paperclip className="h-3.5 w-3.5" />
                  <Mic className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="h-9 w-9 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>

            {/* Badge overlay */}
            <div className="absolute -bottom-4 -right-4 px-4 py-2 rounded-2xl glass-panel-heavy shadow-2xl flex items-center gap-2 text-xs font-bold border border-cyan-500/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Real-Time Socket.io Mesh</span>
            </div>
          </div>
        </motion.div>
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)' }}>
        © {new Date().getFullYear()} GapChat · Secure Ephemeral Rooms · No tracking or storage after expiration
      </footer>

      {/* MODALS */}
      <AnimatePresence>

        {/* ---- CREATE ROOM MODAL ---- */}
        {activeModal === 'create' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="glass-panel-heavy rounded-3xl w-full max-w-md relative z-10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'var(--brand-gradient)', color: 'white' }}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Create Private Room</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Get a unique shareable invite code</p>
                  </div>
                </div>
                <button onClick={closeModal} className="icon-btn p-2 rounded-xl" aria-label="Close modal">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateRoom} className="px-6 py-5 space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}>
                    Your Username <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex"
                    value={createUsername}
                    onChange={(e) => { setCreateUsername(e.target.value); setCreateErrors(p => ({ ...p, username: '' })); }}
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-sm"
                  />
                  {createErrors.username && (
                    <p className="text-xs text-red-400 mt-1">{createErrors.username}</p>
                  )}
                </div>

                {/* Room Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}>
                    Room Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Product Design Huddle"
                    value={createRoomName}
                    onChange={(e) => { setCreateRoomName(e.target.value); setCreateErrors(p => ({ ...p, roomName: '' })); }}
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-sm"
                  />
                  {createErrors.roomName && (
                    <p className="text-xs text-red-400 mt-1">{createErrors.roomName}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 flex items-center justify-between"
                    style={{ color: 'var(--text-secondary)' }}>
                    <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> Password Protection <span className="font-normal normal-case opacity-70">(optional)</span></span>
                  </label>
                  <div className="relative">
                    <input
                      type={createShowPassword ? 'text' : 'password'}
                      placeholder="Leave blank for public entry"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      className="w-full px-4 py-2.5 pr-11 rounded-xl glass-input text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setCreateShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {createShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Auto-delete */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}>
                    Auto-Delete Room After
                  </label>
                  <div className="relative">
                    <select
                      value={createAutoDelete}
                      onChange={(e) => setCreateAutoDelete(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 rounded-xl glass-input text-sm appearance-none cursor-pointer"
                    >
                      <option value="1">1 Hour (Quick Test)</option>
                      <option value="12">12 Hours</option>
                      <option value="24">24 Hours (Standard)</option>
                      <option value="48">48 Hours</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                      style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-ghost flex-1 py-3 text-sm font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="btn-primary glow-btn flex-1 py-3 text-sm font-bold rounded-xl"
                  >
                    {createLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Creating...
                      </span>
                    ) : 'Create Room'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* ---- JOIN ROOM MODAL ---- */}
        {activeModal === 'join' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="glass-panel-heavy rounded-3xl w-full max-w-md relative z-10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)', color: 'white' }}>
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Join Chat Room</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {joinStep === 1 ? 'Enter the invitation code' : `Found room: "${roomNameFound}"`}
                    </p>
                  </div>
                </div>
                <button onClick={closeModal} className="icon-btn p-2 rounded-xl" aria-label="Close modal">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Step indicator */}
              <div className="px-6 pt-4 flex items-center gap-3">
                {[1, 2].map((step) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      joinStep === step
                        ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30'
                        : step < joinStep
                          ? 'bg-emerald-500 text-white'
                          : 'text-xs font-medium'
                    }`}
                      style={joinStep !== step && step >= joinStep ? { background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' } : {}}>
                      {step < joinStep ? '✓' : step}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: step === joinStep ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {step === 1 ? 'Room Code' : 'Credentials'}
                    </span>
                    {step < 2 && <div className="h-px w-6 ml-1" style={{ background: 'var(--border-color)' }} />}
                  </div>
                ))}
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                <AnimatePresence mode="wait">
                  {joinStep === 1 && (
                    <motion.form
                      key="step1"
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -15 }}
                      onSubmit={handleVerifyRoomCode}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>
                          Enter 6-Character Code <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="e.g. X9K2M4"
                          value={joinCode}
                          onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinErrors(p => ({ ...p, code: '' })); }}
                          className="w-full px-4 py-3 rounded-2xl glass-input text-xl font-bold text-center tracking-[0.35em] uppercase font-mono"
                          maxLength={10}
                        />
                        {joinErrors.code && (
                          <p className="text-xs text-red-400 mt-1.5">{joinErrors.code}</p>
                        )}
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={closeModal} className="btn-ghost flex-1 py-3 text-sm font-bold rounded-xl">
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={joinLoading}
                          className="btn-primary glow-btn flex-1 py-3 text-sm font-bold rounded-xl"
                        >
                          {joinLoading ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Searching...
                            </span>
                          ) : 'Find Room →'}
                        </button>
                      </div>
                    </motion.form>
                  )}

                  {joinStep === 2 && (
                    <motion.form
                      key="step2"
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 15 }}
                      onSubmit={handleJoinRoom}
                      className="space-y-4"
                    >
                      {/* Room banner */}
                      <div className="p-3.5 rounded-2xl flex items-center gap-3"
                        style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)' }}>
                        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-cyan-500/20 text-cyan-400 font-bold">
                          <MessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-tertiary)' }}>Target Room</p>
                          <p className="font-extrabold text-sm" style={{ color: 'var(--text-brand)' }}>{roomNameFound}</p>
                        </div>
                        {requiresPassword && (
                          <div className="ml-auto flex items-center gap-1 text-xs text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                            <Lock className="h-3 w-3" /> Password
                          </div>
                        )}
                      </div>

                      {/* Username */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>
                          Your Display Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="e.g. Jordan"
                          value={joinUsername}
                          onChange={(e) => { setJoinUsername(e.target.value); setJoinErrors(p => ({ ...p, username: '' })); }}
                          className="w-full px-4 py-2.5 rounded-xl glass-input text-sm"
                        />
                        {joinErrors.username && (
                          <p className="text-xs text-red-400 mt-1">{joinErrors.username}</p>
                        )}
                      </div>

                      {/* Password */}
                      {requiresPassword && (
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                            style={{ color: 'var(--text-secondary)' }}>
                            Room Password <span className="text-red-400">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type={joinShowPassword ? 'text' : 'password'}
                              required
                              placeholder="Enter room password"
                              value={joinPassword}
                              onChange={(e) => { setJoinPassword(e.target.value); setJoinErrors(p => ({ ...p, password: '' })); }}
                              className="w-full px-4 py-2.5 pr-11 rounded-xl glass-input text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setJoinShowPassword(p => !p)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded"
                              style={{ color: 'var(--text-tertiary)' }}
                            >
                              {joinShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {joinErrors.password && (
                            <p className="text-xs text-red-400 mt-1">{joinErrors.password}</p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => { setJoinStep(1); setJoinErrors({}); }}
                          className="btn-ghost flex-1 py-3 text-sm font-bold rounded-xl">
                          ← Back
                        </button>
                        <button
                          type="submit"
                          disabled={joinLoading}
                          className="btn-primary glow-btn flex-1 py-3 text-sm font-bold rounded-xl"
                        >
                          {joinLoading ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Joining...
                            </span>
                          ) : 'Enter Room'}
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
};
