'use client';

import type { DiscountKind } from '@/lib/crm/document-discount';

interface DiscountFieldProps {
  kind: DiscountKind;
  value: string;
  onChange: (kind: DiscountKind, value: string) => void;
  /** Cents taken off, shown on the right. */
  discountCents: number;
  formatAmount: (cents: number) => string;
  disabled?: boolean;
}

/**
 * The Discount row under Subtotal on an estimate or invoice, as in QuickBooks: pick percent or
 * dollar amount, type the number, and the amount taken off shows on the right.
 */
export function DiscountField({ kind, value, onChange, discountCents, formatAmount, disabled = false }: DiscountFieldProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-600">Discount</span>
      <span className="flex items-center gap-1">
        <span className="inline-flex overflow-hidden rounded-md border-2 border-black text-xs font-medium" role="group" aria-label="Discount type">
          {(['percent', 'amount'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option, value)}
              disabled={disabled}
              aria-pressed={kind === option}
              className={`px-2 py-1 ${kind === option ? 'bg-black text-white' : 'bg-white text-black'}`}
            >
              {option === 'percent' ? '%' : '$'}
            </button>
          ))}
        </span>
        <input
          value={value}
          onChange={(event) => onChange(kind, event.target.value)}
          inputMode="decimal"
          placeholder={kind === 'percent' ? '0' : '0.00'}
          aria-label={kind === 'percent' ? 'Discount percent' : 'Discount amount in dollars'}
          disabled={disabled}
          className="w-16 rounded-lg border-2 border-black px-2 py-1 text-right text-sm"
        />
        <span className="w-20 text-right text-red-700">{discountCents > 0 ? `−${formatAmount(discountCents)}` : formatAmount(0)}</span>
      </span>
    </div>
  );
}
