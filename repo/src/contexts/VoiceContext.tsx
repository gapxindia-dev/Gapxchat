import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext.js';

interface VoiceParticipant {
  socketId: string;
  username: string;
  isMuted: boolean;
  isSpeaking: boolean;
  stream?: MediaStream;
}

interface VoiceContextType {
  isInVoice: boolean;
  isLocalMuted: boolean;
  voiceParticipants: VoiceParticipant[];
  joinVoice: () => Promise<void>;
  leaveVoice: () => void;
  toggleLocalMute: () => void;
  activeSpeakers: string[]; // usernames of active speakers
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

// ICE Servers for WebRTC NAT traversal
const iceConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket, isConnected } = useSocket();
  const [isInVoice, setIsInVoice] = useState(false);
  const [isLocalMuted, setIsLocalMuted] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  
  // Audio analysis for active speaker detection
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // ----------------------------------------------------
  // Clean up Peer Connection helper
  // ----------------------------------------------------
  const cleanupPeer = useCallback((socketId: string) => {
    if (peerConnectionsRef.current[socketId]) {
      peerConnectionsRef.current[socketId].close();
      delete peerConnectionsRef.current[socketId];
    }
    if (audioElementsRef.current[socketId]) {
      audioElementsRef.current[socketId].pause();
      audioElementsRef.current[socketId].remove();
      delete audioElementsRef.current[socketId];
    }
    setVoiceParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
  }, []);

  // ----------------------------------------------------
  // Create Peer Connection helper
  // ----------------------------------------------------
  const createPeerConnection = useCallback((targetSocketId: string, targetUsername: string, isInitiator: boolean) => {
    if (peerConnectionsRef.current[targetSocketId]) {
      cleanupPeer(targetSocketId);
    }

    const pc = new RTCPeerConnection(iceConfiguration);
    peerConnectionsRef.current[targetSocketId] = pc;

    // Attach local microphone tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc_signal', {
          targetSocketId,
          signalData: { candidate: event.candidate },
        });
      }
    };

    // Receive Remote Streams
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      
      // Update voice participants list
      setVoiceParticipants((prev) => {
        const index = prev.findIndex((p) => p.socketId === targetSocketId);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = { ...updated[index], stream: remoteStream };
          return updated;
        }
        return [...prev, {
          socketId: targetSocketId,
          username: targetUsername,
          isMuted: false,
          isSpeaking: false,
          stream: remoteStream,
        }];
      });

      // Play audio stream
      if (!audioElementsRef.current[targetSocketId]) {
        const audio = document.createElement('audio');
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audio.setAttribute('playsinline', 'true');
        document.body.appendChild(audio);
        audioElementsRef.current[targetSocketId] = audio;
      } else {
        audioElementsRef.current[targetSocketId].srcObject = remoteStream;
      }
    };

    // Connection state logging
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanupPeer(targetSocketId);
      }
    };

    // If we are initiator, build and emit SDP offer
    if (isInitiator && socket) {
      pc.createOffer({ offerToReceiveAudio: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('webrtc_signal', {
            targetSocketId,
            signalData: { sdp: pc.localDescription },
          });
        })
        .catch((err) => console.error('Error creating offer:', err));
    }

    return pc;
  }, [socket, cleanupPeer]);

  // ----------------------------------------------------
  // Local Microphone Volume Analysis (Speaker Detection)
  // ----------------------------------------------------
  const setupAudioAnalysis = useCallback((stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;

      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let isSpeaking = false;
      let silenceTicks = 0;

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Compute average frequency power
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Sound volume threshold (average level goes 0 to 255)
        const threshold = 15;
        const nowSpeaking = average > threshold && !isLocalMuted;

        if (nowSpeaking) {
          silenceTicks = 0;
          if (!isSpeaking) {
            isSpeaking = true;
            if (socket) socket.emit('voice_speaking', { isSpeaking: true });
            setActiveSpeakers((prev) => {
              const myUsername = (socket?.auth as any)?.username || 'Me';
              return prev.includes(myUsername) ? prev : [...prev, myUsername];
            });
          }
        } else {
          silenceTicks++;
          // Require about 20 consecutive quiet frames to register silence (stops flicker)
          if (isSpeaking && silenceTicks > 20) {
            isSpeaking = false;
            if (socket) socket.emit('voice_speaking', { isSpeaking: false });
            setActiveSpeakers((prev) => {
              const myUsername = (socket?.auth as any)?.username || 'Me';
              return prev.filter((u) => u !== myUsername);
            });
          }
        }

        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.error('AudioContext speak checking not supported on this browser:', e);
    }
  }, [isLocalMuted, socket]);

  // ----------------------------------------------------
  // Join Voice Channel
  // ----------------------------------------------------
  const joinVoice = useCallback(async () => {
    if (!socket || !isConnected) return;

    try {
      // 1. Get mic permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // Unmute tracks by default
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isLocalMuted;
      });

      // 2. Setup audio analysis to detect speaking
      setupAudioAnalysis(stream);

      // 3. Emit join voice event to signal other peers
      socket.emit('webrtc_join');
      setIsInVoice(true);
    } catch (err) {
      console.error('Failed to get user audio permissions:', err);
      alert('Could not access microphone. Please check system permissions.');
    }
  }, [socket, isConnected, isLocalMuted, setupAudioAnalysis]);

  // ----------------------------------------------------
  // Leave Voice Channel
  // ----------------------------------------------------
  const leaveVoice = useCallback(() => {
    if (socket) {
      socket.emit('webrtc_leave');
    }

    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Stop Web Audio analysis
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    // Close all P2P connections
    Object.keys(peerConnectionsRef.current).forEach((sid) => {
      cleanupPeer(sid);
    });

    peerConnectionsRef.current = {};
    audioElementsRef.current = {};
    setVoiceParticipants([]);
    setActiveSpeakers([]);
    setIsInVoice(false);
  }, [socket, cleanupPeer]);

  // ----------------------------------------------------
  // Toggle Microphone Mute
  // ----------------------------------------------------
  const toggleLocalMute = useCallback(() => {
    const nextMuted = !isLocalMuted;
    setIsLocalMuted(nextMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    if (socket) {
      socket.emit('voice_mute_toggle', { isMuted: nextMuted });
    }
  }, [isLocalMuted, socket]);





  // ----------------------------------------------------
  // Listeners for Socket WebRTC events
  // ----------------------------------------------------
  useEffect(() => {
    if (!socket || !isConnected) return;

    // 1. Newcomer gets list of current voice members
    socket.on('webrtc_participants_list', (participants: { socketId: string; username: string }[]) => {
      console.log('🔊 voice channel roster received:', participants);
      
      participants.forEach(({ socketId, username }) => {
        // Create peer connection. As newcomer, we INITIATE the connection.
        createPeerConnection(socketId, username, true);
        
        setVoiceParticipants((prev) => [
          ...prev.filter((p) => p.socketId !== socketId),
          { socketId, username, isMuted: false, isSpeaking: false },
        ]);
      });
    });

    // 2. Existing members get notified of newcomer
    socket.on('webrtc_user_joined', ({ socketId, username }) => {
      console.log(`🔊 User ${username} joined voice channel (${socketId})`);
      
      // We wait for the newcomer to initiate connection (offer)
      setVoiceParticipants((prev) => [
        ...prev.filter((p) => p.socketId !== socketId),
        { socketId, username, isMuted: false, isSpeaking: false },
      ]);
    });

    // 3. Receive signal payloads (SDP Offer/Answer or ICE candidates)
    socket.on('webrtc_signal_received', async ({ senderSocketId, username, signalData }) => {
      let pc = peerConnectionsRef.current[senderSocketId];

      if (!pc) {
        // If we don't have connection yet, create it (we are receiver, so initiator = false)
        pc = createPeerConnection(senderSocketId, username, false);
      }

      try {
        if (signalData.sdp) {
          const desc = new RTCSessionDescription(signalData.sdp);
          await pc.setRemoteDescription(desc);

          if (desc.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc_signal', {
              targetSocketId: senderSocketId,
              signalData: { sdp: pc.localDescription },
            });
          }
        } else if (signalData.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        }
      } catch (err) {
        console.error('Signaling processing failed:', err);
      }
    });

    // 4. Remote user left voice channel
    socket.on('webrtc_user_left', ({ socketId, username }) => {
      console.log(`🔊 Participant left voice channel: ${username} (${socketId})`);
      cleanupPeer(socketId);
    });

    // 5. Remote user muted/unmuted
    socket.on('webrtc_user_mute_status', ({ socketId, isMuted }) => {
      setVoiceParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, isMuted } : p))
      );
    });

    // 6. Remote user speaking indicators
    socket.on('webrtc_user_speaking', ({ socketId, isSpeaking }) => {
      setVoiceParticipants((prev) =>
        prev.map((p) => (p.socketId === socketId ? { ...p, isSpeaking } : p))
      );

      // Add/remove username to active speakers array
      setVoiceParticipants((prev) => {
        const participant = prev.find((p) => p.socketId === socketId);
        if (participant) {
          setActiveSpeakers((prevSpeakers) => {
            if (isSpeaking) {
              return prevSpeakers.includes(participant.username) ? prevSpeakers : [...prevSpeakers, participant.username];
            } else {
              return prevSpeakers.filter((uname) => uname !== participant.username);
            }
          });
        }
        return prev;
      });
    });

    return () => {
      socket.off('webrtc_participants_list');
      socket.off('webrtc_user_joined');
      socket.off('webrtc_signal_received');
      socket.off('webrtc_user_left');
      socket.off('webrtc_user_mute_status');
      socket.off('webrtc_user_speaking');
    };
  }, [socket, isConnected, createPeerConnection, cleanupPeer]);

  // Clean up voice connection on unmount
  useEffect(() => {
    return () => {
      leaveVoice();
    };
  }, [leaveVoice]);

  return (
    <VoiceContext.Provider
      value={{
        isInVoice,
        isLocalMuted,
        voiceParticipants,
        joinVoice,
        leaveVoice,
        toggleLocalMute,
        activeSpeakers,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};

// eslint-disable-next-line react/only-export-components
export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};
