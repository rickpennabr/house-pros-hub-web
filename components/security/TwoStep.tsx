'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck, Smartphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TwoStepScanCard, type TwoStepScanCopy } from '@/components/security/TwoStepScanCard';

type Factor = { id: string; name: string; created: string };

/** Only a path inside this site. */
export function safeNextPath(fallback: string): string {
  const next = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') && !/[\\\s]|:\/\//.test(next) ? next : fallback;
}

async function notifyServer(event: 'enabled' | 'disabled') {
  await fetch('/api/auth/two-step', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch(() => undefined);
}

function CodeForm({
  label,
  busy,
  error,
  onSubmit,
}: {
  label: string;
  busy: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
}) {
  const t = useTranslations('twoStep');
  const [code, setCode] = useState('');
  return (
    <form
      className="space-y-2"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit(code.trim());
      }}
    >
      <label className="block text-sm font-medium">
        {label}
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          className="mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-center font-mono text-2xl tracking-[0.4em]"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full rounded-lg bg-black px-4 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {busy ? t('checking') : t('verify')}
      </button>
    </form>
  );
}

/**
 * Settings: turn two-step sign-in on (scan a QR code with an authenticator app), add a backup
 * authenticator, or turn it off. The proxy then asks for a code on every new session.
 */
export function TwoStepPanel() {
  const t = useTranslations('twoStep');
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolling, setEnrolling] = useState<{ factorId: string; uri: string; secret: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(t('loadFailed'));
      setFactors([]);
      return;
    }
    setFactors(
      (data?.totp ?? [])
        .filter((factor) => factor.status === 'verified')
        .map((factor) => ({ id: factor.id, name: factor.friendly_name ?? 'Authenticator', created: factor.created_at }))
    );
  }, [supabase, t]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function startSetup() {
    setBusy(true);
    setError(null);
    setNotice(null);
    // A half-finished setup leaves an unverified factor; clear it so a new one can start.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const factor of list?.all ?? []) {
      if (factor.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `${t('authenticator')} ${(factors?.length ?? 0) + 1} · ${new Date().toLocaleDateString()}`,
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(enrollError?.message ?? t('setupFailed'));
      return;
    }
    setEnrolling({ factorId: data.id, uri: data.totp.uri, secret: data.totp.secret });
  }

  async function confirmSetup(code: string) {
    if (!enrolling) return;
    setBusy(true);
    setError(null);
    const wasOff = (factors?.length ?? 0) === 0;
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.factorId, code });
    setBusy(false);
    if (verifyError) {
      setError(t('badCode'));
      return;
    }
    setEnrolling(null);
    setNotice(wasOff ? t('enabledDone') : t('backupAdded'));
    await notifyServer('enabled');
    await load();
  }

  async function cancelSetup() {
    if (enrolling) await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    setEnrolling(null);
    setError(null);
  }

  async function removeFactor(factor: Factor) {
    const last = (factors?.length ?? 0) <= 1;
    if (!window.confirm(last ? t('turnOffConfirm') : t('removeConfirm', { name: factor.name }))) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setBusy(false);
    if (removeError) {
      setError(t('removeFailed'));
      return;
    }
    if (last) {
      setNotice(t('turnedOff'));
      await notifyServer('disabled');
    }
    await load();
  }

  const on = (factors?.length ?? 0) > 0;
  const scanCopy: TwoStepScanCopy = {
    title: t('scanTitle'),
    heading: t('scanHeading'),
    steps: [t('scanStep1'), t('scanStep2'), t('scanStep3')],
    onThisPhone: t('onThisPhone'),
    openApp: t('openApp'),
    cantScan: t('cantScan'),
    copyKey: t('copyKey'),
    copied: t('copiedKey'),
    footer: t('scanFooter'),
  };

  return (
    <div className="space-y-3 rounded-lg px-4 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-black">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {t('title')}
          </p>
          <p className="mt-0.5 text-xs text-gray-600">{t('intro')}</p>
        </div>
        {factors === null ? null : (
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${on ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}
          >
            {on ? t('statusOn') : t('statusOff')}
          </span>
        )}
      </div>

      {notice ? <p className="text-sm font-medium text-green-700">{notice}</p> : null}
      {error && !enrolling ? <p className="text-sm text-red-600">{error}</p> : null}

      {enrolling ? (
        <TwoStepScanCard
          uri={enrolling.uri}
          secret={enrolling.secret}
          copy={scanCopy}
          footerAction={
            <button type="button" onClick={() => void cancelSetup()} className="text-sm text-gray-600 underline">
              {t('cancel')}
            </button>
          }
        >
          <CodeForm label={t('codeLabel')} busy={busy} error={error} onSubmit={(code) => void confirmSetup(code)} />
        </TwoStepScanCard>
      ) : factors === null ? null : (
        <>
          {on ? (
            <ul className="space-y-1">
              {factors.map((factor) => (
                <li key={factor.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <Smartphone className="h-4 w-4 shrink-0" />
                    <span className="truncate">{factor.name}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeFactor(factor)}
                    className="shrink-0 text-xs font-medium text-red-600 disabled:opacity-60"
                  >
                    {t('remove')}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {on ? <p className="text-xs text-gray-600">{t('backupTip')}</p> : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => void startSetup()}
            className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${on ? 'border-2 border-black bg-white text-black' : 'bg-black text-white'}`}
          >
            {on ? t('addBackup') : t('enable')}
          </button>
        </>
      )}
    </div>
  );
}

/** The code page a session lands on after the password (or Google) when two-step is on. */
export function TwoStepChallenge({ locale }: { locale: string }) {
  const t = useTranslations('twoStep');
  const supabase = createClient();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'signedOut'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const home = `/${locale}`;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!userData.user) return setState('signedOut');
      const [{ data: aal }, { data: list }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      if (cancelled) return;
      const verified = (list?.totp ?? []).find((factor) => factor.status === 'verified');
      // Nothing to ask (already done, or two-step is off): continue.
      if (aal?.currentLevel === 'aal2' || !verified) {
        window.location.replace(safeNextPath(home));
        return;
      }
      setFactorId(verified.id);
      setState('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, home]);

  async function submit(code: string) {
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) {
      setBusy(false);
      setError(t('badCode'));
      return;
    }
    // Full page load so every server check sees the new session cookie at once.
    window.location.replace(safeNextPath(home));
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace(`/${locale}/signin`);
  }

  return (
    <div className="mx-auto mt-10 max-w-md space-y-4 rounded-lg border-2 border-black bg-white p-5">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <ShieldCheck className="h-6 w-6 text-red-600" />
        {t('challengeTitle')}
      </h1>
      {state === 'loading' ? <p className="text-sm text-gray-600">{t('loading')}</p> : null}
      {state === 'signedOut' ? <p className="text-sm">{t('signedOut')}</p> : null}
      {state === 'ready' ? (
        <>
          <p className="flex items-start gap-2 text-sm text-gray-700">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
            {t('challengeIntro')}
          </p>
          <CodeForm label={t('codeLabel')} busy={busy} error={error} onSubmit={(code) => void submit(code)} />
          <p className="text-xs text-gray-600">{t('lostPhone')}</p>
        </>
      ) : null}
      {state !== 'loading' ? (
        <button type="button" onClick={() => void signOut()} className="text-sm text-gray-600 underline">
          {t('signOut')}
        </button>
      ) : null}
    </div>
  );
}
