'use client';

import { useState } from 'react';
import { Heart, MessageSquare, Link as LinkIcon, Bookmark } from 'lucide-react';

interface ProReactionsProps {
  initialReactions?: {
    love?: number;
    feedback?: number;
    link?: number;
    save?: number;
  };
  onReaction?: (type: 'love' | 'feedback' | 'link' | 'save') => void;
}

export default function ProReactions({ 
  initialReactions = { love: 0, feedback: 0, link: 0, save: 0 },
  onReaction 
}: ProReactionsProps) {
  const [reactions, setReactions] = useState(initialReactions);
  const [activeReactions, setActiveReactions] = useState<Set<string>>(new Set());

  const handleReaction = (type: 'love' | 'feedback' | 'link' | 'save') => {
    const isActive = activeReactions.has(type);
    
    setActiveReactions(prev => {
      const newSet = new Set(prev);
      if (isActive) {
        newSet.delete(type);
        setReactions(prevReactions => ({
          ...prevReactions,
          [type]: (prevReactions[type] || 0) - 1
        }));
      } else {
        newSet.add(type);
        setReactions(prevReactions => ({
          ...prevReactions,
          [type]: (prevReactions[type] || 0) + 1
        }));
      }
      return newSet;
    });

    if (onReaction) {
      onReaction(type);
    }
  };

  const reactionConfig = [
    { type: 'love' as const, icon: Heart, label: 'Love', count: reactions.love || 0 },
    { type: 'feedback' as const, icon: MessageSquare, label: 'Feedback', count: reactions.feedback || 0 },
    { type: 'link' as const, icon: LinkIcon, label: 'Link', count: reactions.link || 0 },
    { type: 'save' as const, icon: Bookmark, label: 'Save', count: reactions.save || 0 },
  ];

  return (
    <div className="h-[60px] p-2 flex items-center">
      <div className="w-full flex items-center justify-between gap-1">
        {reactionConfig.map(({ type, icon: Icon, label, count }) => {
          const isActive = activeReactions.has(type);
          return (
            <button
              key={type}
              onClick={() => handleReaction(type)}
              className={`flex items-center gap-3 md:gap-2 px-2 py-3 lg:px-1 md:py-2.5 rounded-full border-2 transition-all font-medium cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-white border-black text-black'
                  : 'bg-transparent border-transparent text-black hover:border-gray-400'
              }`}
              aria-label={label}
            >
              <Icon className={`w-6 h-6 md:w-5 md:h-5 ${isActive && type === 'love' ? 'fill-black' : ''}`} />
              <span className="text-lg md:text-base">{count > 0 ? count : label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

