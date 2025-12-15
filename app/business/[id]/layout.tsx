'use client';

import { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function BusinessDetailsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { getThemeClasses } = useTheme();
  const backgroundClass = getThemeClasses('background');
  const containerClass = getThemeClasses('container');

  return (
    <div className={`min-h-screen w-full ${backgroundClass}`}>
      <div className={`w-full max-w-[960px] min-h-screen mx-auto ${containerClass} bg-white`}>
        {children}
      </div>
    </div>
  );
}

