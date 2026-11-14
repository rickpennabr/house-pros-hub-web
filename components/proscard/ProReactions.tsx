'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Heart, MessageSquare, Link, Bookmark } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { createSignInUrl } from '@/lib/redirect';
import { readReactionCounts, writeReactionCounts } from '@/lib/storage/reactionCounts';
import { savedBusinessStorage } from '@/lib/storage/savedBusinessStorage';
import Modal from '@/components/ui/Modal';

const FeedbackModal = dynamic(() => import('./FeedbackModal'), {
  ssr: false,
  loading: () => null,
});

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
  /** Public slug, used so the feedback page matches this card. */
  businessSlug?: string;
  /** Owner of the business. The feedback list also checks this on the server. */
  ownerUserId?: string;
  layout?: 'between' | 'around';
  gap?: string;
  /** When provided and user is not signed in, clicking a reaction invokes this instead of redirecting to sign-in */
  onSignInRequired?: () => void;
}

export default function ProReactions({ 
  initialReactions = { love: 0, feedback: 0, link: 0, save: 0 },
  onReaction,
  businessName = '',
  contractorType = '',
  logo,
  businessId = '',
  businessSlug,
  layout = 'between',
  gap = 'gap-0.5',
  onSignInRequired,
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

  useEffect(() => {
    if (!businessId) return;
    const stored = readReactionCounts(businessId);
    if (stored) {
      setReactions((prev) => ({
        ...prev,
        love: stored.love ?? prev.love,
        link: stored.link ?? prev.link,
        save: stored.save ?? prev.save,
      }));
    }
    let cancelled = false;
    fetch(`/api/businesses/${encodeURIComponent(businessId)}/feedback?summary=1`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || cancelled || typeof data.count !== 'number') return;
        setReactions((prev) => ({ ...prev, feedback: data.count }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  useEffect(() => {
    if (user?.id && businessId && typeof window !== 'undefined') {
      const isSaved = savedBusinessStorage.isBusinessSaved(user.id, businessId);
      if (isSaved) {
        setActiveReactions(prev => new Set(prev).add('save'));
      }
    }
  }, [user?.id, businessId]);

  const applyFeedbackCount = useCallback((count: number) => {
    setReactions((prev) => ({ ...prev, feedback: count }));
  }, []);

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
      [type]: newCount,
    };

    setReactions((prev) => ({ ...prev, [type]: newCount }));

    if (businessId) writeReactionCounts(businessId, updatedReactions);

    if (onReaction) {
      onReaction(type);
    }
  };

  const handleReaction = (e: React.MouseEvent, type: 'love' | 'feedback' | 'link' | 'save') => {
    e.stopPropagation();
    if (type === 'feedback') {
      setIsFeedbackModalOpen(true);
      return;
    }
    if (isLoading) return;
    if (!isAuthenticated) {
      if (onSignInRequired) {
        onSignInRequired();
        return;
      }
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
    <div className="procard-reactions px-1 py-1 flex items-center justify-center">
      <div className={`w-full flex items-center gap-1 ${justifyClass}`}>
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
          
          return (
            <button
              key={type}
              onClick={(e) => handleReaction(e, type)}
              className={`group flex flex-1 min-w-0 flex-col items-center justify-center px-0.5 rounded-lg transition-all font-medium cursor-pointer ${getButtonStyles()}`}
              aria-label={`${label}, ${count}`}
            >
              <div className="flex items-center justify-center gap-1 pb-1">
                <Icon className={`w-4 h-4 md:w-3 md:h-3 transition-transform md:group-hover:scale-110 ${getIconStyles()}`} />
                <span className={`text-[10px] font-semibold leading-tight ${getTextColor()}`}>{count}</span>
              </div>
              <div className={`w-full min-w-0 px-1 py-1 rounded border-2 ${getBorderStyles()} bg-white flex items-center justify-center`}>
                <span className={`text-[10px] font-semibold leading-tight whitespace-nowrap truncate ${getTextColor()}`}>{label}</span>
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
        businessSlug={businessSlug}
        onCountChange={applyFeedbackCount}
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

