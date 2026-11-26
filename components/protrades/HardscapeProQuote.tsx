'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Check, Loader2, Plus, Settings2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ContactPropertySelect } from '@/components/crm/ContactPropertySelect';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { HardscapeMaterialPicker, pickedMaterialLine, type PickedMaterial } from '@/components/protrades/HardscapeMaterialPicker';
import {
  HARDSCAPE_AREAS,
  spotDescription,
  spotLineItem,
  spotRateCents,
  type HardscapeCatalogItem,
  type HardscapeKind,
  type QuoteSpot,
} from '@/lib/protrades/hardscape-quote';

interface CustomerOption {
  id: string;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  company_name?: string | null;
}

interface PlannedSpot extends QuoteSpot {
  id: string;
  rateCents: number;
  /** Materials from the Hardscape database, each billed by its own quantity. */
  extras: PickedMaterial[];
}

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const textareaClass = 'w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none';

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border-2 border-black bg-white p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${done ? 'bg-black text-white' : 'border-2 border-black'}`}>
          {done ? <Check className="h-3.5 w-3.5" /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({ on, onClick, children, hint }: { on: boolean; onClick: () => void; children: React.ReactNode; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex min-h-12 flex-col items-start justify-center rounded-lg border-2 border-black px-3 py-2 text-left text-sm font-medium ${on ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
    >
      <span>{children}</span>
      {hint ? <span className={`text-xs font-normal ${on ? 'text-gray-200' : 'text-gray-500'}`}>{hint}</span> : null}
    </button>
  );
}

/** Hardscape ProQuote: customer -> area -> sub-area -> services -> materials -> size, then a regular estimate. */
export function HardscapeProQuote() {
  const router = useRouter();
  const locale = useLocale();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [catalog, setCatalog] = useState<HardscapeCatalogItem[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [placeId, setPlaceId] = useState('');
  const [areaKey, setAreaKey] = useState('');
  const [subarea, setSubarea] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [materialIds, setMaterialIds] = useState<string[]>([]);
  const [extras, setExtras] = useState<PickedMaterial[]>([]);
  const [qty, setQty] = useState('');
  const [unitPick, setUnit] = useState('sq ft');
  const [rateTyped, setRateTyped] = useState<string | null>(null);
  const [spots, setSpots] = useState<PlannedSpot[]>([]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricesOpen, setPricesOpen] = useState(false);

  useEffect(() => {
    void fetch('/api/crm/customers?pageSize=500&billable=1', { credentials: 'include' })
      .then((r) => r.json())
      .then((body: { customers?: CustomerOption[] }) => setCustomers(body.customers ?? []))
      .catch(() => setCustomers([]));
    void fetch('/api/crm/protrades/hardscape/catalog', { credentials: 'include' })
      .then((r) => r.json())
      .then((body: { items?: HardscapeCatalogItem[]; setupError?: string }) => {
        setCatalog(body.items ?? []);
        setSetupError(body.setupError ?? null);
      })
      .catch(() => setCatalog([]));
  }, []);

  const area = HARDSCAPE_AREAS.find((item) => item.key === areaKey) ?? null;
  const spotName = area ? (area.subareas.length ? subarea : area.label) : '';
  const services = catalog.filter((item) => item.kind === 'service');
  const materials = catalog.filter((item) => item.kind === 'material');
  const pickedServices = services.filter((item) => serviceIds.includes(item.id));
  const pickedMaterials = materials.filter((item) => materialIds.includes(item.id));
  const unitSet = new Set([...pickedServices, ...pickedMaterials].map((item) => item.unit));
  if (unitSet.size === 0) unitSet.add('sq ft');
  const units = [...unitSet];
  const unit = units.includes(unitPick) ? unitPick : units[0];

  const draft: QuoteSpot | null = area && spotName && pickedServices.length
    ? { area: area.label, subarea: spotName, services: pickedServices, materials: pickedMaterials, qty: Number(qty) || 0, unit }
    : null;
  const suggestedRate = draft ? spotRateCents(draft) : 0;
  // The price follows the picks until the pro types their own.
  const rate = rateTyped ?? (suggestedRate ? (suggestedRate / 100).toFixed(2) : '');

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((value) => value !== id) : [...list, id]);

  const resetSpot = () => {
    setAreaKey('');
    setSubarea('');
    setServiceIds([]);
    setMaterialIds([]);
    setExtras([]);
    setQty('');
    setRateTyped(null);
  };

  const addSpot = () => {
    if (!draft) return;
    if (!(draft.qty > 0)) {
      setError(`Enter how many ${unit} for ${spotName}.`);
      return;
    }
    setError(null);
    const rateCents = Math.round((Number(rate) || 0) * 100);
    setSpots((current) => [...current, { ...draft, id: `${Date.now()}`, rateCents, extras }]);
    resetSpot();
  };

  const spotWhere = (spot: PlannedSpot) => (spot.subarea === spot.area ? spot.area : `${spot.subarea} (${spot.area})`);
  const total = spots.reduce(
    (sum, spot) => sum + Math.round(spot.qty * spot.rateCents) + spot.extras.reduce((s, m) => s + Math.round(m.qty * m.priceCents), 0),
    0
  );

  const create = async () => {
    if (!customerId) {
      setError('Pick a customer.');
      return;
    }
    if (spots.length === 0) {
      setError('Add at least one area to the quote.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const jobArea = [...new Set(spots.map((spot) => spot.subarea))].join(', ').slice(0, 80);
      const response = await fetch('/api/crm/estimates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          placeId: placeId || null,
          lineItems: spots.flatMap((spot) => [spotLineItem(spot, spot.rateCents), ...spot.extras.map((m) => pickedMaterialLine(m, spotWhere(spot)))]),
          note: note.trim() || null,
          jobArea: jobArea || null,
        }),
      });
      const body = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !body.id) throw new Error(body.error || 'Could not create the estimate');
      router.push(`/${locale}/crm/estimates?id=${body.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the estimate');
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Hardscape ProQuote</h1>
          <p className="text-sm text-gray-600">Pick the area, the work and the materials. It becomes a regular estimate you review and send.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPricesOpen(true)}>
          <Settings2 className="mr-1 h-4 w-4" />
          Prices
        </Button>
      </div>

      <Step n={1} title="Customer" done={Boolean(customerId)}>
        <Select value={customerId} onChange={(e) => { setCustomerId(e.target.value); setPlaceId(''); }}>
          <option value="">Select customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>{contactDisplayName(customer)}</option>
          ))}
        </Select>
        {customerId ? <ContactPropertySelect customerId={customerId} value={placeId} onChange={setPlaceId} variant="stacked" /> : null}
      </Step>

      {spots.length > 0 ? (
        <section className="space-y-2 rounded-lg border-2 border-black bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">Quote</h2>
          <ol className="space-y-2">
            {spots.map((spot, index) => (
              <li key={spot.id} className="flex items-start justify-between gap-3 rounded-lg border-2 border-gray-200 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold">Item {index + 1}</p>
                  <p className="text-gray-700">{spotDescription(spot)}</p>
                  <p className="text-xs text-gray-500">{spot.qty} {spot.unit} × {money(spot.rateCents)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold">{money(Math.round(spot.qty * spot.rateCents))}</span>
                  <button
                    type="button"
                    onClick={() => setSpots((current) => current.filter((item) => item.id !== spot.id))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100"
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-right text-base font-bold">Total {money(total)}</p>
        </section>
      ) : null}

      <Step n={2} title={spots.length ? 'Add another area' : 'House area'} done={Boolean(area)}>
        <div className="grid grid-cols-2 gap-2">
          {HARDSCAPE_AREAS.map((item) => (
            <Choice key={item.key} on={areaKey === item.key} onClick={() => { setAreaKey(item.key); setSubarea(''); }}>
              {item.label}
            </Choice>
          ))}
        </div>
      </Step>

      {area && area.subareas.length ? (
        <Step n={3} title={`Where on ${area.label}`} done={Boolean(subarea)}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {area.subareas.map((name) => (
              <Choice key={name} on={subarea === name} onClick={() => setSubarea(name)}>{name}</Choice>
            ))}
          </div>
        </Step>
      ) : null}

      {spotName ? (
        <Step n={4} title={`Services on ${spotName}`} done={pickedServices.length > 0}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {services.map((item) => (
              <Choice key={item.id} on={serviceIds.includes(item.id)} onClick={() => setServiceIds((list) => toggle(list, item.id))} hint={`${money(item.rateCents)} / ${item.unit}`}>
                {item.name}
              </Choice>
            ))}
          </div>
        </Step>
      ) : null}

      {spotName && pickedServices.length ? (
        <Step n={5} title="Materials" done={pickedMaterials.length > 0}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {materials.map((item) => (
              <Choice key={item.id} on={materialIds.includes(item.id)} onClick={() => setMaterialIds((list) => toggle(list, item.id))} hint={`${money(item.rateCents)} / ${item.unit}`}>
                {item.name}
              </Choice>
            ))}
          </div>
          <HardscapeMaterialPicker picked={extras} onChange={setExtras} />
        </Step>
      ) : null}

      {draft ? (
        <Step n={6} title="Size and price">
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-800">{spotDescription(draft)}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormField label="Size" required>
              <Input type="number" inputMode="decimal" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
            </FormField>
            <FormField label="Unit">
              <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
                {units.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
            </FormField>
            <FormField label={`Price per ${unit} ($)`}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={rate}
                onChange={(e) => setRateTyped(e.target.value)}
              />
            </FormField>
          </div>
          <p className="text-xs text-gray-500">The price adds up every service and material priced per {unit}. Change it if this job is different.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetSpot}>Clear</Button>
            <Button onClick={addSpot}>
              <Plus className="mr-1 h-4 w-4" />
              Add to quote
            </Button>
          </div>
        </Step>
      ) : null}

      <section className="space-y-3 rounded-lg border-2 border-black bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Notes</h2>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={5000} className={textareaClass} placeholder="Shown at the end of the estimate" />
      </section>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="flex justify-end">
        <Button onClick={() => void create()} disabled={saving || spots.length === 0 || !customerId}>
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Create estimate
        </Button>
      </div>

      {pricesOpen ? (
        <HardscapePrices
          items={catalog}
          setupError={setupError}
          onClose={() => setPricesOpen(false)}
          onSaved={(items) => {
            setCatalog(items);
            setServiceIds([]);
            setMaterialIds([]);
            setPricesOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/** The pro's hardscape price list (saved in pro_crm_hardscape_catalog). */
function HardscapePrices({
  items,
  setupError,
  onClose,
  onSaved,
}: {
  items: HardscapeCatalogItem[];
  setupError: string | null;
  onClose: () => void;
  onSaved: (items: HardscapeCatalogItem[]) => void;
}) {
  const [rows, setRows] = useState(() => items.map((item) => ({ ...item, rate: (item.rateCents / 100).toFixed(2) })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(setupError);

  const update = (id: string, patch: Partial<(typeof rows)[number]>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const add = (kind: HardscapeKind) =>
    setRows((current) => [...current, { id: `new-${Date.now()}`, kind, name: '', unit: 'sq ft', rateCents: 0, rate: '' }]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/crm/protrades/hardscape/catalog', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [...rows.filter((row) => row.kind === 'service'), ...rows.filter((row) => row.kind === 'material')]
            .filter((row) => row.name.trim())
            .map((row) => ({ kind: row.kind, name: row.name.trim(), unit: row.unit.trim() || 'sq ft', rateCents: Math.round((Number(row.rate) || 0) * 100) })),
        }),
      });
      const body = (await response.json()) as { items?: HardscapeCatalogItem[]; error?: string };
      if (!response.ok || !body.items) throw new Error(body.error || 'Could not save prices');
      onSaved(body.items);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save prices');
      setSaving(false);
    }
  };

  const group = (kind: HardscapeKind, label: string) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{label}</h3>
        <Button variant="outline" size="sm" onClick={() => add(kind)}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>
      {rows.filter((row) => row.kind === kind).map((row) => (
        <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_6rem_auto] items-center gap-2">
          <Input value={row.name} onChange={(e) => update(row.id, { name: e.target.value })} placeholder="Name" maxLength={120} />
          <Input value={row.unit} onChange={(e) => update(row.id, { unit: e.target.value })} placeholder="sq ft" maxLength={40} aria-label="Unit" />
          <Input type="number" inputMode="decimal" min={0} step="0.01" value={row.rate} onChange={(e) => update(row.id, { rate: e.target.value })} placeholder="$" aria-label="Price per unit" />
          <button
            type="button"
            onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
            className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100"
            aria-label="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-lg bg-white sm:rounded-lg">
        <div className="flex items-center justify-between border-b-2 border-black p-4">
          <div>
            <h2 className="text-lg font-bold">Hardscape prices</h2>
            <p className="text-xs text-gray-600">Name, unit and price per unit. ProQuote adds these up for each area.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-6 overflow-y-auto p-4">
          {group('service', 'Services')}
          {group('material', 'Materials')}
        </div>
        {error ? <p className="mx-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="flex justify-end gap-2 p-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Save prices
          </Button>
        </div>
      </div>
    </div>
  );
}
