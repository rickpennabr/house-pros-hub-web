'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export type BackgroundMode = 'regular' | 'dynamic';

const STORAGE_KEY = 'businessPageBackgroundMode';

interface BackgroundModeContextType {
  mode: BackgroundMode;
  setMode: (value: BackgroundMode | ((prev: BackgroundMode) => BackgroundMode)) => void;
}

const BackgroundModeContext = createContext<BackgroundModeContextType | undefined>(undefined);

export function BackgroundModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useLocalStorage<BackgroundMode>(STORAGE_KEY, 'regular');
  return (
    <BackgroundModeContext.Provider value={{ mode, setMode }}>
      {children}
    </BackgroundModeContext.Provider>
  );
}

const defaultBackgroundMode: BackgroundModeContextType = {
  mode: 'regular',
  setMode: () => {},
};

/**
 * Returns background mode state. When used outside BackgroundModeProvider (e.g. CRM),
 * returns a default so ViewToggle and other consumers can render without error.
 */
export function useBackgroundMode(): BackgroundModeContextType {
  const context = useContext(BackgroundModeContext);
  return context ?? defaultBackgroundMode;
}
