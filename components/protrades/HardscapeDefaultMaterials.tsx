'use client';

import { Check } from 'lucide-react';
import { defaultQty, type DefaultMaterial } from '@/lib/protrades/hardscape-defaults';
import type { PickedMaterial } from '@/components/protrades/HardscapeMaterialPicker';

/** The pro's choice on one default row. Quantity and price stay empty until typed (then they win). */
export interface DefaultPick {
  on: boolean;
  option: number;
  /** null = follow the size; '' = the pro cleared it to type another number. */
  qty: string | null;
}

export function pickFor(row: DefaultMaterial, picks: Record<string, DefaultPick>): DefaultPick {
  return picks[row.key] ?? { on: row.on, option: 0, qty: null };
}

/** Ticked defaults as estimate materials, quantities from the area size unless typed. */
export function defaultsToMaterials(
  rows: DefaultMaterial[],
  picks: Record<string, DefaultPick>,
  size: number
): PickedMaterial[] {
  const out: PickedMaterial[] = [];
  for (const row of rows) {
    const pick = pickFor(row, picks);
    if (!pick.on) continue;
    const option = row.options[pick.option] ?? row.options[0];
    const qty = pick.qty != null ? Number(pick.qty.replace(',', '.')) || 0 : defaultQty(option, size);
    if (!(qty > 0)) continue;
    out.push({
      key: `default-${row.key}`,
      catalogItemId: '',
      name: option.name,
      brand: '',
      options: '',
      qty,
      unit: option.unit,
    });
  }
  return out;
}

/** Each service's usual materials as buttons: tap to swap a choice or untick; numbers follow the size. */
export function HardscapeDefaultMaterials({
  rows,
  picks,
  onChange,
  size,
}: {
  rows: DefaultMaterial[];
  picks: Record<string, DefaultPick>;
  onChange: (next: Record<string, DefaultPick>) => void;
  size: number;
}) {
  if (!rows.length) return null;
  const set = (key: string, patch: Partial<DefaultPick>, row: DefaultMaterial) =>
    onChange({ ...picks, [key]: { ...pickFor(row, picks), ...patch } });

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-semibold text-gray-900">Usual materials for these services</p>
      <p className="text-xs text-gray-500">
        {size > 0 ? 'Quantities follow the size. Tap to change a choice or leave one out.' : 'Enter the size to fill in the quantities.'}
      </p>
      <ul className="divide-y divide-gray-100">
        {rows.map((row) => {
          const pick = pickFor(row, picks);
          const option = row.options[pick.option] ?? row.options[0];
          const autoQty = defaultQty(option, size);
          return (
            <li key={row.key} className={`space-y-2 py-2 ${pick.on ? '' : 'opacity-50'}`}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => set(row.key, { on: !pick.on }, row)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${pick.on ? 'border-black bg-black text-white' : 'border-gray-400 bg-white'}`}
                  aria-pressed={pick.on}
                  aria-label={`${pick.on ? 'Leave out' : 'Add'} ${row.role}`}
                >
                  {pick.on ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{row.role}</span>
              </div>
              {row.options.length > 1 ? (
                <div className="flex flex-wrap gap-2 pl-7">
                  {row.options.map((opt, index) => (
                    <button
                      key={opt.name}
                      type="button"
                      onClick={() => set(row.key, { option: index, on: true, qty: null }, row)}
                      className={`rounded-lg border-2 px-3 py-1.5 text-sm ${index === pick.option ? 'border-black bg-black text-white' : 'border-black bg-white text-gray-900 hover:bg-gray-50'}`}
                    >
                      {opt.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="pl-7 text-sm text-gray-900">{option.name}</p>
              )}
              {pick.on ? (
                <div className="flex flex-wrap items-center gap-2 pl-7 text-sm">
                  <input
                    inputMode="decimal"
                    value={pick.qty ?? (autoQty ? String(autoQty) : '')}
                    onChange={(e) => set(row.key, { qty: e.target.value }, row)}
                    className="w-20 rounded-lg border-2 border-black px-2 py-1"
                    aria-label={`${option.name} quantity`}
                    placeholder="0"
                  />
                  <span className="text-gray-600">{option.unit}</span>
                  {pick.qty != null ? (
                    <button type="button" onClick={() => set(row.key, { qty: null }, row)} className="text-xs text-gray-500 underline">
                      Use size
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
