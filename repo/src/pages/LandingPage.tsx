import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Users, Zap, Clock, Key, ArrowRight,
  Moon, Sun, X, Eye, EyeOff, ChevronDown, Lock
} from 'lucide-react';
import { useSocket } from '../contexts/SocketContext.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { useToast } from '../components/Toast.js';

export const LandingPage: React.FC = () => {
  const { connectToRoom } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();

  // Modal / Panel state
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

  // ============================================================
  // Validation helpers
  // ============================================================
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

  // ============================================================
  // Handler: Create Room
  // ============================================================
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

  // ============================================================
  // Handler: Verify Room Code (Join Step 1)
  // ============================================================
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

  // ============================================================
  // Handler: Submit Join (Join Step 2)
  // ============================================================
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

  // ============================================================
  // Feature list
  // ============================================================
  const features = [
    { icon: Clock, title: 'Auto Cleanup', desc: 'Rooms self-delete after expiry' },
    { icon: Key, title: 'Access Keys', desc: 'Short codes & password gates' },
    { icon: Zap, title: 'WebRTC Voice', desc: 'Peer-to-peer voice channels' },
    { icon: Users, title: 'Rich Reactions', desc: 'Emoji, replies, pins & kick' },
  ];

  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden transition-colors duration-300"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* Background Decorative Orbs */}
      <div className="bg-orb w-[600px] h-[600px] bg-violet-600 top-[-200px] left-[-150px]" />
      <div className="bg-orb w-[500px] h-[500px] bg-pink-600 bottom-[-100px] right-[-100px]" />
      <div className="bg-orb w-[300px] h-[300px] bg-blue-600 top-[40%] left-[30%]" />

      {/* ====================================================
          HEADER
          ==================================================== */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--brand-gradient)', boxShadow: 'var(--shadow-brand)' }}>
            <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            Antigravity Chat
          </span>
        </div>

        <button
          onClick={toggleTheme}
          className="icon-btn p-2 sm:p-2.5 rounded-xl"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark'
            ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
            : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
          }
        </button>
      </header>

      {/* ====================================================
          HERO SECTION
          ==================================================== */}
      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20">

        {/* Left: Branding & Info */}
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-xl w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide mb-5 sm:mb-6"
            style={{
              border: '1px solid rgba(124,58,237,0.25)',
              background: 'rgba(124,58,237,0.08)',
              color: 'var(--text-brand)'
            }}
          >
            <Shield className="h-3.5 w-3.5" />
            End-to-End Ephemeral Encounters
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-4 sm:mb-6"
          >
            Secure, Private{' '}
            <span className="bg-gradient-to-r from-violet-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
              Ephemeral Chat
            </span>{' '}
            Rooms.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg leading-relaxed mb-8 sm:mb-10"
            style={{ color: 'var(--text-secondary)' }}
          >
            Create secure, temporary rooms that delete themselves automatically.
            No login required. Voice chats, file attachments, emoji reactions, and real-time encryption.
          </motion.p>

          {/* Feature Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="grid grid-cols-2 gap-4 sm:gap-6 w-full"
          >
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 items-start">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-brand)' }}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</h4>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Right: Action Cards */}
        <div className="flex-1 w-full max-w-sm flex flex-col gap-4">
          {/* Create Room Card */}
          <motion.button
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            onClick={() => setActiveModal('create')}
            className="glass-card glass-panel p-5 sm:p-6 rounded-2xl flex items-center justify-between group w-full text-left"
            aria-label="Create a new chat room"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                style={{
                  background: 'rgba(124,58,237,0.1)',
                  border: '1px solid rgba(124,58,237,0.2)',
                  color: 'var(--text-brand)'
                }}>
                <Users className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Create Room</h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Start a new private chat channel
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1"
              style={{ color: 'var(--text-tertiary)' }} />
          </motion.button>

          {/* Join Room Card */}
          <motion.button
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            onClick={() => setActiveModal('join')}
            className="glass-card glass-panel p-5 sm:p-6 rounded-2xl flex items-center justify-between group w-full text-left"
            aria-label="Join an existing chat room"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                style={{
                  background: 'rgba(236,72,153,0.1)',
                  border: '1px solid rgba(236,72,153,0.2)',
                  color: '#EC4899'
                }}>
                <Key className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Join Room</h3>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Enter a room code to join
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1"
              style={{ color: 'var(--text-tertiary)' }} />
          </motion.button>

          {/* Security Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-2 pt-2"
          >
            <Shield className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No account required · No data stored after expiry
            </span>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 text-center text-xs"
        style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)' }}>
        © {new Date().getFullYear()} Antigravity Chat · Secure temporary socket room sandbox
      </footer>

      {/* ====================================================
          MODALS
          ==================================================== */}
      <AnimatePresence>

        {/* ---- CREATE ROOM MODAL ---- */}
        {activeModal === 'create' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="glass-panel-heavy rounded-2xl w-full max-w-md relative z-10"
              style={{ overflow: 'hidden' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(124,58,237,0.12)', color: 'var(--text-brand)' }}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Create Private Room</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Get a unique invitation code</p>
                  </div>
                </div>
                <button onClick={closeModal} className="icon-btn p-1.5 rounded-lg" aria-label="Close modal">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateRoom} className="px-6 py-5 space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}>
                    Your Username <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maverick"
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
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}>
                    Room Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Frontend Team Sync"
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
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center justify-between"
                    style={{ color: 'var(--text-secondary)' }}>
                    <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" /> Password <span className="font-normal normal-case opacity-70">(optional)</span></span>
                    <span className="text-[10px]" style={{ color: 'var(--text-brand)' }}>Restricts entry</span>
                  </label>
                  <div className="relative">
                    <input
                      type={createShowPassword ? 'text' : 'password'}
                      placeholder="Leave empty for public access"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      className="w-full px-4 py-2.5 pr-11 rounded-xl glass-input text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setCreateShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded"
                      style={{ color: 'var(--text-tertiary)' }}
                      aria-label={createShowPassword ? 'Hide password' : 'Show password'}
                    >
                      {createShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Auto-delete */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}>
                    Auto-Delete After
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
                    className="btn-ghost flex-1 py-2.5 text-sm font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="btn-primary glow-btn flex-1 py-2.5 text-sm font-semibold rounded-xl"
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
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="glass-panel-heavy rounded-2xl w-full max-w-md relative z-10"
              style={{ overflow: 'hidden' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(236,72,153,0.12)', color: '#EC4899' }}>
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Join Chat Room</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {joinStep === 1 ? 'Enter your invitation code' : `Found: "${roomNameFound}"`}
                    </p>
                  </div>
                </div>
                <button onClick={closeModal} className="icon-btn p-1.5 rounded-lg" aria-label="Close modal">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Step indicator */}
              <div className="px-6 pt-4 flex items-center gap-3">
                {[1, 2].map((step) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      joinStep === step
                        ? 'bg-violet-600 text-white'
                        : step < joinStep
                          ? 'bg-emerald-600 text-white'
                          : 'text-xs font-medium'
                    }`}
                      style={joinStep !== step && step >= joinStep ? { background: 'var(--bg-elevated)', color: 'var(--text-tertiary)' } : {}}>
                      {step < joinStep ? '✓' : step}
                    </div>
                    <span className="text-xs" style={{ color: step === joinStep ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                      {step === 1 ? 'Find Room' : 'Enter Credentials'}
                    </span>
                    {step < 2 && <div className="h-px w-6 ml-1" style={{ background: 'var(--border-color)' }} />}
                  </div>
                ))}
              </div>

              {/* Modal Body */}
              <div className="px-6 py-5">
                <AnimatePresence mode="wait">
                  {/* Step 1: Code entry */}
                  {joinStep === 1 && (
                    <motion.form
                      key="step1"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      onSubmit={handleVerifyRoomCode}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>
                          Room Code <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="e.g. A8XJQ2"
                          value={joinCode}
                          onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinErrors(p => ({ ...p, code: '' })); }}
                          className="w-full px-4 py-3 rounded-xl glass-input text-xl font-bold text-center tracking-[0.3em] uppercase"
                          style={{ letterSpacing: '0.3em' }}
                          maxLength={10}
                        />
                        {joinErrors.code && (
                          <p className="text-xs text-red-400 mt-1">{joinErrors.code}</p>
                        )}
                      </div>

                      <div className="flex gap-3 pt-1">
                        <button type="button" onClick={closeModal} className="btn-ghost flex-1 py-2.5 text-sm font-semibold rounded-xl">
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={joinLoading}
                          className="btn-primary glow-btn flex-1 py-2.5 text-sm font-semibold rounded-xl"
                          style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED)' }}
                        >
                          {joinLoading ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Checking...
                            </span>
                          ) : 'Find Room →'}
                        </button>
                      </div>
                    </motion.form>
                  )}

                  {/* Step 2: Credentials */}
                  {joinStep === 2 && (
                    <motion.form
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      onSubmit={handleJoinRoom}
                      className="space-y-4"
                    >
                      {/* Room found banner */}
                      <div className="p-3 rounded-xl flex items-center gap-3"
                        style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(124,58,237,0.2)', color: 'var(--text-brand)' }}>
                          <Shield className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Room Found</p>
                          <p className="font-bold text-sm" style={{ color: 'var(--text-brand)' }}>{roomNameFound}</p>
                        </div>
                        {requiresPassword && (
                          <Lock className="h-4 w-4 ml-auto shrink-0" style={{ color: '#EC4899' }} />
                        )}
                      </div>

                      {/* Username */}
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                          style={{ color: 'var(--text-secondary)' }}>
                          Your Username <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="e.g. Iceman"
                          value={joinUsername}
                          onChange={(e) => { setJoinUsername(e.target.value); setJoinErrors(p => ({ ...p, username: '' })); }}
                          className="w-full px-4 py-2.5 rounded-xl glass-input text-sm"
                        />
                        {joinErrors.username && (
                          <p className="text-xs text-red-400 mt-1">{joinErrors.username}</p>
                        )}
                      </div>

                      {/* Password (if required) */}
                      {requiresPassword && (
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
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
                              aria-label={joinShowPassword ? 'Hide password' : 'Show password'}
                            >
                              {joinShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          {joinErrors.password && (
                            <p className="text-xs text-red-400 mt-1">{joinErrors.password}</p>
                          )}
                        </div>
                      )}

                      <div className="flex gap-3 pt-1">
                        <button type="button" onClick={() => { setJoinStep(1); setJoinErrors({}); }}
                          className="btn-ghost flex-1 py-2.5 text-sm font-semibold rounded-xl">
                          ← Back
                        </button>
                        <button
                          type="submit"
                          disabled={joinLoading}
                          className="btn-primary glow-btn flex-1 py-2.5 text-sm font-semibold rounded-xl"
                          style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED)' }}
                        >
                          {joinLoading ? (
                            <span className="flex items-center justify-center gap-2">
                              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Joining...
                            </span>
                          ) : 'Join Room'}
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
