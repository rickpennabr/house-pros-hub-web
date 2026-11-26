'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

/** A material from the Hardscape database, with the options and quantity the pro picked. */
export interface PickedMaterial {
  key: string;
  catalogItemId: string;
  name: string;
  brand: string;
  /** "Color: Sahara · Thickness: 60mm" */
  options: string;
  qty: number;
  unit: string;
  priceCents: number;
}

interface CatalogHit {
  id: string;
  name: string;
  brand: string;
  kind: string;
  category: string | null;
  unit: string;
  typical_price_cents: number | null;
  image_url: string | null;
  specs: { name: string; value: string }[] | null;
}

/** Specs with several values ("Sahara, Mirage, Tuscany") become a choice: color, thickness, size, shape. */
function choiceSpecs(item: CatalogHit): { name: string; values: string[] }[] {
  return (Array.isArray(item.specs) ? item.specs : [])
    .map((spec) => ({ name: spec.name, values: String(spec.value ?? '').split(/\s*[,;/|]\s*|\s+or\s+/).map((v) => v.trim()).filter(Boolean) }))
    .filter((spec) => spec.values.length > 1 && /colou?r|thick|size|shape|finish|texture|pattern|style/i.test(spec.name));
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Type to find any hardscape material (pavers, wall block, base, sand, gravel, rock).
 * Pick it, choose its options, enter the quantity, then add it or pick another.
 */
export function HardscapeMaterialPicker({
  picked,
  onChange,
}: {
  picked: PickedMaterial[];
  onChange: (next: PickedMaterial[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<CatalogHit | null>(null);
  const [optionValues, setOptionValues] = useState<Record<string, string>>({});
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const qtyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || chosen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load on open / reset when the input clears
      setHits([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      void fetch(`/api/crm/protrades/catalog?trade=hardscape&q=${encodeURIComponent(q)}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((body: { items?: CatalogHit[] }) => setHits((body.items ?? []).slice(0, 12)))
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, chosen]);

  const choose = (item: CatalogHit) => {
    setChosen(item);
    setQuery(item.brand ? `${item.name} · ${item.brand}` : item.name);
    setOptionValues(Object.fromEntries(choiceSpecs(item).map((spec) => [spec.name, spec.values[0]])));
    setPrice(item.typical_price_cents ? (item.typical_price_cents / 100).toFixed(2) : '');
    setQty('');
    setTimeout(() => qtyRef.current?.focus(), 0);
  };

  const reset = () => {
    setChosen(null);
    setQuery('');
    setOptionValues({});
    setQty('');
    setPrice('');
  };

  const add = () => {
    if (!chosen) return;
    const amount = Number(qty.replace(',', '.'));
    if (!(amount > 0)) {
      qtyRef.current?.focus();
      return;
    }
    const options = Object.entries(optionValues).map(([name, value]) => `${name}: ${value}`).join(' · ');
    onChange([
      ...picked,
      {
        key: `${chosen.id}-${Date.now()}`,
        catalogItemId: chosen.id,
        name: chosen.name,
        brand: chosen.brand,
        options,
        qty: Math.round(amount * 100) / 100,
        unit: chosen.unit,
        priceCents: Math.round((Number(price) || 0) * 100),
      },
    ]);
    reset();
  };

  const specs = chosen ? choiceSpecs(chosen) : [];

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-semibold text-gray-900">Materials from the Hardscape database</p>
      <div className="relative">
        <TypingSearchInput
          value={query}
          onChange={(value) => {
            if (chosen) setChosen(null);
            setQuery(value);
          }}
          placeholder="Type a material: washed concrete sand, pavers, base…"
          clearLabel="Clear"
        />
        {!chosen && query.trim().length >= 2 ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border-2 border-black bg-white shadow-lg">
            {loading ? (
              <p className="flex items-center gap-2 p-3 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</p>
            ) : hits.length === 0 ? (
              <p className="p-3 text-sm text-gray-500">No material matches “{query.trim()}”.</p>
            ) : (
              hits.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => choose(item)}
                  className="flex w-full items-center gap-3 border-b border-gray-100 p-2 text-left last:border-0 hover:bg-gray-50"
                >
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image_url} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                  ) : (
                    <span className="h-10 w-10 shrink-0 rounded-md bg-gray-100" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{item.name}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {[item.brand, item.category].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {item.typical_price_cents ? (
                    <span className="shrink-0 text-xs text-gray-600">{money(item.typical_price_cents)} / {item.unit}</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {chosen ? (
        <div className="space-y-3 rounded-lg bg-gray-50 p-3">
          {specs.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {specs.map((spec) => (
                <FormField key={spec.name} label={spec.name}>
                  <Select
                    value={optionValues[spec.name] ?? ''}
                    onChange={(e) => setOptionValues((current) => ({ ...current, [spec.name]: e.target.value }))}
                  >
                    {spec.values.map((value) => <option key={value} value={value}>{value}</option>)}
                  </Select>
                </FormField>
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <FormField label={`Quantity (${chosen.unit})`} required>
              <Input
                ref={qtyRef}
                type="number"
                inputMode="decimal"
                min={0}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                  }
                }}
                placeholder="0"
              />
            </FormField>
            <FormField label={`Price per ${chosen.unit} ($)`}>
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>Cancel</Button>
            <Button onClick={add} disabled={!(Number(qty.replace(',', '.')) > 0)}>
              <Plus className="mr-1 h-4 w-4" />
              Add material
            </Button>
          </div>
        </div>
      ) : null}

      {picked.length ? (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {picked.map((item) => (
            <li key={item.key} className="flex items-center gap-2 p-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-gray-900">{item.name}{item.brand ? ` · ${item.brand}` : ''}</span>
                {item.options ? <span className="block truncate text-xs text-gray-500">{item.options}</span> : null}
              </span>
              <span className="shrink-0 text-gray-700">{item.qty} {item.unit}</span>
              <span className="w-20 shrink-0 text-right text-gray-700">{money(Math.round(item.qty * item.priceCents))}</span>
              <button
                type="button"
                onClick={() => onChange(picked.filter((p) => p.key !== item.key))}
                className="shrink-0 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Estimate line for one picked material (billed by its own quantity, not the area size). */
export function pickedMaterialLine(item: PickedMaterial, where: string) {
  const name = item.brand ? `${item.name} (${item.brand})` : item.name;
  return {
    product_or_service: name,
    description: [item.options, `For ${where}`].filter(Boolean).join(' · '),
    unit: item.unit,
    qty: item.qty,
    rate_cents: item.priceCents,
    amount_cents: Math.round(item.qty * item.priceCents),
  };
}
