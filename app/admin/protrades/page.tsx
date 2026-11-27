'use client';
import { uploadWithProgress } from '@/lib/upload/uploadWithProgress';

import { useCallback, useEffect, useState } from 'react';
import { Download, Pencil, Plus, Trash2, X } from 'lucide-react';
import { FileDropZone } from '@/components/ui/FileDropZone';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { SimpleConfirmDialog } from '@/components/ui/SimpleConfirmDialog';
import { HARDSCAPE_COLLECTIONS, PLANT_CATEGORIES, TRADES, TRADE_SLUGS, defaultUnitFor, type TradeSlug } from '@/lib/protrades/trades';

interface Item {
  id?: string;
  trade: TradeSlug;
  kind: string;
  name: string;
  brand: string;
  scientific_name: string | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  unit: string;
  typical_price_cents: number | null;
  specs: { name: string; value: string }[];
  region: string;
  also_trades?: string[];
  is_active: boolean;
  sort_order: number;
}

const KIND_LABEL: Record<string, string> = {
  plant: 'Plant',
  paver: 'Paver',
  wall_block: 'Wall block',
  base: 'Base material',
  sand: 'Sand',
  edging: 'Edging',
  fabric: 'Fabric',
  sealer: 'Sealer',
  rock: 'Decorative rock',
  boulder: 'Boulder',
  soil: 'Sand, soil & gravel',
  flagstone: 'Flagstone',
  other: 'Other',
};
const TRADE_LABEL: Record<TradeSlug, string> = { landscape: 'Landscape · plants & rock', hardscape: 'Hardscape · rock & products' };
const ADD_LABEL: Record<TradeSlug, string> = { landscape: 'Add plant', hardscape: 'Add hardscape product' };
const input = 'w-full rounded-lg border-2 border-black px-3 py-2 text-sm';
const label = 'mb-1 block text-xs font-semibold uppercase text-gray-600';

function blankItem(trade: TradeSlug): Item {
  const kind = TRADES[trade].kinds[0].slug;
  return {
    trade,
    kind,
    name: '',
    brand: '',
    scientific_name: null,
    category: null,
    description: null,
    image_url: null,
    unit: defaultUnitFor(trade, kind),
    typical_price_cents: null,
    specs: trade === 'landscape' ? [{ name: 'Sun', value: '' }, { name: 'Water', value: '' }, { name: 'Mature size', value: '' }, { name: 'Bloom', value: '' }] : [],
    region: 'las-vegas',
    is_active: true,
    sort_order: 0,
  };
}

function ItemEditor({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<Item>(item);
  const [price, setPrice] = useState(item.typical_price_cents != null ? (item.typical_price_cents / 100).toFixed(2) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Item>(key: K, value: Item[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const isPlant = draft.kind === 'plant';
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('trade', draft.trade);
      const res = await uploadWithProgress('/api/admin/protrades/upload', { method: 'POST', credentials: 'include', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not upload the photo');
      set('image_url', data.image_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the photo');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/protrades/catalog', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          image_url: draft.image_url?.trim() || null,
          typical_price_cents: price.trim() ? Math.round(Number.parseFloat(price) * 100) : null,
          specs: draft.specs.filter((spec) => spec.name.trim() && spec.value.trim()),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={item.id ? `Edit ${item.name}` : ADD_LABEL[item.trade]} showHeader showCloseButton maxWidth="lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Type</label>
            <select
              className={input}
              value={draft.kind}
              onChange={(e) => setDraft((current) => ({ ...current, kind: e.target.value, unit: defaultUnitFor(current.trade, e.target.value) }))}
            >
              {TRADES[draft.trade].kinds.map((kind) => (
                <option key={kind.slug} value={kind.slug}>
                  {KIND_LABEL[kind.slug] ?? kind.slug}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Category</label>
            <input className={input} value={draft.category ?? ''} placeholder={isPlant ? 'e.g. Tree, Shrub, Cactus' : 'e.g. Pavers, Slabs'} onChange={(e) => set('category', e.target.value)} list={isPlant ? 'plant-categories' : undefined} />
            {isPlant ? (
              <datalist id="plant-categories">
                {PLANT_CATEGORIES.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Name</label>
            <input className={input} value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          {isPlant ? (
            <div>
              <label className={label}>Scientific name</label>
              <input className={input} value={draft.scientific_name ?? ''} onChange={(e) => set('scientific_name', e.target.value)} />
            </div>
          ) : (
            <div>
              <label className={label}>Brand</label>
              <input className={input} value={draft.brand} placeholder="Leave empty for generic materials" onChange={(e) => set('brand', e.target.value)} />
            </div>
          )}
        </div>
        <div>
          <label className={label}>Description / care notes</label>
          <textarea className={`${input} min-h-[80px]`} value={draft.description ?? ''} onChange={(e) => set('description', e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>Unit</label>
            <input className={input} value={draft.unit} onChange={(e) => set('unit', e.target.value)} />
          </div>
          <div>
            <label className={label}>Typical price ($)</label>
            <input className={input} type="number" min="0" step="0.01" value={price} placeholder="Optional" onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className={label}>Order</label>
            <input className={input} type="number" min="0" value={draft.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className={label}>Also show in</label>
          <div className="flex flex-wrap gap-4">
            {TRADE_SLUGS.filter((slug) => slug !== draft.trade).map((slug) => {
              const on = (draft.also_trades ?? []).includes(slug);
              return (
                <label key={slug} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setDraft((current) => {
                        const list = current.also_trades ?? [];
                        return { ...current, also_trades: on ? list.filter((item) => item !== slug) : [...list, slug] };
                      })
                    }
                  />
                  {TRADE_LABEL[slug]}
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <label className={label}>Photo</label>
          {draft.image_url ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element -- catalog photo preview */}
              <img src={draft.image_url} alt="" className="h-32 w-32 rounded-lg border-2 border-black object-cover" />
              <button
                type="button"
                onClick={() => set('image_url', null)}
                className="absolute -right-2 -top-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-red-600 text-white"
                aria-label="Remove photo"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : uploading ? (
            <p className="text-sm text-gray-600">Uploading…</p>
          ) : (
            <FileDropZone accept="image/jpeg,image/png,image/webp" maxSizeMb={5} onFiles={(files) => void upload(files[0])} hint="JPEG, PNG or WebP · up to 5 MB" />
          )}
          <input
            className={`${input} mt-2`}
            value={draft.image_url ?? ''}
            placeholder="…or paste a photo link (https://…)"
            onChange={(e) => set('image_url', e.target.value || null)}
          />
        </div>
        <div>
          <label className={label}>Specs</label>
          <div className="space-y-2">
            {draft.specs.map((spec, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className={`${input} w-1/3`}
                  value={spec.name}
                  placeholder="Name (e.g. Thickness)"
                  onChange={(e) => set('specs', draft.specs.map((row, i) => (i === index ? { ...row, name: e.target.value } : row)))}
                />
                <input
                  className={input}
                  value={spec.value}
                  placeholder="Value (e.g. 60 mm)"
                  onChange={(e) => set('specs', draft.specs.map((row, i) => (i === index ? { ...row, value: e.target.value } : row)))}
                />
                <button
                  type="button"
                  onClick={() => set('specs', draft.specs.filter((_, i) => i !== index))}
                  className="cursor-pointer rounded-lg border-2 border-black px-2 hover:bg-gray-100"
                  aria-label="Remove spec"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => set('specs', [...draft.specs, { name: '', value: '' }])} className="cursor-pointer text-sm underline">
              Add spec
            </button>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          Visible to pros
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || uploading || !draft.name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function AdminProTradesPage() {
  const [trade, setTrade] = useState<TradeSlug>('landscape');
  const [kind, setKind] = useState('');
  const [collection, setCollection] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [hideStarter, setHideStarter] = useState(true);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const importMyProducts = async () => {
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/protrades/import-products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hideStarter }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not import');
      const parts = [`${data.created} added`, `${data.updated} updated`];
      if (data.hidden) parts.push(`${data.hidden} starter items hidden`);
      if (data.failed?.length) parts.push(`${data.failed.length} skipped (${data.failed.slice(0, 3).join(', ')})`);
      setNotice(`Imported your products: ${parts.join(', ')}.`);
      setImportOpen(false);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import');
    } finally {
      setImporting(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ trade });
    if (kind) params.set('kind', kind);
    if (trade === 'hardscape' && collection) params.set('collection', collection);
    if (search.trim()) params.set('q', search.trim());
    try {
      const res = await fetch(`/api/admin/protrades/catalog?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load');
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [trade, kind, collection, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const remove = async (item: Item) => {
    const res = await fetch(`/api/admin/protrades/catalog?id=${item.id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) setError((await res.json().catch(() => ({}))).error || 'Could not delete');
    void load();
  };

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">ProTrades databases</h1>
          <p className="text-sm text-gray-600">Each module has its own database: pros browse it in their CRM and add items to their own products.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {trade === 'hardscape' ? (
            <Button type="button" variant="secondary" onClick={() => setImportOpen(true)}>
              <Download className="mr-2 h-4 w-4" />
              Import my products
            </Button>
          ) : null}
          <Button type="button" onClick={() => setEditing(blankItem(trade))}>
            <Plus className="mr-2 h-4 w-4" />
            {ADD_LABEL[trade]}
          </Button>
        </div>
      </div>
      {notice ? <p className="rounded-lg border-2 border-green-700 bg-green-50 p-3 text-sm text-green-800">{notice}</p> : null}
      {importOpen ? (
        <Modal isOpen onClose={() => setImportOpen(false)} title="Import my products into Hardscape" showHeader showCloseButton maxWidth="md">
          <div className="space-y-3 text-sm">
            <p>
              Copies every product in your own CRM (name, brand, category, unit, price, photo and specs) into the Hardscape database.
              Running it again updates the items it already imported instead of adding duplicates.
            </p>
            <p className="text-gray-600">Each item gets a type (Paver, Wall block, Base, Sand…) guessed from its name and category. Fix any that are wrong with Edit.</p>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={hideStarter} onChange={(e) => setHideStarter(e.target.checked)} />
              Hide the starter list (the sample pavers and materials I added), so pros only see your products
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void importMyProducts()} disabled={importing}>
                {importing ? 'Importing…' : 'Import'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      <div className="flex gap-2 border-b-2 border-black">
        {TRADE_SLUGS.map((slug) => (
          <button
            key={slug}
            type="button"
            onClick={() => {
              setTrade(slug);
              setKind('');
            }}
            className={`-mb-0.5 cursor-pointer rounded-t-lg border-2 px-4 py-2 text-sm font-semibold ${
              trade === slug ? `${TRADES[slug].color.border} border-b-white bg-white ${TRADES[slug].color.text}` : 'border-transparent text-gray-600'
            }`}
          >
            {TRADE_LABEL[slug]}
            {TRADES[slug].available ? null : <span className="ml-2 rounded-md border border-current px-1.5 py-0.5 text-[10px] uppercase">Coming soon</span>}
          </button>
        ))}
      </div>

      <TypingSearchInput value={search} onChange={setSearch} placeholder="Search name, brand, Latin name or category…" clearLabel="Clear search" />
      {trade === 'hardscape' ? (
        <div className="flex flex-wrap gap-2">
          {[{ slug: '', label: 'All sources' }, ...HARDSCAPE_COLLECTIONS].map((row) => (
            <button
              key={row.slug || 'all'}
              type="button"
              onClick={() => setCollection(row.slug)}
              className={`cursor-pointer rounded-lg border-2 border-black px-3 py-1 text-sm font-semibold ${collection === row.slug ? 'bg-black text-white' : 'bg-white'}`}
            >
              {row.label}
            </button>
          ))}
        </div>
      ) : null}
      {TRADES[trade].kinds.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {[{ slug: '' }, ...TRADES[trade].kinds].map((row) => (
            <button
              key={row.slug || 'all'}
              type="button"
              onClick={() => setKind(row.slug)}
              className={`cursor-pointer rounded-lg border-2 px-3 py-1 text-sm ${TRADES[trade].color.border} ${kind === row.slug ? `${TRADES[trade].color.solid} text-white` : 'bg-white'}`}
            >
              {row.slug ? KIND_LABEL[row.slug] ?? row.slug : 'All'}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <p className="text-sm text-gray-600">{loading ? 'Loading…' : `${total} item${total === 1 ? '' : 's'}`}</p>

      <div className="overflow-x-auto rounded-lg border-2 border-black">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Visible</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-gray-200">
                <td className="px-3 py-2">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-gray-600">{item.scientific_name ? <i>{item.scientific_name}</i> : item.brand || 'Generic'}</p>
                </td>
                <td className="px-3 py-2">{KIND_LABEL[item.kind] ?? item.kind}</td>
                <td className="px-3 py-2">{item.category ?? '—'}</td>
                <td className="px-3 py-2">{item.unit}</td>
                <td className="px-3 py-2">{item.is_active ? 'Yes' : 'Hidden'}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing({ ...item, specs: Array.isArray(item.specs) ? item.specs : [] })}
                      className="cursor-pointer rounded-lg border-2 border-black p-1.5 hover:bg-gray-100"
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(item)}
                      className="cursor-pointer rounded-lg border-2 border-red-600 p-1.5 text-red-600 hover:bg-red-50"
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <ItemEditor
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
      <SimpleConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void remove(target);
        }}
        title={`Delete ${deleting?.name ?? ''}?`}
        message="Pros who already added it keep their copy. To only hide it, edit and untick Visible to pros."
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}
