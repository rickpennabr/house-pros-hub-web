'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/** True when the big welcome overlay is showing; floating button hides so only the overlay is visible. */
interface WelcomeContextType {
  isWelcomeOverlayVisible: boolean;
  setWelcomeOverlayVisible: (visible: boolean) => void;
}

const WelcomeContext = createContext<WelcomeContextType | undefined>(undefined);

/** Default true so the floating button is hidden on first paint until we know overlay won't show. */
export function WelcomeProvider({ children }: { children: ReactNode }) {
  const [isWelcomeOverlayVisible, setWelcomeOverlayVisible] = useState(true);
  const setVisible = useCallback((visible: boolean) => setWelcomeOverlayVisible(visible), []);
  return (
    <WelcomeContext.Provider value={{ isWelcomeOverlayVisible, setWelcomeOverlayVisible: setVisible }}>
      {children}
    </WelcomeContext.Provider>
  );
}

export function useWelcome() {
  const ctx = useContext(WelcomeContext);
  if (ctx === undefined) throw new Error('useWelcome must be used within WelcomeProvider');
  return ctx;
}
