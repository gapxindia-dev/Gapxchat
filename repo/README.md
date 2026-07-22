# ⚡ GapChat — Fast, Private & Ephemeral Rooms

GapChat is a real-time, privacy-first messaging web application designed for instant temporary chat rooms. Rooms self-destruct automatically after expiration, requiring no sign-up or accounts.

![GapChat Banner](public/favicon.svg)

---

## ✨ Features

- 🔒 **Zero Sign-Up Required**: Join or create rooms instantly with just a display name.
- ⏱️ **Auto-Deleting Rooms**: Rooms and all associated data self-destruct after 1 to 48 hours.
- 🔑 **Password Protection**: Restrict entry to rooms with optional password encryption.
- 🎙️ **Full-Mesh WebRTC Voice**: High-quality peer-to-peer audio channels directly inside rooms.
- 📎 **File & Media Sharing**: Upload images, videos, audio notes, PDFs, and ZIP archives up to 100 MB.
- 🎤 **Voice Messaging**: Integrated press-and-hold audio recorder for instant voice notes.
- 🎨 **Modern Aesthetics**: Built with custom HSL design tokens, electric cyan-indigo gradients, and responsive glassmorphism in both dark and light modes.
- 🔍 **In-Room Search & Pinning**: Easily search chat history or pin important messages.
- ⚡ **Dual Database Strategy**: Uses high-performance MongoDB when configured, or friction-free local JSON file storage (`database.json`) out of the box.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install --legacy-peer-deps
```

### 2. Run Locally in Development Mode

```bash
npm run dev
```

This launches:
- **Vite Frontend**: `http://localhost:3000`
- **Express + Socket.io Server**: `http://localhost:5000`

---

## 🐳 Docker Setup

Build and run using Docker Compose:

```bash
docker-compose up --build
```

Access the application at `http://localhost:5000`.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Lucide Icons, Emoji-Mart
- **Backend**: Node.js, Express, Socket.io (WebSocket signaling), WebRTC (P2P Mesh audio)
- **Database**: Mongoose (MongoDB) with fallback to local JSON file adapter
