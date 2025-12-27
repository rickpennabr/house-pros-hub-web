'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ScrollPosition {
  scrollTop: number;
  isAtBottom: boolean;
  isAtTop: boolean;
}

export interface UseScrollPositionOptions {
  threshold?: number; // Threshold in pixels for "at bottom" detection (default: 50)
  topThreshold?: number; // Threshold in pixels for "at top" detection (default: 100)
  useRequestAnimationFrame?: boolean; // Use RAF for smoother detection (default: true)
}

/**
 * Hook to track scroll position and detect when user is at top or bottom
 * @param options - Configuration options
 * @returns Scroll position state
 */
export function useScrollPosition(options: UseScrollPositionOptions = {}): ScrollPosition {
  const {
    threshold = 50,
    topThreshold = 100,
    useRequestAnimationFrame = true,
  } = options;

  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>(() => {
    if (typeof window === 'undefined') {
      return {
        scrollTop: 0,
        isAtBottom: false,
        isAtTop: true,
      };
    }
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollBottom = scrollTop + windowHeight;
    
    return {
      scrollTop,
      isAtBottom: scrollBottom >= documentHeight - threshold,
      isAtTop: scrollTop < topThreshold,
    };
  });

  const updateScrollPosition = useCallback(() => {
    if (typeof window === 'undefined') return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollBottom = scrollTop + windowHeight;
    
    setScrollPosition({
      scrollTop,
      isAtBottom: scrollBottom >= documentHeight - threshold,
      isAtTop: scrollTop < topThreshold,
    });
  }, [threshold, topThreshold]);

  useEffect(() => {
    if (useRequestAnimationFrame) {
      let rafId: number | null = null;
      
      const handleScroll = () => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          updateScrollPosition();
          rafId = null;
        });
      };

      // Initial check - use requestAnimationFrame to defer initial update
      // This avoids setState in effect warning
      const initialCheck = requestAnimationFrame(() => {
        updateScrollPosition();
      });
      
      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('resize', updateScrollPosition);

      return () => {
        cancelAnimationFrame(initialCheck);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', updateScrollPosition);
        if (rafId) cancelAnimationFrame(rafId);
      };
    } else {
      // Simple scroll handler without RAF
      const timeoutId = window.setTimeout(() => {
        updateScrollPosition();
      }, 0);
      window.addEventListener('scroll', updateScrollPosition, { passive: true });
      window.addEventListener('resize', updateScrollPosition);

      return () => {
        window.clearTimeout(timeoutId);
        window.removeEventListener('scroll', updateScrollPosition);
        window.removeEventListener('resize', updateScrollPosition);
      };
    }
  }, [updateScrollPosition, useRequestAnimationFrame]);

  return scrollPosition;
}
