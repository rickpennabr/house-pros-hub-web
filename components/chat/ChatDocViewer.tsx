'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { PublicEstimateView } from '@/components/estimates/PublicEstimateView';
import { PublicInvoiceView } from '@/components/invoices/PublicInvoiceView';

interface ChatDocViewerProps {
  kind: 'estimate' | 'invoice';
  token: string;
  title: string;
  /** Customer can approve or pay here; the pro only looks. */
  canAct: boolean;
  onClose: () => void;
}

/**
 * Full estimate or invoice over the chat. Closing it (button, Esc, or the backdrop)
 * leaves the person in the same chat; card payments come back to this chat too.
 */
export default function ChatDocViewer({ kind, token, title, canAct, onClose }: ChatDocViewerProps) {
  const t = useTranslations('probot');
  const [returnTo] = useState(() => `${window.location.pathname}${window.location.search}`);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/60 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white sm:h-[90vh] sm:max-w-4xl sm:rounded-2xl sm:border-2 sm:border-black"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b-2 border-black px-3 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border-2 border-black px-3 text-sm font-medium hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('crmDocViewerBack')}
          </button>
          <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {kind === 'estimate' ? (
            <PublicEstimateView token={token} embedded readOnly={!canAct} />
          ) : (
            <PublicInvoiceView token={token} embedded readOnly={!canAct} returnTo={returnTo} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
