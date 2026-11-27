'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Bot, Check, Loader2, Pause, Play } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { PROBOT_VOICES } from '@/lib/ai/voices';
import { FREE_VOICES } from '@/lib/billing/probot-tiers';
import { setProbotVoice, useProbotVoice } from '@/lib/chat/probot-voice-store';

/** Pick ProBot's voice (Gemini / Grok style): named voices, a play button for a sample, tap to choose. */
export function ProBotVoicePicker({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const locale = useLocale();
  const selected = useProbotVoice();
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  /** On the Free plan only Max and Sofia can be picked; the rest can be heard and show "Pro". */
  const [freePlan, setFreePlan] = useState(true);
  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    fetch('/api/billing/plans', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { current?: { plan?: string } | null } | null) => {
        if (live) setFreePlan(!data?.current?.plan || data.current.plan === 'free');
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isOpen]);

  const stop = () => {
    audio.current?.pause();
    audio.current = null;
    setPlaying(null);
    setLoading(null);
  };

  const play = (id: string) => {
    if (playing === id || loading === id) return stop();
    stop();
    setError(null);
    setLoading(id);
    const clip = new Audio(`/api/probot/voice-sample?voice=${id}&locale=${locale}`);
    audio.current = clip;
    clip.onplaying = () => {
      setLoading(null);
      setPlaying(id);
    };
    clip.onended = () => setPlaying((now) => (now === id ? null : now));
    clip.onerror = () => {
      setLoading(null);
      setPlaying(null);
      setError('That sample is busy right now. Try again in a minute.');
    };
    void clip.play().catch(() => {});
  };

  const choose = (id: string) => {
    if (id !== selected) play(id);
    setProbotVoice(id);
  };

  const close = () => {
    stop();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="ProBot's voice" showHeader>
      <div className="space-y-2 p-1">
        <p className="text-sm text-gray-600">Pick how ProBot sounds when it answers your voice notes. Tap play to hear it.</p>
        <ul className="space-y-2">
          {PROBOT_VOICES.map((voice) => {
            const active = voice.id === selected;
            const locked = freePlan && !FREE_VOICES.includes(voice.id);
            return (
              <li key={voice.id}>
                <div className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2 ${active ? 'border-black bg-gray-50' : 'border-gray-200'}`}>
                  <button
                    type="button"
                    onClick={() => play(voice.id)}
                    aria-label={`${playing === voice.id ? 'Stop' : 'Play'} ${voice.name}`}
                    className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-black bg-white hover:bg-gray-100"
                  >
                    {loading === voice.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : playing === voice.id ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => (locked ? play(voice.id) : choose(voice.id))}
                    className="min-w-0 flex-1 cursor-pointer text-left"
                    aria-pressed={active}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-black">
                      {voice.name}
                      {voice.robot ? <Bot className="h-4 w-4 text-red-600" aria-hidden /> : null}
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-normal text-gray-600">
                        {voice.gender === 'robot' ? 'Robot' : voice.gender === 'male' ? 'Male' : 'Female'}
                      </span>
                      {locked ? <span className="rounded-md bg-black px-1.5 py-0.5 text-[11px] font-semibold text-white">Pro</span> : null}
                    </span>
                    <span className="block text-xs text-gray-500">{voice.description}</span>
                  </button>
                  {active ? <Check className="h-5 w-5 shrink-0 text-red-600" aria-label="Selected" /> : null}
                </div>
              </li>
            );
          })}
        </ul>
        {freePlan ? (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Free includes Max and Sofia. Pro unlocks every voice, including Bolt the robot.{' '}
            <Link href={`/${locale}/subscription`} className="font-semibold text-black underline" onClick={close}>
              See plans
            </Link>
          </p>
        ) : null}
        {error ? (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
