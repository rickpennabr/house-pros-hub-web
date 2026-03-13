'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sendAnalyticsIngest } from '@/lib/utils/analyticsIngest';

const EMERGING_FROM_PROBOT_KEY = 'emergingFromProbot';
const EMERGE_DURATION_MS = 500;

interface PageContainerProps {
  children: ReactNode;
  /** When true, card background is transparent so sky animation shows through (test / chatbot-style). */
  transparentBg?: boolean;
}

export default function PageContainer({ children, transparentBg = false }: PageContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [emerging, setEmerging] = useState(false);
  const [emerged, setEmerged] = useState(false);

  // #region agent log - Development only
  useEffect(() => {
    // Only run debug logging in development mode
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window === 'undefined') return;
    const containerEl = containerRef.current;
    if (!containerEl) return;
    
    const checkDimensions = () => {
      // Double-check we're in development before making the request
      if (process.env.NODE_ENV !== 'development') return;
      
      const logData = {
        containerWidth: containerEl.offsetWidth,
        containerHeight: containerEl.offsetHeight,
        containerScrollWidth: containerEl.scrollWidth,
        containerScrollHeight: containerEl.scrollHeight,
        containerClientWidth: containerEl.clientWidth,
        containerClientHeight: containerEl.clientHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        hasHorizontalOverflow: containerEl.scrollWidth > containerEl.clientWidth,
        hasVerticalOverflow: containerEl.scrollHeight > containerEl.clientHeight,
        isMobile: window.innerWidth < 768,
      };
      
      sendAnalyticsIngest({
        location: 'PagesContainer.tsx:20',
        message: 'Container dimensions and overflow',
        data: logData,
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A',
      });
    };
    
    checkDimensions();
    const resizeObserver = new ResizeObserver(checkDimensions);
    resizeObserver.observe(containerEl);
    
    return () => resizeObserver.disconnect();
  }, []);
  // #endregion

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const key = sessionStorage.getItem(EMERGING_FROM_PROBOT_KEY);
    if (!key) return;
    setEmerging(true);
    sessionStorage.removeItem(EMERGING_FROM_PROBOT_KEY);
  }, []);

  useEffect(() => {
    if (!emerging) return;
    const t = setTimeout(() => setEmerged(true), 50);
    const t2 = setTimeout(() => setEmerging(false), EMERGE_DURATION_MS + 100);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [emerging]);

  const scaleClass = emerging && !emerged ? 'scale-0' : 'scale-100';

  return (
    <div
      ref={containerRef}
      className={`w-full max-w-[960px] mx-auto flex flex-col min-h-0
      border-2 rounded-lg h-[calc(100vh-1rem)] overflow-y-auto overflow-x-hidden
      md:my-2 md:h-[calc(100vh-1rem)]
      transition-transform duration-[500ms] ease-out origin-center ${scaleClass}
      ${transparentBg ? 'main-layout-card-transparent' : 'bg-white border-black'}`}>
      {children}
    </div>
  );
}

