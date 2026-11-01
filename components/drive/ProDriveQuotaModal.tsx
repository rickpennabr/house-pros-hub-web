'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatDriveBytes } from '@/lib/drive/quota';
import type { DriveUsage } from '@/lib/drive/types';

interface ProDriveQuotaModalProps {
  usage: DriveUsage | null;
  onClose: () => void;
}

export function ProDriveQuotaModal({ usage, onClose }: ProDriveQuotaModalProps) {
  const t = useTranslations('prodrive');
  const locale = useLocale();
  const [busy, setBusy] = useState<'pro' | 'overage' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (path: string, kind: 'pro' | 'overage') => {
    setBusy(kind);
    setError(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ locale }),
      });
      const body = (await response.json()) as { url?: string; error?: string; alreadyEnabled?: boolean };
      if (!response.ok) throw new Error(body.error || t('billingFailed'));
      if (body.alreadyEnabled) {
        onClose();
        return;
      }
      if (body.url) window.location.href = body.url;
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : t('billingFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal isOpen={Boolean(usage)} onClose={onClose} title={t('quotaTitle')} showHeader showCloseButton maxWidth="sm">
      {usage && (
        <div className="space-y-3 text-sm">
          <p>
            {t('quotaBody', {
              used: formatDriveBytes(usage.usedBytes),
              included: formatDriveBytes(usage.freeBytes),
            })}
          </p>
          {error && <p className="text-red-600">{error}</p>}
          <div className="flex flex-col gap-2">
            {usage.plan === 'free' && (
              <Button type="button" disabled={busy !== null} onClick={() => start('/api/billing/create-subscription', 'pro')}>
                {busy === 'pro' ? t('openingCheckout') : t('upgrade')}
              </Button>
            )}
            {!usage.overageEnabled && (
              <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => start('/api/billing/create-drive-overage', 'overage')}>
                {busy === 'overage' ? t('openingCheckout') : t('enableOverage')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
