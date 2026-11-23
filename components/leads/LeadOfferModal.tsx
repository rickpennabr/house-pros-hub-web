'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { LeadOfferCard } from '@/components/probot/LeadOfferCard';
import type { ChatLeadOffer } from '@/lib/types/chat';

/**
 * A job request opened from the bell or the Contacts pending list: the same card as in ProBot
 * (Add to my CRM, Decline with an "are you sure" box), without leaving the page.
 */
export function LeadOfferModal({
  lead,
  onClose,
  onAnswered,
}: {
  lead: ChatLeadOffer | null;
  onClose: () => void;
  onAnswered?: (lead: ChatLeadOffer) => void;
}) {
  const t = useTranslations('probot');
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <Modal
      isOpen={Boolean(lead)}
      onClose={() => {
        if (!confirmOpen) onClose();
      }}
      showHeader
      title={t('leadModalTitle')}
      maxWidth="md"
      contentClassName="p-4"
      preventCloseOnOverlayClick={confirmOpen}
    >
      {lead ? (
        <LeadOfferCard key={lead.referralId} lead={lead} canAnswer onAnswered={onAnswered} onConfirmOpenChange={setConfirmOpen} />
      ) : null}
    </Modal>
  );
}
