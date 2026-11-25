'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

const BARS = 30;

/** Same bars every time for the same file (a real waveform would need decoding the whole file). */
function waveFor(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: BARS }, () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return 0.25 + ((h >>> 0) % 1000) / 1000 * 0.75;
  });
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * WhatsApp-style voice message: play/pause, a waveform that fills as it plays (tap to seek),
 * the length (or the time played while playing) and a mic mark.
 */
export function VoiceNotePlayer({ url, label = 'Voice message' }: { url: string; label?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const bars = useMemo(() => waveFor(url), [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // Browser recordings (WebM) often report no length until read once: jump to the end to learn it.
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
        return;
      }
      const onFix = () => {
        audio.removeEventListener('timeupdate', onFix);
        if (Number.isFinite(audio.duration)) setDuration(audio.duration);
        audio.currentTime = 0;
      };
      audio.addEventListener('timeupdate', onFix);
      audio.currentTime = 1e7;
    };
    const onTime = () => setCurrent(audio.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => setPlaying(true);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);
    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
    };
  }, [url]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      // Only one voice note plays at a time.
      document.querySelectorAll('audio[data-voice-note]').forEach((el) => {
        if (el !== audio) (el as HTMLAudioElement).pause();
      });
      void audio.play().catch(() => setPlaying(false));
    } else audio.pause();
  };

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrent(audio.currentTime);
  };

  const progress = duration ? Math.min(1, current / duration) : 0;

  return (
    <div className="mt-1 flex w-[230px] max-w-full items-start gap-1.5" aria-label={label}>
      <audio ref={audioRef} src={url} preload="metadata" data-voice-note className="hidden" />
      <button
        type="button"
        onClick={toggle}
        className="flex h-7 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-700 hover:bg-black/5"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className="relative flex h-7 w-full cursor-pointer items-center justify-between overflow-hidden px-1"
          onClick={seek}
          role="slider"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          tabIndex={-1}
        >
          {bars.map((h, i) => (
            <span
              key={i}
              className={`w-[3px] min-w-0 shrink rounded-sm ${i / BARS < progress ? 'bg-sky-500' : 'bg-gray-400'}`}
              style={{ height: `${Math.round(h * 24)}px` }}
            />
          ))}
          {/* Position dot, like WhatsApp */}
          <span
            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500"
            style={{ left: `calc(4px + ${progress} * (100% - 8px))` }}
            aria-hidden
          />
        </div>
        <span className="text-[11px] tabular-nums text-gray-500">{clock(playing || current > 0 ? current : duration)}</span>
      </div>
    </div>
  );
}
