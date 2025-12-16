'use client';

import { useState, useEffect } from 'react';
import { Heart, MessageSquare, Handshake, Bookmark } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { createSignInUrl } from '@/lib/redirect';
import FeedbackModal from './FeedbackModal';
import { businessStorage } from '@/lib/storage/businessStorage';
import { feedbackStorage } from '@/lib/storage/feedbackStorage';

interface ProReactionsProps {
  initialReactions?: {
    love?: number;
    feedback?: number;
    link?: number;
    save?: number;
  };
  onReaction?: (type: 'love' | 'feedback' | 'link' | 'save') => void;
  businessName?: string;
  contractorType?: string;
  logo?: string;
  businessId?: string;
  layout?: 'between' | 'around';
  gap?: string;
}

export default function ProReactions({ 
  initialReactions = { love: 0, feedback: 0, link: 0, save: 0 },
  onReaction,
  businessName = '',
  contractorType = '',
  logo,
  businessId = '',
  layout = 'between',
  gap = 'gap-0'
}: ProReactionsProps) {
  const [reactions, setReactions] = useState(initialReactions);
  const [activeReactions, setActiveReactions] = useState<Set<string>>(new Set());
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Update feedback count from actual comments
  const updateFeedbackCount = () => {
    if (!businessId || typeof window === 'undefined') return;
    
    const comments = feedbackStorage.getFeedback(businessId);
    const feedbackCount = comments.length;
    
    setReactions(prevReactions => {
      const updatedReactions = {
        ...prevReactions,
        feedback: feedbackCount
      };
      
      // Update business storage
      try {
        businessStorage.updateBusiness(businessId, {
          reactions: updatedReactions
        });
      } catch (error) {
        console.error('Error updating business reactions:', error);
      }
      
      return updatedReactions;
    });
  };

  // Load feedback count on mount and when businessId changes
  useEffect(() => {
    if (businessId) {
      updateFeedbackCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // Update feedback count when modal closes (comments may have changed)
  useEffect(() => {
    if (!isFeedbackModalOpen && businessId) {
      updateFeedbackCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFeedbackModalOpen, businessId]);

  const performReaction = (type: 'love' | 'feedback' | 'link' | 'save') => {
    // For feedback, just open modal, don't increment count
    if (type === 'feedback') {
      setIsFeedbackModalOpen(true);
      return;
    }

    const isActive = activeReactions.has(type);
    const currentCount = reactions[type] || 0;
    const newCount = isActive ? Math.max(0, currentCount - 1) : currentCount + 1;
    
    setActiveReactions(prev => {
      const newSet = new Set(prev);
      if (isActive) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });

    const updatedReactions = {
      ...reactions,
      [type]: newCount
    };
    
    setReactions(updatedReactions);

    // Sync with localStorage if businessId is provided
    if (businessId && typeof window !== 'undefined') {
      try {
        businessStorage.updateBusiness(businessId, {
          reactions: updatedReactions
        });
      } catch (error) {
        console.error('Error updating business reactions:', error);
      }
    }

    if (onReaction) {
      onReaction(type);
    }
  };

  const handleReaction = (e: React.MouseEvent, type: 'love' | 'feedback' | 'link' | 'save') => {
    e.stopPropagation();
    
    // Check authentication
    if (isLoading) {
      return;
    }
    
    if (!isAuthenticated) {
      const signInUrl = createSignInUrl(pathname);
      router.push(signInUrl);
      return;
    }
    
    performReaction(type);
  };

  const reactionConfig = [
    { type: 'love' as const, icon: Heart, label: 'Love', count: reactions.love || 0 },
    { type: 'feedback' as const, icon: MessageSquare, label: 'Feedback', count: reactions.feedback || 0 },
    { type: 'link' as const, icon: Handshake, label: 'Connect', count: reactions.link || 0 },
    { type: 'save' as const, icon: Bookmark, label: 'Save', count: reactions.save || 0 },
  ];

  const justifyClass = layout === 'around' ? 'justify-around' : 'justify-between';
  
  return (
    <div className="h-[60px] p-2 flex items-center justify-center overflow-hidden">
      <div className={`w-full flex items-center ${justifyClass} ${gap}`}>
        {reactionConfig.map(({ type, icon: Icon, label, count }) => {
          const isActive = activeReactions.has(type);
          return (
            <button
              key={type}
              onClick={(e) => handleReaction(e, type)}
              className={`group flex flex-col items-center justify-center gap-1.5 px-0.5 py-1 rounded-lg border-2 border-transparent transition-all font-medium cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-white text-black'
                  : 'bg-transparent text-black'
              }`}
              aria-label={label}
            >
              <div className="flex items-center justify-center gap-1">
                <Icon className={`w-4 h-4 transition-transform md:group-hover:scale-110 ${isActive && type === 'love' ? 'fill-red-500' : ''}`} />
                <span className="text-[10px] font-semibold leading-tight">{count}</span>
              </div>
              <div className="w-[60px] px-2 py-1.5 rounded border-2 border-black flex items-center justify-center">
                <span className="text-[10px] font-semibold leading-tight whitespace-nowrap">{label}</span>
              </div>
            </button>
          );
        })}
      </div>
      
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        businessName={businessName}
        contractorType={contractorType}
        logo={logo}
        businessId={businessId}
        onCommentsChange={updateFeedbackCount}
      />
    </div>
  );
}

