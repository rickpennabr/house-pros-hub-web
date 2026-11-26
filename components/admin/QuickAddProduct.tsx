'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Pencil, Plus } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { ProProduct } from '@/lib/products/types';
import { brandLogoSrc } from '@/lib/products/brand-logos';
import { FileDropTarget } from '@/components/ui/FileDropTarget';

/** Las Vegas brands first; any other brand already in the catalog follows, and "Other" types a new one. */
const MAIN_BRANDS = ['Belgard', 'Keystone', 'Las Vegas Paver'];
/** Paver thicknesses (mm) with the inch values the catalog already stores. */
const THICKNESSES: { mm: string; inches: string }[] = [
  { mm: '45', inches: '2' },
  { mm: '60', inches: '2.5' },
  { mm: '80', inches: '3.15' },
];

const norm = (value: string) => value.trim().toLowerCase();

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex min-h-10 items-center gap-2 rounded-lg border-2 border-black px-3 py-1.5 text-sm font-medium ${on ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
    >
      {on ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-white text-black" aria-hidden>
          <Check className="h-3 w-3" strokeWidth={3.5} />
        </span>
      ) : null}
      {children}
    </button>
  );
}

function Section({ n, title, action, children }: { n: number; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border-2 border-black text-xs">{n}</span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Quick add for the public catalog: brand → product → thickness → colors → note → save.
 * Saving creates the product (or adds to the same brand + name if it exists) and one variation
 * per thickness × color. Brand and product stay filled for the next entry.
 */
export function QuickAddProduct({
  isOpen,
  onClose,
  products,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  products: ProProduct[];
  onSaved: (product: ProProduct) => void;
}) {
  const [brand, setBrand] = useState('');
  const [otherBrand, setOtherBrand] = useState(false);
  // Logo for a new brand: uploaded like product photos, saved on the brand with the first product.
  const [brandLogo, setBrandLogo] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/products/image', { method: 'POST', credentials: 'include', body: form });
      const body = (await res.json().catch(() => ({}))) as { image_url?: string; error?: string };
      if (!res.ok || !body.image_url) throw new Error(body.error || 'Could not upload the logo');
      setBrandLogo(body.image_url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload the logo');
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };
  const [name, setName] = useState('');
  // Picked product: the list hides and a pencil brings it back.
  const [productLocked, setProductLocked] = useState(false);
  const [thicknesses, setThicknesses] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [newColor, setNewColor] = useState('');
  const [extraColors, setExtraColors] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const brands = useMemo(() => {
    const seen = new Set(MAIN_BRANDS.map(norm));
    const others = [...new Set(products.map((product) => product.brand.trim()).filter(Boolean))]
      .filter((value) => !seen.has(norm(value)))
      .sort((a, b) => a.localeCompare(b));
    return [...MAIN_BRANDS, ...others];
  }, [products]);

  const savedLogos = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) if (product.brand_logo) map.set(norm(product.brand), product.brand_logo);
    return map;
  }, [products]);

  const brandProducts = useMemo(
    () => products.filter((product) => norm(product.brand) === norm(brand)),
    [products, brand]
  );
  const productNames = useMemo(
    () => [...new Set(brandProducts.map((product) => product.name.trim()))].sort((a, b) => a.localeCompare(b)),
    [brandProducts]
  );
  const existing = brandProducts.find((product) => norm(product.name) === norm(name)) ?? null;

  // Every color this brand uses, plus any typed here.
  const brandColors = useMemo(() => {
    const all = brandProducts.flatMap((product) => product.variants.map((variant) => variant.color.trim())).filter(Boolean);
    const list = [...new Set([...all, ...extraColors])];
    return list.sort((a, b) => a.localeCompare(b));
  }, [brandProducts, extraColors]);

  // Variations this product already has, so they show as taken.
  const has = (mm: string, color: string) =>
    Boolean(existing?.variants.some((variant) => variant.thicknessMm === mm && norm(variant.color) === norm(color)));

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  const pickBrand = (value: string) => {
    setBrand(value);
    setOtherBrand(false);
    setName('');
    setProductLocked(false);
    setColors([]);
    setExtraColors([]);
    setDone(null);
  };

  const addColor = () => {
    const value = newColor.trim();
    if (!value) return;
    if (!brandColors.some((color) => norm(color) === norm(value))) setExtraColors((list) => [...list, value]);
    setColors((list) => (list.some((color) => norm(color) === norm(value)) ? list : [...list, value]));
    setNewColor('');
  };

  const combos = thicknesses.flatMap((mm) => (colors.length ? colors : ['']).map((color) => ({ mm, color }))).filter((combo) => !has(combo.mm, combo.color));
  const canSave = Boolean(brand.trim() && name.trim() && productLocked && (thicknesses.length || colors.length)) && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    setDone(null);
    try {
      let product = existing;
      if (!product) {
        const res = await fetch('/api/admin/products', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            brand: brand.trim(),
            ...(otherBrand && brandLogo ? { brand_logo_url: brandLogo } : {}),
            product_type: 'Pavers',
            description: note.trim(),
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { product?: ProProduct; error?: string };
        if (!res.ok || !body.product) throw new Error(body.error || 'Could not create the product');
        product = body.product;
      }
      const list = thicknesses.length
        ? combos
        : colors.filter((color) => !existing?.variants.some((variant) => norm(variant.color) === norm(color))).map((color) => ({ mm: '', color }));
      let latest: ProProduct = product;
      for (const combo of list) {
        const thickness = THICKNESSES.find((row) => row.mm === combo.mm);
        const res = await fetch(`/api/admin/products/${product.id}/variants`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            color: combo.color,
            size: '',
            thickness_mm: thickness?.mm ?? '',
            thickness_in: thickness?.inches ?? '',
            sqft_pallet: 0,
            sqft_layer: 0,
            lnft_pallet: 0,
            layer_pallet: 0,
            pcs_pallet: 0,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { product?: ProProduct; error?: string };
        if (res.status === 409) continue;
        if (!res.ok) throw new Error(body.error || 'Could not add a variation');
        if (body.product) latest = body.product;
      }
      onSaved(latest);
      setDone(`Saved ${brand} ${name.trim()}: ${list.length} variation${list.length === 1 ? '' : 's'}.`);
      // Keep brand and product for the next entry; clear the picks.
      setThicknesses([]);
      setColors([]);
      setNote('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add product" showHeader maxWidth="2xl" contentClassName="p-4 md:p-6">
      <div className="space-y-5">
        <Section
          n={1}
          title="Brand"
          action={
            <button
              type="button"
              aria-label="Add a brand"
              title="Add a brand"
              aria-pressed={otherBrand}
              onClick={() => {
                setOtherBrand(true);
                setBrandLogo('');
                setBrand('');
                setName('');
                setColors([]);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-black bg-black text-white hover:bg-gray-800"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={3} />
            </button>
          }
        >
          {/* Three equal spots per row, each with the brand's logo on the left. */}
          <div className="grid grid-cols-3 gap-2">
            {brands.map((value) => {
              const on = !otherBrand && norm(brand) === norm(value);
              const logo = brandLogoSrc(value, savedLogos.get(norm(value)));
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => pickBrand(value)}
                  aria-pressed={on}
                  className={`flex min-h-12 min-w-0 items-center gap-1.5 rounded-lg border-2 border-black px-1.5 py-1.5 text-left text-xs font-medium sm:gap-2 sm:px-2 sm:text-sm ${on ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small static brand symbol
                      <img src={logo} alt="" className="h-[80%] w-[80%] object-contain" />
                    ) : (
                      <span className="text-sm font-bold text-black">{value.charAt(0)}</span>
                    )}
                  </span>
                  <span className="min-w-0 break-words leading-tight">{value}</span>
                </button>
              );
            })}
          </div>
          {otherBrand ? (
            <div className="flex items-center gap-2">
              {/* Logo tile: tap or drop an image, like the other brands' logos. */}
              <FileDropTarget inputRef={logoInputRef} accept="image/jpeg,image/png,image/webp" disabled={logoBusy} rounded="rounded-lg">
                <label
                  className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-black bg-white hover:bg-gray-50"
                  title="Brand logo"
                >
                  {logoBusy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : brandLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- uploaded logo preview
                    <img src={brandLogo} alt="Brand logo" className="h-[80%] w-[80%] object-contain" />
                  ) : (
                    <ImagePlus className="h-5 w-5 text-gray-600" />
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label="Upload brand logo"
                    onChange={(event) => void uploadLogo(event.target.files?.[0])}
                  />
                </label>
              </FileDropTarget>
              <input
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                placeholder="Brand name"
                maxLength={120}
                className="h-12 min-w-0 flex-1 rounded-lg border-2 border-black px-3 text-base focus:outline-none"
                autoFocus
              />
            </div>
          ) : null}
        </Section>

        {brand.trim() ? (
          <Section n={2} title="Product">
            {productLocked ? (
              <div className="flex items-center gap-2">
                <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border-2 border-black bg-black px-3 text-white">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-white text-black" aria-hidden>
                    <Check className="h-3 w-3" strokeWidth={3.5} />
                  </span>
                  <span className="truncate font-medium">{name}</span>
                  {!existing ? <span className="shrink-0 text-xs text-gray-300">New</span> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setProductLocked(false)}
                  aria-label="Change product"
                  title="Change product"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setDone(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && name.trim()) {
                      event.preventDefault();
                      setProductLocked(true);
                    }
                  }}
                  placeholder="Type to find or add: Holland, Mega Arbel…"
                  maxLength={160}
                  className="h-10 w-full rounded-lg border-2 border-black px-3 text-base focus:outline-none"
                />
                {(() => {
                  const words = norm(name).split(/\s+/).filter(Boolean);
                  const matches = productNames.filter((value) => words.every((word) => norm(value).includes(word)));
                  const exact = productNames.some((value) => norm(value) === norm(name));
                  return (
                    <div className="flex flex-wrap gap-2">
                      {matches.slice(0, 40).map((value) => (
                        <Chip
                          key={value}
                          on={norm(name) === norm(value)}
                          onClick={() => {
                            setName(value);
                            setProductLocked(true);
                            setDone(null);
                          }}
                        >
                          {value}
                        </Chip>
                      ))}
                      {name.trim() && !exact ? (
                        <button
                          type="button"
                          onClick={() => setProductLocked(true)}
                          className="flex min-h-10 items-center gap-2 rounded-lg border-2 border-dashed border-black bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
                        >
                          <Plus className="h-4 w-4" /> Add “{name.trim()}” as a new product
                        </button>
                      ) : null}
                    </div>
                  );
                })()}
              </>
            )}
            {productLocked && existing ? (
              <p className="text-xs text-gray-600">
                Already in the catalog with {existing.variants.length} variation{existing.variants.length === 1 ? '' : 's'}. New picks are added to it.
              </p>
            ) : null}
          </Section>
        ) : null}

        {brand.trim() && name.trim() && productLocked ? (
          <>
            <Section n={3} title="Thickness">
              <div className="flex flex-wrap gap-2">
                {THICKNESSES.map((row) => (
                  <Chip key={row.mm} on={thicknesses.includes(row.mm)} onClick={() => setThicknesses((list) => toggle(list, row.mm))}>
                    {row.mm} mm <span className="text-xs opacity-70">({row.inches}″)</span>
                  </Chip>
                ))}
              </div>
            </Section>

            <Section n={4} title={`Colors${brandColors.length ? ` (all ${brand} colors)` : ''}`}>
              {brandColors.length ? (
                <div className="flex flex-wrap gap-2">
                  {brandColors.map((color) => (
                    <Chip key={color} on={colors.includes(color)} onClick={() => setColors((list) => toggle(list, color))}>
                      {color}
                    </Chip>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No colors for this brand yet. Type one below.</p>
              )}
              <div className="flex gap-2">
                <input
                  value={newColor}
                  onChange={(event) => setNewColor(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addColor();
                    }
                  }}
                  placeholder="Add a color"
                  maxLength={80}
                  className="h-10 min-w-0 flex-1 rounded-lg border-2 border-black px-3 text-base focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addColor}
                  disabled={!newColor.trim()}
                  aria-label="Add color"
                  title="Add color"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white hover:bg-gray-50 disabled:border-gray-300 disabled:text-gray-400"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </Section>

            <Section n={5} title="Note">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={4000}
                placeholder={existing ? 'Saved only on a new product' : 'Optional'}
                className="w-full rounded-lg border-2 border-black p-3 text-base focus:outline-none"
              />
            </Section>
          </>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {done ? <p className="text-sm text-green-700">{done} Brand and product are kept for the next entry.</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-600">
            {thicknesses.length || colors.length
              ? `${(thicknesses.length ? combos.length : colors.length)} new variation${(thicknesses.length ? combos.length : colors.length) === 1 ? '' : 's'}`
              : 'Pick a thickness or a color'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Close</Button>
            <Button type="button" onClick={() => void save()} disabled={!canSave}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
