'use client';

import { useState, useEffect } from 'react';

export interface WindowDimensions {
  width: number;
  height: number;
  isMobile: boolean;
  isDesktop: boolean;
}

/**
 * Hook to track window dimensions and responsive breakpoints
 * @param mobileBreakpoint - The breakpoint in pixels for mobile (default: 768)
 * @returns Window dimensions and responsive flags
 */
export function useWindowDimensions(mobileBreakpoint: number = 768): WindowDimensions {
  const [dimensions, setDimensions] = useState<WindowDimensions>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 0,
        height: 0,
        isMobile: false,
        isDesktop: true,
      };
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    return {
      width,
      height,
      isMobile: width < mobileBreakpoint,
      isDesktop: width >= mobileBreakpoint,
    };
  });

  useEffect(() => {
    const updateDimensions = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setDimensions({
        width,
        height,
        isMobile: width < mobileBreakpoint,
        isDesktop: width >= mobileBreakpoint,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, [mobileBreakpoint]);

  return dimensions;
}
