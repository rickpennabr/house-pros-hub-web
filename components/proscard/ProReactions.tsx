'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Heart, MessageSquare, Link, Bookmark } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSwitch } from '@/contexts/AccountSwitchContext';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { createSignInUrl } from '@/lib/redirect';
import { readReactionCounts, writeReactionCounts } from '@/lib/storage/reactionCounts';
import { savedBusinessStorage } from '@/lib/storage/savedBusinessStorage';
import {
  fetchSaveState,
  saveBusinessOnServer,
  syncLocalSavedBusinesses,
  unsaveBusinessOnServer,
} from '@/lib/saved/saved-business-client';
import Modal from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Button } from '@/components/ui/Button';

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
  const [switchSaveOpen, setSwitchSaveOpen] = useState(false);
  const [savedConfirmOpen, setSavedConfirmOpen] = useState(false);
  const { isAuthenticated, isLoading, user } = useAuth();
  const { activeAccountId, setActiveAccountId } = useAccountSwitch();
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
    if (!businessId) return;
    let cancelled = false;
    (async () => {
      if (user?.id) await syncLocalSavedBusinesses(user.id);
      const state = await fetchSaveState(businessId);
      if (cancelled) return;
      if (state) {
        setReactions((prev) => ({ ...prev, save: state.count }));
        setActiveReactions((prev) => {
          const next = new Set(prev);
          if (state.saved) next.add('save');
          else next.delete('save');
          return next;
        });
        return;
      }
      if (user?.id && savedBusinessStorage.isBusinessSaved(user.id, businessId)) {
        setActiveReactions((prev) => new Set(prev).add('save'));
      }
    })();
    return () => {
      cancelled = true;
    };
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

    // Save is stored on the user's account, not as a local reaction.
    if (type === 'save') return;

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
      [type]: newCount,
    };

    setReactions((prev) => ({ ...prev, [type]: newCount }));

    if (businessId) writeReactionCounts(businessId, updatedReactions);

    if (onReaction) {
      onReaction(type);
    }
  };

  const applySaveState = (saved: boolean, count: number) => {
    setReactions((prev) => ({ ...prev, save: count }));
    setActiveReactions((prev) => {
      const next = new Set(prev);
      if (saved) next.add('save');
      else next.delete('save');
      return next;
    });
  };

  const persistSave = async (removing: boolean): Promise<boolean> => {
    if (!user?.id || !businessId) return false;
    const state = removing
      ? await unsaveBusinessOnServer(businessId)
      : await saveBusinessOnServer(businessId);
    if (!state) {
      if (removing) savedBusinessStorage.removeSavedBusiness(user.id, businessId);
      else savedBusinessStorage.saveBusiness(user.id, businessId);
      const nextCount = Math.max(0, (reactions.save || 0) + (removing ? -1 : 1));
      applySaveState(!removing, nextCount);
    } else {
      savedBusinessStorage.removeSavedBusiness(user.id, businessId);
      applySaveState(state.saved, state.count);
    }
    onReaction?.('save');
    return true;
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
    if (type === 'save') {
      const removing = activeReactions.has('save');
      const uid = user?.id;
      const onBusinessProfile = Boolean(uid) && activeAccountId !== uid;
      if (!removing && onBusinessProfile) {
        setSwitchSaveOpen(true);
        return;
      }
      void persistSave(removing);
      return;
    }
    performReaction(type);
  };

  const confirmSwitchAndSave = async () => {
    const ok = await persistSave(false);
    if (!ok || !user?.id) return;
    setActiveAccountId(user.id);
    setSwitchSaveOpen(false);
    setSavedConfirmOpen(true);
  };

  const reactionConfig = [
    { type: 'love' as const, icon: Heart, label: t('love'), count: reactions.love || 0 },
    { type: 'feedback' as const, icon: MessageSquare, label: t('feedback'), count: reactions.feedback || 0 },
    { type: 'link' as const, icon: Link, label: t('link'), count: reactions.link || 0 },
    { type: 'save' as const, icon: Bookmark, label: t('save'), count: reactions.save || 0 },
  ];

  const justifyClass = layout === 'around' ? 'justify-around' : 'justify-between';
  const isCard = layout !== 'around';
  
  return (
    <div className={`procard-reactions flex w-full min-w-0 items-center justify-center px-1 ${isCard ? 'pt-1 pb-2' : 'py-1 md:[zoom:0.9]'}`}>
      <div className={`flex w-full min-w-0 items-center gap-1 ${justifyClass}`}>
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
                <Icon className={`w-4 h-4 transition-transform md:group-hover:scale-110 ${isCard ? 'md:w-3 md:h-3' : 'md:w-5 md:h-5'} ${getIconStyles()}`} />
                <span className={`font-semibold leading-tight ${getTextColor()} ${isCard ? 'text-[10px]' : 'text-[10px] md:text-sm'}`}>{count}</span>
              </div>
              <div className={`w-full min-w-0 rounded border-2 ${getBorderStyles()} bg-white flex items-center justify-center ${isCard ? 'px-1 py-1' : 'px-1 py-1 md:px-2 md:py-1.5'}`}>
                <span className={`font-semibold leading-tight whitespace-nowrap truncate ${getTextColor()} ${isCard ? 'text-[10px]' : 'text-[10px] md:text-base'}`}>{label}</span>
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
        isOpen={switchSaveOpen}
        onClose={() => setSwitchSaveOpen(false)}
        title={t('saveOnPersonalTitle')}
        showHeader
        showCloseButton
        maxWidth="sm"
        contentClassName="p-6 text-center"
      >
        <p className="mb-6 text-base text-black">{t('saveOnPersonalMessage')}</p>
        <Button type="button" variant="primary" className="w-full" onClick={confirmSwitchAndSave}>
          {t('yes')}
        </Button>
      </Modal>

      <ConfirmationModal
        isOpen={savedConfirmOpen}
        onClose={() => setSavedConfirmOpen(false)}
        title={t('savedTitle')}
        message={t('savedMessage')}
        primaryButton={{ label: t('ok'), onClick: () => setSavedConfirmOpen(false) }}
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

