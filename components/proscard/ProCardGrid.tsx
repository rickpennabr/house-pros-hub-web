'use client';

import ProCard, { ProCardData } from './ProCard';

interface ProCardGridProps {
  cards: ProCardData[];
  onShare?: (id: string) => void;
  onReaction?: (id: string, type: 'love' | 'feedback' | 'link' | 'save') => void;
}

export default function ProCardGrid({ cards, onShare, onReaction }: ProCardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      {cards.map((card) => (
        <ProCard
          key={card.id}
          data={card}
          onShare={onShare}
          onReaction={onReaction}
        />
      ))}
    </div>
  );
}

