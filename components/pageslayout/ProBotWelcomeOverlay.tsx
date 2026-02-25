'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useWelcome } from '@/contexts/WelcomeContext';

const SESSION_KEY = 'houseproshub_welcome_shown';
const TYPEWRITER_MS = 48;
/** Pause with full message visible (2s) after typing finishes, then go to site */
const PAUSE_AFTER_TYPING_MS = 2000;
const FADE_TO_BLACK_MS = 2000;
const MOVE_DURATION_MS = 800;
/** Floating button size (1.2x scale) */
const BUTTON_SIZE = 67;
/** ProBot size on the welcome screen (1.2x: 120 → 144) */
const WELCOME_BOT_SIZE = 144;

type Phase = 'typewriter' | 'fadeToBlack' | 'moveToCorner' | 'done';

/**
 * First-visit welcome overlay: ProBot on white, typewriter message once,
 * fade to black 2s, bot moves to floating position, then dismiss.
 */
export default function ProBotWelcomeOverlay() {
  const t = useTranslations('bot');
  const { setWelcomeOverlayVisible } = useWelcome();
  const welcomeMessage = t('welcomeMessage');
  const [hasChecked, setHasChecked] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [phase, setPhase] = useState<Phase>('typewriter');
  const [typedLength, setTypedLength] = useState(0);
  const [cornerPosition, setCornerPosition] = useState<{ left: number; top: number } | null>(null);
  const [imageSrc, setImageSrc] = useState('/pro-bot-solo.gif');
  const targetRef = useRef<HTMLDivElement>(null);

  // Only show overlay on true first load: if key exists, skip overlay (reload = show loading/dance.gif instead).
  // Set the key as soon as we show the overlay so any reload after that won't show overlay again.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(SESSION_KEY)) {
      setWelcomeOverlayVisible(false);
      setShowOverlay(false);
      setHasChecked(true);
      return;
    }
    sessionStorage.setItem(SESSION_KEY, '1');
    setShowOverlay(true);
    setHasChecked(true);
  }, [setWelcomeOverlayVisible]);

  // Typewriter: run once, then brief pause and fade to black
  useEffect(() => {
    if (!showOverlay || phase !== 'typewriter' || !welcomeMessage) return;

    if (typedLength >= welcomeMessage.length) {
      const next = setTimeout(() => setPhase('fadeToBlack'), PAUSE_AFTER_TYPING_MS);
      return () => clearTimeout(next);
    }

    const id = setTimeout(() => setTypedLength((n) => n + 1), TYPEWRITER_MS);
    return () => clearTimeout(id);
  }, [showOverlay, phase, typedLength, welcomeMessage]);

  // Phase: fade to black (2s)
  useEffect(() => {
    if (phase !== 'fadeToBlack') return;
    const done = setTimeout(() => setPhase('moveToCorner'), FADE_TO_BLACK_MS);
    return () => clearTimeout(done);
  }, [phase]);

  // Phase: measure corner and move bot (1.2x: container 108px, tooltip+arrow 97+10, button 67)
  useEffect(() => {
    if (phase !== 'moveToCorner' || !targetRef.current) return;

    const rect = targetRef.current.getBoundingClientRect();
    const buttonOffsetLeft = (108 - BUTTON_SIZE) / 2;
    const buttonOffsetTop = 97 + 10;
    setCornerPosition({
      left: rect.left + buttonOffsetLeft,
      top: rect.top + buttonOffsetTop,
    });

    const done = setTimeout(() => {
      setPhase('done');
      setShowOverlay(false);
      setWelcomeOverlayVisible(false);
    }, MOVE_DURATION_MS);

    return () => clearTimeout(done);
  }, [phase, setWelcomeOverlayVisible]);

  const handleImageError = useCallback(() => {
    setImageSrc('/pro-bot-solo.png');
  }, []);

  // Show overlay when we haven't checked yet (first paint = welcome UI) or when showOverlay is true (first visit).
  // This way the first paint is always the robot + message screen, never a generic white box.
  if (!showOverlay && hasChecked) return null;

  const displayText = welcomeMessage?.slice(0, typedLength) ?? '';
  const isTyping = typedLength < (welcomeMessage?.length ?? 0);
  const isFadeToBlack = phase === 'fadeToBlack';
  const isMoveToCorner = phase === 'moveToCorner' && cornerPosition;

  return (
    <>
      {/* Hidden target to measure BotFloatingButton position */}
      <div
        ref={targetRef}
        aria-hidden
        className="fixed z-0 pointer-events-none invisible flex flex-col items-center bottom-[125px] right-[35px] md:bottom-[180px] md:right-[calc(max(1rem,calc((100vw-960px)/2+1rem))+40px)]"
        style={{ width: 108, height: 97 + 10 + BUTTON_SIZE }}
      />
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black md:bg-black/80">
        {/* Main pages container border only: same as PagesContainer */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-full max-w-[960px] h-[calc(100vh-1rem)] md:min-h-screen md:h-auto md:mt-2 md:rounded-lg border-2 border-black bg-white" />
        </div>
        {/* Black overlay that fades in over 2s and stays black during move */}
        <div
          className="absolute inset-0 bg-black pointer-events-none transition-opacity ease-linear"
          style={{
            opacity: phase === 'fadeToBlack' || phase === 'moveToCorner' ? 1 : 0,
            transitionDuration: phase === 'fadeToBlack' ? `${FADE_TO_BLACK_MS}ms` : '0ms',
          }}
        />

        {/* ProBot + tooltip: center then animate to corner; during move show only image to match button position */}
        <div
          className="fixed flex flex-col items-center transition-all ease-out z-10"
          style={{
            left: isMoveToCorner ? cornerPosition!.left : '50%',
            top: isMoveToCorner ? cornerPosition!.top : '50%',
            transform: isMoveToCorner ? 'none' : 'translate(-50%, -50%)',
            transitionDuration: `${MOVE_DURATION_MS}ms`,
          }}
        >
          {!isMoveToCorner && (
            <div className="mb-2 flex flex-col items-center bg-transparent">
              <div
                className="w-[360px] min-h-[264px] max-w-[408px] flex flex-col items-center justify-center gap-1 p-6 rounded-xl bg-gray-900 text-white text-lg md:text-xl leading-snug text-center"
                role="status"
                aria-live="polite"
              >
                <span className="inline-flex items-baseline flex-wrap justify-center gap-0">
                  <span>{displayText}</span>
                  {isTyping && <span className="animate-pulse shrink-0" aria-hidden>|</span>}
                </span>
              </div>
              <div
                className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-gray-900 -mt-px"
                aria-hidden
              />
            </div>
          )}
          <div
            className="flex items-center justify-center p-0 bg-transparent border-0 flex-shrink-0 transition-all ease-out"
            style={{
              width: isMoveToCorner ? BUTTON_SIZE : WELCOME_BOT_SIZE,
              height: isMoveToCorner ? BUTTON_SIZE : WELCOME_BOT_SIZE,
              transitionDuration: `${MOVE_DURATION_MS}ms`,
            }}
          >
            <img
              src={imageSrc}
              alt=""
              width={isMoveToCorner ? BUTTON_SIZE : WELCOME_BOT_SIZE}
              height={isMoveToCorner ? BUTTON_SIZE : WELCOME_BOT_SIZE}
              className="w-full h-full object-contain object-center"
              onError={handleImageError}
            />
          </div>
        </div>
      </div>
    </>
  );
}
