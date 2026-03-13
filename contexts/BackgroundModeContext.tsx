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

export function useBackgroundMode() {
  const context = useContext(BackgroundModeContext);
  if (context === undefined) {
    throw new Error('useBackgroundMode must be used within a BackgroundModeProvider');
  }
  return context;
}
