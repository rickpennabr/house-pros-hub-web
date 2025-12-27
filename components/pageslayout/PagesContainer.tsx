'use client';

import { ReactNode, useEffect, useRef } from 'react';

interface PageContainerProps {
  children: ReactNode;
}

export default function PageContainer({ children }: PageContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
      
      // Silently fail if analytics endpoint is not available
      // Use AbortController with timeout to fail fast and suppress console errors
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 100); // 100ms timeout
      
      fetch('http://127.0.0.1:7243/ingest/461d373c-ca6e-41da-982f-915e017b1f50', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'PagesContainer.tsx:20',
          message: 'Container dimensions and overflow',
          data: logData,
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'A',
        }),
        signal: controller.signal,
      }).catch(() => {
        // Silently handle errors - this is debug-only code
        // Network errors are expected when analytics service is not running
      }).finally(() => {
        clearTimeout(timeoutId);
      });
    };
    
    checkDimensions();
    const resizeObserver = new ResizeObserver(checkDimensions);
    resizeObserver.observe(containerEl);
    
    return () => resizeObserver.disconnect();
  }, []);
  // #endregion

  return (
    <div 
      ref={containerRef}
      className="w-full max-w-[960px] mx-auto bg-white flex flex-col min-h-0
      border-2 border-black rounded-lg h-[calc(100vh-1rem)] overflow-y-auto overflow-x-hidden
      md:rounded-none md:min-h-screen md:h-auto md:overflow-visible">
      {children}
    </div>
  );
}

