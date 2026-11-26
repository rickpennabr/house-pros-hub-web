'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

/** A material from the Hardscape database, with the options and quantity the pro picked. */
export interface PickedMaterial {
  key: string;
  catalogItemId: string;
  /** "mine" when catalogItemId is the pro's own product id. */
  source?: "mine";
  name: string;
  brand: string;
  /** "Color: Sahara · Thickness: 60mm" */
  options: string;
  qty: number;
  unit: string;
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
  /** "mine" = one of the pro's own CRM products, not in the Hub database. */
  source?: "mine";
}

/** Specs with several values ("Sahara, Mirage, Tuscany") become a choice: color, thickness, size, shape. */
function choiceSpecs(item: CatalogHit): { name: string; values: string[] }[] {
  return (Array.isArray(item.specs) ? item.specs : [])
    .map((spec) => ({ name: spec.name, values: String(spec.value ?? '').split(/\s*[,;/|]\s*|\s+or\s+/).map((v) => v.trim()).filter(Boolean) }))
    .filter((spec) => spec.values.length > 1 && /colou?r|thick|size|shape|finish|texture|pattern|style/i.test(spec.name));
}


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
  const qtyRef = useRef<HTMLInputElement>(null);
  // "Add material": not in the database yet -> save it to My products and pick it, without leaving the quote.
  const [adding, setAdding] = useState<{ name: string; unit: string; brand: string } | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const saveNewMaterial = async () => {
    if (!adding || !adding.name.trim()) return;
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await fetch('/api/crm/products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: adding.name.trim(), unit: adding.unit.trim() || 'each', brand: adding.brand.trim(), category: 'Hardscape' }),
      });
      const body = (await res.json().catch(() => ({}))) as { product?: { id: string; name: string; brand?: string | null; unit?: string | null }; error?: string };
      if (!res.ok || !body.product) throw new Error(body.error || 'Could not add the material');
      const product = body.product;
      setAdding(null);
      choose({
        id: product.id,
        name: product.name,
        brand: product.brand ?? '',
        kind: 'mine',
        category: 'Hardscape',
        unit: product.unit || adding.unit || 'each',
        typical_price_cents: null,
        image_url: null,
        specs: null,
        source: 'mine',
      });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Could not add the material');
    } finally {
      setAddBusy(false);
    }
  };

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || chosen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load on open / reset when the input clears
      setHits([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      void fetch(`/api/crm/protrades/catalog?trade=hardscape&mine=1&q=${encodeURIComponent(q)}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((body: { items?: CatalogHit[]; mine?: CatalogHit[] }) => setHits([...(body.items ?? []).slice(0, 12), ...(body.mine ?? []).slice(0, 8)]))
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, chosen]);

  const choose = (item: CatalogHit) => {
    setChosen(item);
    setQuery(item.brand ? `${item.name} · ${item.brand}` : item.name);
    setOptionValues(Object.fromEntries(choiceSpecs(item).map((spec) => [spec.name, spec.values[0]])));
    setQty('');
    setTimeout(() => qtyRef.current?.focus(), 0);
  };

  const reset = () => {
    setChosen(null);
    setQuery('');
    setOptionValues({});
    setQty('');
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
        source: chosen.source,
        name: chosen.name,
        brand: chosen.brand,
        options,
        qty: Math.round(amount * 100) / 100,
        unit: chosen.unit,
      },
    ]);
    reset();
  };

  const specs = chosen ? choiceSpecs(chosen) : [];

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-semibold text-gray-900">Pick from the Hardscape database or your products</p>
      <div className="relative">
        <TypingSearchInput
          value={query}
          onChange={(value) => {
            if (chosen) setChosen(null);
            setQuery(value);
          }}
          placeholder="Type a material: washed concrete sand, pavers, base…"
          inputClassName="h-10 w-full rounded-lg border-2 border-black bg-white pl-8 pr-2 sm:pl-10 text-base text-black placeholder:text-gray-500 focus:outline-none"
          clearLabel="Clear"
        />
        {!chosen && query.trim().length >= 2 ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border-2 border-black bg-white shadow-lg">
            {loading ? (
              <p className="flex items-center gap-2 p-3 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</p>
            ) : hits.length === 0 ? (
              <div className="space-y-2 p-3">
                <p className="text-sm text-gray-500">No material matches “{query.trim()}”.</p>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setAddError(null);
                    setAdding({ name: query.trim(), unit: 'each', brand: '' });
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add new material
                </Button>
              </div>
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
                      {[item.source === 'mine' ? 'My products' : null, item.brand, item.category].filter(Boolean).join(' · ')}
                    </span>
                  </span>
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
            <FormField label={`Estimated quantity (${chosen.unit})`} required>
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
      <Modal isOpen={adding !== null} onClose={() => (addBusy ? undefined : setAdding(null))} title="Add material" showHeader maxWidth="md" contentClassName="p-4">
        {adding ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void saveNewMaterial();
            }}
          >
            <p className="text-sm text-gray-600">Saved to your products, then added to this quote. You can add photos and prices later in Products.</p>
            <label className="block text-sm font-medium">
              Name
              <Input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} maxLength={160} required autoFocus />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">
                Unit
                <Select value={adding.unit} onChange={(e) => setAdding({ ...adding, unit: e.target.value })}>
                  {['each', 'bag', 'ton', 'yd', 'sq ft', 'LF', 'pallet', 'gal'].map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm font-medium">
                Brand (optional)
                <Input value={adding.brand} onChange={(e) => setAdding({ ...adding, brand: e.target.value })} maxLength={120} />
              </label>
            </div>
            {addError ? <p className="text-sm text-red-600">{addError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAdding(null)} disabled={addBusy}>Cancel</Button>
              <Button type="submit" disabled={addBusy || !adding.name.trim()}>
                {addBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                Add material
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}

