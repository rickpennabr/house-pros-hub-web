'use client';

import { ViewType } from '@/components/pageslayout/ViewToggle';
import ProCard, { ProCardData } from './ProCard';
import ProCardList from './ProCardList';
import { useEffect, useRef } from 'react';

interface ProCardGridProps {
  cards: ProCardData[];
  view?: ViewType;
  onShare?: (id: string) => void;
  onReaction?: (id: string, type: 'love' | 'feedback' | 'link' | 'save') => void;
}

export default function ProCardGrid({ cards, view = 'card', onShare, onReaction }: ProCardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // #region agent log - Development only
  useEffect(() => {
    // Only run debug logging in development mode
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof window === 'undefined') return;
    const gridEl = gridRef.current;
    if (!gridEl) return;
    
    const logData = {
      view,
      cardCount: cards.length,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      gridWidth: gridEl.offsetWidth,
      gridHeight: gridEl.offsetHeight,
      gridScrollWidth: gridEl.scrollWidth,
      gridScrollHeight: gridEl.scrollHeight,
      gridClientWidth: gridEl.clientWidth,
      gridClientHeight: gridEl.clientHeight,
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
        location: 'ProCardGrid.tsx:30',
        message: 'Grid mode dimensions',
        data: logData,
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: view === 'card' ? 'A' : 'B',
      }),
      signal: controller.signal,
    }).catch(() => {
      // Silently handle errors - this is debug-only code
      // Network errors are expected when analytics service is not running
    }).finally(() => {
      clearTimeout(timeoutId);
    });
  }, [view, cards.length]);
  // #endregion

  if (view === 'list') {
    return <ProCardList cards={cards} onShare={onShare} onReaction={onReaction} />;
  }

  return (
    <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 w-full">
      {cards.map((card) => (
        <ProCard
          key={card.id}
          data={card}
          onShare={onShare}
          onReaction={onReaction}
          isListMode={false}
        />
      ))}
    </div>
  );
}

