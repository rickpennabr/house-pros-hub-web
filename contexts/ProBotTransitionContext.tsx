'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';

interface ProBotTransitionContextType {
  transitioningToProbot: boolean;
  setTransitioningToProbot: (value: boolean) => void;
}

const ProBotTransitionContext = createContext<ProBotTransitionContextType | null>(null);

const FADE_MS = 600;

export function useProBotTransition() {
  const ctx = useContext(ProBotTransitionContext);
  if (!ctx) return { transitioningToProbot: false, setTransitioningToProbot: () => {} };
  return ctx;
}

interface ProBotTransitionProviderProps {
  children: ReactNode;
}

/**
 * Provides transition state for ProBot navigation and renders a persistent black overlay
 * that stays visible during route change so the previous page doesn't flash.
 */
export function ProBotTransitionProvider({ children }: ProBotTransitionProviderProps) {
  const [transitioningToProbot, setTransitioningToProbot] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayOpaque, setOverlayOpaque] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const justBecameTrue = useRef(false);

  useEffect(() => {
    if (transitioningToProbot) {
      setFadingOut(false);
      setOverlayVisible(true);
      setOverlayOpaque(false);
      justBecameTrue.current = true;
    }
  }, [transitioningToProbot]);

  useEffect(() => {
    if (!overlayVisible) return;
    if (transitioningToProbot && justBecameTrue.current) {
      justBecameTrue.current = false;
      const raf = requestAnimationFrame(() => setOverlayOpaque(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [overlayVisible, transitioningToProbot]);

  useEffect(() => {
    if (!transitioningToProbot && overlayVisible && overlayOpaque) {
      setFadingOut(true);
      const t = setTimeout(() => {
        setOverlayVisible(false);
        setOverlayOpaque(false);
        setFadingOut(false);
      }, FADE_MS);
      return () => clearTimeout(t);
    }
  }, [transitioningToProbot, overlayVisible, overlayOpaque]);

  const value: ProBotTransitionContextType = {
    transitioningToProbot,
    setTransitioningToProbot: useCallback((v: boolean) => setTransitioningToProbot(v), []),
  };

  const showOverlay = overlayVisible && (transitioningToProbot || fadingOut);
  const opacity = fadingOut ? 0 : overlayOpaque ? 100 : 0;

  return (
    <ProBotTransitionContext.Provider value={value}>
      {children}
      {showOverlay && (
        <div
          className="fixed inset-0 z-[200] bg-black pointer-events-none transition-opacity ease-in-out"
          style={{ opacity: opacity / 100, transitionDuration: `${FADE_MS}ms` }}
          aria-hidden
        />
      )}
    </ProBotTransitionContext.Provider>
  );
}
