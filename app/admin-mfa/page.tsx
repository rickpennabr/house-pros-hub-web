'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Smartphone, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TwoStepScanCard, type TwoStepScanCopy } from '@/components/security/TwoStepScanCard';

const SCAN_COPY: TwoStepScanCopy = {
  title: 'Admin two-step sign-in',
  heading: 'Scan to protect the admin account',
  steps: [
    'Open an authenticator app on your phone: Google Authenticator, Microsoft Authenticator, 1Password or Authy.',
    'Tap + (Add account) and point the camera at this code.',
    'Type the 6-digit code the app shows for House Pros Hub.',
  ],
  onThisPhone: 'Setting up on this phone? Tap here instead of scanning.',
  openApp: 'Open in authenticator app',
  cantScan: "Can't scan? Enter this key instead",
  copyKey: 'Copy key',
  copied: 'Copied',
  footer: 'Codes change every 30 seconds. Never share them with anyone.',
};

type Stage =
  | { kind: 'loading' }
  | { kind: 'signedOut' }
  | { kind: 'notAdmin' }
  | { kind: 'enroll'; factorId: string; uri: string; secret: string }
  | { kind: 'challenge'; factorId: string }
  | { kind: 'done'; factors: { id: string; name: string; created: string }[] }
  | { kind: 'error'; message: string };

/** Only a path inside this site. */
function safeNext(): string {
  const next = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') && !/[\\\s]|:\/\//.test(next) ? next : '/admin';
}

/**
 * Admin two-step sign-in (TOTP: Google Authenticator, 1Password, Authy…).
 * First visit: scan the QR code and enter a code. Every new session: enter a code.
 * proxy.ts keeps the admin account on this page until the session is aal2.
 */
export default function AdminMfaPage() {
  const supabase = createClient();
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const startEnroll = useCallback(async () => {
    // A half-finished setup leaves an unverified factor behind; clear it so enroll can start fresh.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const factor of list?.all ?? []) {
      if (factor.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    });
    if (enrollError || !data) {
      setStage({ kind: 'error', message: enrollError?.message ?? 'Could not start two-step setup.' });
      return;
    }
    setStage({ kind: 'enroll', factorId: data.id, uri: data.totp.uri, secret: data.totp.secret });
  }, [supabase]);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return setStage({ kind: 'signedOut' });
    const [{ data: aal }, { data: list }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    const verified = (list?.totp ?? []).filter((factor) => factor.status === 'verified');
    if (aal?.currentLevel === 'aal2') {
      return setStage({
        kind: 'done',
        factors: verified.map((factor) => ({ id: factor.id, name: factor.friendly_name ?? 'Authenticator', created: factor.created_at })),
      });
    }
    if (verified.length > 0) return setStage({ kind: 'challenge', factorId: verified[0].id });
    await startEnroll();
  }, [supabase, startEnroll]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (stage.kind !== 'enroll' && stage.kind !== 'challenge') return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: stage.factorId, code: code.trim() });
    setBusy(false);
    if (verifyError) {
      setError('That code did not work. Check the time on your phone and try the newest code.');
      return;
    }
    setCode('');
    setAdding(false);
    // A full page load so every server check sees the new aal2 session cookie at once.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(safeNext());
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign('/en/signin');
  }

  const codeForm = (label: string) => (
    <form onSubmit={submit} className="space-y-3">
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
        {busy ? 'Checking…' : 'Verify'}
      </button>
    </form>
  );

  if (stage.kind === 'enroll') {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-6 sm:py-12">
        <div className="mx-auto max-w-3xl space-y-3">
          {adding ? <p className="text-sm font-medium text-gray-700">Adding a backup authenticator.</p> : null}
          <TwoStepScanCard
            uri={stage.uri}
            secret={stage.secret}
            copy={SCAN_COPY}
            footerAction={
              <button type="button" onClick={() => void signOut()} className="flex items-center gap-1.5 text-sm text-gray-600 underline">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            }
          >
            {codeForm('6-digit code from the app')}
          </TwoStepScanCard>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <div className="mx-auto max-w-md space-y-5 rounded-lg border-2 border-black p-5">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <ShieldCheck className="h-6 w-6 text-red-600" />
          Admin two-step sign-in
        </h1>

        {stage.kind === 'loading' ? <p className="text-sm text-gray-600">Loading…</p> : null}

        {stage.kind === 'signedOut' ? (
          <p className="text-sm">
            Sign in first.{' '}
            <Link href="/en/signin" className="font-semibold text-red-600 underline">
              Sign in
            </Link>
          </p>
        ) : null}

        {stage.kind === 'notAdmin' ? <p className="text-sm">Two-step sign-in is only required for the admin account.</p> : null}

        {stage.kind === 'error' ? (
          <div className="space-y-2 text-sm">
            <p className="text-red-600">{stage.message}</p>
            <p className="text-gray-600">
              Make sure TOTP is enabled in Supabase Dashboard &gt; Authentication &gt; Multi-Factor, then reload.
            </p>
          </div>
        ) : null}

        {stage.kind === 'challenge' ? (
          <div className="space-y-4">
            <p className="flex items-start gap-2 text-sm text-gray-700">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
              Open your authenticator app and enter the current code for House Pros Hub.
            </p>
            {codeForm('6-digit code')}
          </div>
        ) : null}

        {stage.kind === 'done' ? (
          <div className="space-y-4 text-sm">
            <p className="font-medium text-green-700">Two-step sign-in is on for this session.</p>
            <ul className="space-y-1">
              {stage.factors.map((factor) => (
                <li key={factor.id} className="rounded-lg border border-gray-300 px-3 py-2">
                  {factor.name} <span className="text-gray-500">· added {new Date(factor.created).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
            <p className="text-gray-600">
              Tip: add a second authenticator (another phone or a password manager) so losing one phone does not lock you out.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href={safeNext()} className="rounded-lg bg-black px-4 py-2 font-semibold text-white">
                Continue
              </a>
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  void startEnroll();
                }}
                className="rounded-lg border-2 border-black px-4 py-2 font-semibold"
              >
                Add backup authenticator
              </button>
            </div>
          </div>
        ) : null}

        {stage.kind !== 'loading' && stage.kind !== 'signedOut' ? (
          <button type="button" onClick={() => void signOut()} className="flex items-center gap-1.5 text-sm text-gray-600 underline">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        ) : null}
      </div>
    </main>
  );
}
