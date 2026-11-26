'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { CreditCard, Loader2 } from 'lucide-react';

interface AccountStatus {
  businessId: string | null;
  name: string | null;
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

/**
 * Invoice settings → Card payments. Each business connects its own Stripe account (Stripe hosts the
 * setup: identity and bank). Customers can pay invoices by card only once it is ready, and the money
 * goes straight to that business's bank.
 */
export function CardPaymentsSettings() {
  const locale = useLocale();
  const [accounts, setAccounts] = useState<AccountStatus[] | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    const res = await fetch('/api/billing/connect', { credentials: 'include' }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { ready?: boolean; accounts?: AccountStatus[]; error?: string } | null;
    if (!res?.ok || !data) {
      setError(data?.error || 'Could not load card payments');
      setAccounts([]);
      return;
    }
    setNotReady(data.ready === false);
    setAccounts(data.accounts ?? []);
  }, []);

  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
      if (live) void load();
    });
    return () => {
      live = false;
    };
  }, [load]);

  const open = async (action: 'onboard' | 'dashboard', businessId: string | null) => {
    setBusyKey(`${action}:${businessId ?? ''}`);
    setError(null);
    try {
      const res = await fetch('/api/billing/connect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, businessId, locale }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not open Stripe');
      window.location.assign(data.url);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Could not open Stripe');
      setBusyKey(null);
    }
  };

  // Only show "Default" when it is the one in use, or there is no business at all.
  const rows = (accounts ?? []).filter((row) => row.businessId !== null || row.connected || (accounts ?? []).length === 1);

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 pt-4 text-base font-semibold text-gray-900">
        <CreditCard className="h-4 w-4" aria-hidden /> Card payments
      </h2>
      <p className="text-xs text-gray-500">
        Connect each business to Stripe so customers can pay invoices by card. The money goes straight to that business&apos;s bank
        account (Stripe&apos;s card fee applies). Until it is connected, invoices show no card button.
      </p>
      {accounts === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
      ) : notReady ? (
        <p className="text-sm text-gray-700">Card payments are being set up. Check back soon.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const key = row.businessId ?? '';
            const status = row.chargesEnabled
              ? row.payoutsEnabled
                ? 'Ready · payouts on'
                : 'Taking cards · add your bank in Stripe'
              : row.connected
                ? 'Finish setup in Stripe'
                : 'Not set up';
            return (
              <div key={key} className="flex flex-col gap-2 rounded-lg border-2 border-black p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.name || 'Invoices without a business'}</p>
                  <p className={`text-xs ${row.chargesEnabled ? 'text-green-700' : 'text-gray-600'}`}>{status}</p>
                </div>
                <div className="flex gap-2">
                  {!row.chargesEnabled || !row.payoutsEnabled ? (
                    <button
                      type="button"
                      onClick={() => void open('onboard', row.businessId)}
                      disabled={busyKey !== null}
                      className="flex h-9 items-center gap-2 rounded-lg bg-black px-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {busyKey === `onboard:${key}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {row.connected ? 'Finish setup' : 'Connect with Stripe'}
                    </button>
                  ) : null}
                  {row.connected && row.chargesEnabled ? (
                    <button
                      type="button"
                      onClick={() => void open('dashboard', row.businessId)}
                      disabled={busyKey !== null}
                      className="flex h-9 items-center gap-2 rounded-lg border-2 border-black px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      {busyKey === `dashboard:${key}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Stripe dashboard
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
