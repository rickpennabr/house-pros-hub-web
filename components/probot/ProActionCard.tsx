'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';
import type { ChatProAction } from '@/lib/types/chat';

const DONE_TEXT: Record<ChatProAction['kind'], string> = {
  remind_invoice: 'Reminder sent',
  mark_invoice_paid: 'Payment recorded',
  schedule_visit: 'Added to your calendar',
  log_hours: 'Hours logged',
};

/**
 * Confirm card for a CRM action ProBot prepared. Nothing happens until Confirm; then the normal CRM
 * API runs with the pro's own session (same checks as the CRM screens).
 */
export function ProActionCard({ action, onDone }: { action: ChatProAction; onDone?: () => void }) {
  const locale = useLocale();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'cancelled'>(action.done ? 'done' : 'idle');
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!action.url.startsWith('/api/crm/')) return;
    setState('busy');
    setError(null);
    try {
      const res = await fetch(action.url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action.body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not do that');
      setState('done');
      onDone?.();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Could not do that');
      setState('idle');
    }
  };

  if (state === 'done') {
    return (
      <div className="mt-2 flex w-full max-w-sm items-center gap-2 rounded-lg border-2 border-black bg-white p-3 text-sm">
        <Check className="h-4 w-4 shrink-0 text-green-700" aria-hidden />
        <span className="flex-1">{DONE_TEXT[action.kind]}</span>
        {action.openUrl ? (
          <Link href={`/${locale}${action.openUrl}`} className="font-medium underline">
            Open
          </Link>
        ) : null}
      </div>
    );
  }
  if (state === 'cancelled') {
    return <p className="mt-2 text-xs text-gray-500">Cancelled. Nothing was done.</p>;
  }

  return (
    <div className="mt-2 w-full max-w-sm space-y-2 rounded-lg border-2 border-black bg-white p-3 text-sm">
      <p className="font-semibold">{action.title}</p>
      <ul className="space-y-0.5 text-gray-700">
        {action.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={state === 'busy'}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-black font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {state === 'busy' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setState('cancelled')}
          disabled={state === 'busy'}
          className="h-10 rounded-lg border-2 border-black px-4 font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
