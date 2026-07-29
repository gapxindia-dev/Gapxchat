import React, { useState, useRef, memo } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  url: string;
  isVoiceNote?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = memo(({ url }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.error('Audio playback error:', err));
    }
  };

  const changeSpeed = () => {
    if (!audioRef.current) return;
    const rates = [1, 1.5, 2];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    setPlaybackRate(nextRate);
    audioRef.current.playbackRate = nextRate;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const formatTime = (t: number) => {
    if (isNaN(t) || t === 0) return '0:00';
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };


  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl w-60 sm:w-72 bg-black/10 dark:bg-white/5 border border-white/10 shadow-sm">
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        className="hidden"
      />

      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        type="button"
        className="h-9 w-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow transition-transform active:scale-95"
        title={isPlaying ? 'Pause Voice Note' : 'Play Voice Note'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
      </button>

      {/* Progress Track & Time */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
        <div className="flex justify-between items-center text-[10px] text-gray-500 dark:text-gray-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Speed Multiplier Toggle */}
      <button
        onClick={changeSpeed}
        type="button"
        className="px-2 py-1 rounded bg-black/20 dark:bg-white/10 hover:bg-black/30 text-[10px] font-bold text-emerald-400 shrink-0 transition-colors"
        title="Change playback speed"
      >
        {playbackRate}x
      </button>
    </div>
  );
});
