'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Check, Loader2, Receipt } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { JOB_COST_CATEGORIES, BUSINESS_COST_CATEGORIES } from '@/lib/crm/job-financials';
import type { ChatExpenseDraft } from '@/lib/types/chat';

const CATEGORIES: string[] = [...JOB_COST_CATEGORIES, ...BUSINESS_COST_CATEGORIES, 'Other'];

/**
 * "Save expense?" card under ProBot's answer to a receipt photo. The pro checks the store, amount,
 * date and category, then taps Save: the expense goes to the CRM with the photo as its receipt.
 */
export function ExpenseDraftCard({
  draft,
  onSaved,
}: {
  draft: ChatExpenseDraft;
  /** Remember it on the message, so the card shows Saved after a refresh. */
  onSaved?: (expenseId: string) => void;
}) {
  const locale = useLocale();
  const [vendor, setVendor] = useState(draft.vendor);
  const [amount, setAmount] = useState(draft.amountCents ? (draft.amountCents / 100).toFixed(2) : '');
  const [date, setDate] = useState(draft.date);
  const [category, setCategory] = useState(CATEGORIES.includes(draft.category) ? draft.category : 'Materials');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(draft.savedExpenseId ?? null);

  const save = async () => {
    const cents = Math.round(parseFloat(amount.replace(/[^0-9.]/g, '')) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError('Enter the amount.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/expenses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: cents,
          category,
          expenseDate: date,
          description: [vendor.trim(), draft.description].filter(Boolean).join(' · ').slice(0, 200),
          receiptUrl: draft.receiptUrl,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; expense?: { id?: string }; error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not save the expense');
      const id = data.id ?? data.expense?.id ?? 'saved';
      setSavedId(id);
      onSaved?.(id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the expense');
    } finally {
      setBusy(false);
    }
  };

  if (savedId) {
    return (
      <div className="mt-2 flex w-full max-w-sm items-center gap-2 rounded-lg border-2 border-black bg-white p-3 text-sm">
        <Check className="h-4 w-4 shrink-0 text-green-700" aria-hidden />
        <span className="flex-1">Expense saved{vendor ? ` · ${vendor}` : ''}</span>
        <Link href={`/${locale}/crm/expenses`} className="font-medium underline">
          Open
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-2 w-full max-w-sm space-y-2 rounded-lg border-2 border-black bg-white p-3 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <Receipt className="h-4 w-4" aria-hidden /> Save expense?
      </p>
      <label className="block">
        <span className="text-xs text-gray-600">Store</span>
        <input value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={80} className="mt-0.5 h-10 w-full rounded-lg border-2 border-black px-2 text-base focus:outline-none" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-600">Amount ($)</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" className="mt-0.5 h-10 w-full rounded-lg border-2 border-black px-2 text-base focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-0.5 h-10 w-full rounded-lg border-2 border-black px-2 text-base focus:outline-none" />
        </label>
      </div>
      <label className="block">
        <span className="text-xs text-gray-600">Category</span>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-0.5">
          {CATEGORIES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-black font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save expense
      </button>
    </div>
  );
}
