'use client';

import { useState } from 'react';
import { Heart, MessageSquare, Link as LinkIcon, Bookmark } from 'lucide-react';

interface BusinessInteractionButtonsProps {
  initialReactions?: {
    love?: number;
    feedback?: number;
    link?: number;
    save?: number;
  };
  onReaction?: (type: 'love' | 'feedback' | 'link' | 'save') => void;
}

export default function BusinessInteractionButtons({ 
  initialReactions = { love: 0, feedback: 0, link: 0, save: 0 },
  onReaction 
}: BusinessInteractionButtonsProps) {
  const [reactions, setReactions] = useState(initialReactions);
  const [activeReactions, setActiveReactions] = useState<Set<string>>(new Set());

  const handleReaction = (e: React.MouseEvent, type: 'love' | 'feedback' | 'link' | 'save') => {
    e.stopPropagation();
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
    { 
      type: 'love' as const, 
      icon: Heart, 
      label: 'Love', 
      count: reactions.love || 0
    },
    { 
      type: 'feedback' as const, 
      icon: MessageSquare, 
      label: 'Comment', 
      count: reactions.feedback || 0
    },
    { 
      type: 'link' as const, 
      icon: LinkIcon, 
      label: 'Link', 
      count: reactions.link || 0
    },
    { 
      type: 'save' as const, 
      icon: Bookmark, 
      label: 'Save', 
      count: reactions.save || 0
    },
  ];

  return (
    <div className="w-1/2 flex items-center">
      <div className="grid grid-cols-4 gap-2 w-full">
        {reactionConfig.map(({ type, icon: Icon, label, count }) => {
          const isActive = activeReactions.has(type);
          return (
            <button
              key={type}
              onClick={(e) => handleReaction(e, type)}
              className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg transition-all font-medium cursor-pointer ${
                isActive
                  ? 'bg-white text-black'
                  : 'bg-transparent text-black hover:bg-gray-50'
              }`}
              aria-label={label}
            >
              <Icon className={`w-5 h-5 ${isActive && type === 'love' ? 'fill-red-500' : ''}`} />
              <span className="text-xs font-semibold">{count > 0 ? count : label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

