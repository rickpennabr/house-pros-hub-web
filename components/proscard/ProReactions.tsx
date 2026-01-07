'use client';

import { useState, useEffect } from 'react';
import { Heart, MessageSquare, Link, Bookmark } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { createSignInUrl } from '@/lib/redirect';
import FeedbackModal from './FeedbackModal';
import { businessStorage } from '@/lib/storage/businessStorage';
import { feedbackStorage } from '@/lib/storage/feedbackStorage';
import { savedBusinessStorage } from '@/lib/storage/savedBusinessStorage';
import Modal from '@/components/ui/Modal';

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
  gap = 'gap-0.5'
}: ProReactionsProps) {
  const [reactions, setReactions] = useState(initialReactions);
  const [activeReactions, setActiveReactions] = useState<Set<string>>(new Set());
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('reactions');

  // Check if business is saved by current user on mount
  useEffect(() => {
    if (user?.id && businessId && typeof window !== 'undefined') {
      const isSaved = savedBusinessStorage.isBusinessSaved(user.id, businessId);
      if (isSaved) {
        setActiveReactions(prev => new Set(prev).add('save'));
      }
    }
  }, [user?.id, businessId]);

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

  // Auto-close coming soon modal after 3 seconds
  useEffect(() => {
    if (isComingSoonModalOpen) {
      const timer = setTimeout(() => {
        setIsComingSoonModalOpen(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isComingSoonModalOpen]);

  const performReaction = (type: 'love' | 'feedback' | 'link' | 'save') => {
    // For feedback, just open modal, don't increment count
    if (type === 'feedback') {
      setIsFeedbackModalOpen(true);
      return;
    }

    // For link (Connect), show coming soon modal
    if (type === 'link') {
      setIsComingSoonModalOpen(true);
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

    // Handle save action with saved businesses storage
    if (type === 'save' && user?.id && businessId && typeof window !== 'undefined') {
      if (isActive) {
        savedBusinessStorage.removeSavedBusiness(user.id, businessId);
      } else {
        savedBusinessStorage.saveBusiness(user.id, businessId);
      }
    }

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
      const signInUrl = createSignInUrl(locale as 'en' | 'es', pathname);
      router.push(signInUrl);
      return;
    }
    
    performReaction(type);
  };

  const reactionConfig = [
    { type: 'love' as const, icon: Heart, label: t('love'), count: reactions.love || 0 },
    { type: 'feedback' as const, icon: MessageSquare, label: t('feedback'), count: reactions.feedback || 0 },
    { type: 'link' as const, icon: Link, label: t('link'), count: reactions.link || 0 },
    { type: 'save' as const, icon: Bookmark, label: t('save'), count: reactions.save || 0 },
  ];

  const justifyClass = layout === 'around' ? 'justify-around' : 'justify-between';
  
  return (
    <div className="h-[60px] p-2 flex items-center justify-center overflow-hidden mb-1 md:mb-0">
      <div className={`w-full flex items-center ${justifyClass} ${gap}`}>
        {reactionConfig.map(({ type, icon: Icon, label, count }) => {
          const isActive = activeReactions.has(type);
          // Special styling for active states
          const getButtonStyles = () => {
            if (!isActive) return 'bg-transparent text-black';
            if (type === 'love') return 'bg-white text-red-500';
            if (type === 'save') return 'bg-white text-green-500';
            if (type === 'link') return 'bg-white text-purple-500';
            return 'bg-white text-black';
          };
          
          const getBorderStyles = () => {
            if (!isActive) return 'border-black';
            if (type === 'love') return 'border-red-500';
            if (type === 'save') return 'border-green-500';
            if (type === 'link') return 'border-purple-500';
            return 'border-black';
          };
          
          const getIconStyles = () => {
            if (type === 'feedback') {
              // Fill feedback icon when there are comments
              const feedbackCount = reactions.feedback || 0;
              return feedbackCount > 0 ? 'fill-black text-black' : '';
            }
            if (!isActive) return '';
            if (type === 'love') return 'fill-red-500 text-red-500';
            if (type === 'save') return 'fill-green-500 text-green-500';
            if (type === 'link') return 'fill-purple-500 text-purple-500';
            return '';
          };
          
          const getTextColor = () => {
            if (!isActive) return 'text-black';
            if (type === 'love') return 'text-red-500';
            if (type === 'save') return 'text-green-500';
            if (type === 'link') return 'text-purple-500';
            return 'text-black';
          };
          
          // Reaction label backgrounds: 90px on mobile, original widths on desktop
          const getButtonWidth = () => {
            if (type === 'love') return 'w-[90px] md:w-[70px]';
            if (type === 'feedback') return 'w-[100px] md:w-[75px]';
            if (type === 'link') return 'w-[80px] md:w-[60px]';
            if (type === 'save') return 'w-[80px] md:w-[60px]';
            return 'w-[90px] md:w-[60px]';
          };
          
          // Get padding for reaction label container
          const getLabelPadding = () => {
            if (type === 'link' || type === 'save') return 'px-2';
            return 'px-4';
          };
          
          return (
            <button
              key={type}
              onClick={(e) => handleReaction(e, type)}
              className={`group flex flex-col items-center justify-center gap-1.5 px-0.5 py-1 rounded-lg transition-all font-medium cursor-pointer shrink-0 ${getButtonStyles()}`}
              aria-label={label}
            >
              <div className="flex items-center justify-center gap-1">
                <Icon className={`w-4 h-4 transition-transform md:group-hover:scale-110 ${getIconStyles()}`} />
                <span className={`text-sm md:text-[10px] font-semibold leading-tight ${getTextColor()}`}>{count}</span>
              </div>
              <div className={`${getButtonWidth()} ${getLabelPadding()} py-1.5 rounded border-2 ${getBorderStyles()} bg-white flex items-center justify-center`}>
                <span className={`text-sm md:text-[10px] font-semibold leading-tight whitespace-nowrap ${getTextColor()}`}>{label}</span>
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

      <Modal
        isOpen={isComingSoonModalOpen}
        onClose={() => setIsComingSoonModalOpen(false)}
        title="Coming Soon"
        showHeader={true}
        maxWidth="sm"
      >
        <div className="p-6 text-center">
          <p className="text-lg text-black mb-4">
            This feature will come soon.
          </p>
          <button
            onClick={() => setIsComingSoonModalOpen(false)}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold"
          >
            OK
          </button>
        </div>
      </Modal>
    </div>
  );
}

