'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Crown, Info } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { formatDriveBytes } from '@/lib/drive/quota';
import type { DriveUsage } from '@/lib/drive/types';

const DOTS = 28;

interface ProDriveMeterProps {
  usage: DriveUsage | null;
}

export function ProDriveMeter({ usage }: ProDriveMeterProps) {
  const t = useTranslations('prodrive');
  const planLabel = useTranslations('subscription');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!usage) return null;

  const clamped = Math.min(1, Math.max(0, usage.percentUsed));
  const left = Math.max(0, Math.round((1 - clamped) * 100));
  const filled = Math.min(DOTS, Math.round(clamped * DOTS));
  const hint = t('usageHint', {
    used: formatDriveBytes(usage.usedBytes),
    included: formatDriveBytes(usage.freeBytes),
  });
  const dotClass = usage.isAtLimit ? 'bg-red-600' : usage.isAtWarning ? 'bg-amber-500' : 'bg-blue-600';

  const upgrade = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/billing/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ locale }),
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok) throw new Error(body.error || t('billingFailed'));
      if (body.url) window.location.href = body.url;
    } catch (upgradeError) {
      setError(upgradeError instanceof Error ? upgradeError.message : t('billingFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-xs rounded-2xl border-2 border-black bg-white p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-1 font-medium">
          {t('usage')}
          <button type="button" className="cursor-pointer text-gray-500" title={hint} aria-label={hint}>
            <Info className="h-3.5 w-3.5" />
          </button>
        </span>
        <span className="text-gray-600">{t('percentLeft', { percent: left })}</span>
      </div>
      <div
        className="mt-2 flex gap-0.5"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={left}
        aria-label={hint}
      >
        {Array.from({ length: DOTS }, (_, index) => (
          <span
            key={index}
            className={`h-2.5 flex-1 rounded-full ${index < filled ? dotClass : 'bg-gray-200'}`}
          />
        ))}
      </div>
      {usage.plan === 'free' && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Crown className="h-4 w-4" />
            {t('goPro')}
          </span>
          <Button type="button" size="sm" disabled={busy} onClick={() => void upgrade()}>
            {busy ? t('openingCheckout') : t('upgradeShort')}
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex items-center gap-2 border-t-2 border-black pt-3">
        <Image
          src="/house-pros-hub-logo-simble-bot.png"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-full border-2 border-black object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{t('title')}</p>
          <p className="text-xs text-gray-600">{usage.plan === 'pro' ? planLabel('pro') : planLabel('free')}</p>
        </div>
      </div>
    </div>
  );
}
