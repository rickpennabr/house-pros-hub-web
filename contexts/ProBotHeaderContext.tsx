'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface ProBotHeaderOptions {
  /** When true, layout shows back chevron on mobile instead of HPH logo. */
  inChat: boolean;
  /** Called when user taps the back chevron (navigate to ProBot welcome page). */
  onBackToWelcome: () => void;
}

const defaultOptions: ProBotHeaderOptions = {
  inChat: false,
  onBackToWelcome: () => {},
};

type SetProBotHeaderOptions = (opts: Partial<ProBotHeaderOptions>) => void;

const ProBotHeaderContext = createContext<ProBotHeaderOptions & { setProBotHeader: SetProBotHeaderOptions }>({
  ...defaultOptions,
  setProBotHeader: () => {},
});

export function ProBotHeaderProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ProBotHeaderOptions>(defaultOptions);

  const setProBotHeader = useCallback((opts: Partial<ProBotHeaderOptions>) => {
    setOptions((prev) => ({ ...prev, ...opts }));
  }, []);

  return (
    <ProBotHeaderContext.Provider value={{ ...options, setProBotHeader }}>
      {children}
    </ProBotHeaderContext.Provider>
  );
}

export function useProBotHeader() {
  return useContext(ProBotHeaderContext);
}
