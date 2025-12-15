'use client';

import { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface PageContainerProps {
  children: ReactNode;
}

export default function PageContainer({ children }: PageContainerProps) {
  const { getThemeClasses, theme } = useTheme();
  const containerClass = getThemeClasses('container');

  // Mobile: Always black border, Desktop: Theme border
  const borderClass = theme === 'colorful' 
    ? 'border-2 border-black md:border-2 md:border-changing'
    : 'border-2 border-black';

  return (
    <div className={`w-full max-w-[960px] mx-auto bg-white
      ${borderClass} rounded-lg h-[calc(100vh-1rem)] overflow-hidden
      md:rounded-none md:min-h-screen md:h-auto md:overflow-visible`}>
      {children}
    </div>
  );
}

