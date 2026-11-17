'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';

export default function CrewInvitePage() {
  const t = useTranslations('maintenance');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user, isLoading } = useAuth();
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || !user || !token || status !== 'idle') return;
    void accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, token]);

  async function accept() {
    setStatus('working');
    setMessage(null);
    try {
      const response = await fetch('/api/crm/maintenance/crew/accept', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t('inviteAcceptFailed'));
      setStatus('done');
      setMessage(t('inviteAccepted'));
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : t('inviteAcceptFailed'));
    }
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto p-6">
        <h1 className="text-xl font-bold mb-2">{t('inviteTitle')}</h1>
        <p className="text-sm text-red-600">{t('inviteMissingToken')}</p>
      </div>
    );
  }

  if (!isLoading && !user) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-3">
        <h1 className="text-xl font-bold">{t('inviteTitle')}</h1>
        <p className="text-sm">{t('inviteSignInFirst')}</p>
        <Link href={`/${locale}/signin?next=/${locale}/crew-invite?token=${encodeURIComponent(token)}`}>
          <Button type="button">{t('signIn')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-xl font-bold">{t('inviteTitle')}</h1>
      {status === 'working' && <p className="text-sm">{t('inviteAccepting')}</p>}
      {message && <p className={`text-sm ${status === 'error' ? 'text-red-600' : 'text-green-700'}`}>{message}</p>}
      {status === 'done' && (
        <Link href={`/${locale}/crm/maintenance`}>
          <Button type="button">{t('openMaintenance')}</Button>
        </Link>
      )}
      {status === 'error' && (
        <Button type="button" onClick={() => { setStatus('idle'); }}>
          {t('retry')}
        </Button>
      )}
    </div>
  );
}
