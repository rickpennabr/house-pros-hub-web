'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Check, Copy, Loader2, Plus, Settings2, Trash2, X } from 'lucide-react';
import { CrmRowActionsButton, CrmRowActionsPortal, useCrmRowActions } from '@/components/crm/CrmRowActionsMenu';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ContactPropertySelect } from '@/components/crm/ContactPropertySelect';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { PropertyPlanPicker } from '@/components/protrades/PropertyPlanPicker';
import { HardscapeMaterialPicker, type PickedMaterial } from '@/components/protrades/HardscapeMaterialPicker';
import { HardscapeDefaultMaterials, defaultsToMaterials, type DefaultPick } from '@/components/protrades/HardscapeDefaultMaterials';
import { defaultMaterialsFor } from '@/lib/protrades/hardscape-defaults';
import { sortHardscapeServices,
  HARDSCAPE_AREAS,
  spotDescription,
  spotLineItem,
  spotRateCents,
  type HardscapeCatalogItem,
  type HardscapeKind,
  type QuoteSpot,
} from '@/lib/protrades/hardscape-quote';
import { PickerSelect } from '@/components/ui/PickerSelect';

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
  /** Materials list for the job (not billed): becomes the project materials. */
  extras: PickedMaterial[];
}

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const textareaClass = 'w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none';

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section data-pq-step={n} className="scroll-mt-24 space-y-3 rounded-lg border-2 border-black bg-white px-2 py-4 md:p-4">
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
      <span className="flex items-center gap-2">
        {on ? (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-white text-black" aria-hidden>
            <Check className="h-3 w-3" strokeWidth={3.5} />
          </span>
        ) : null}
        <span>{children}</span>
      </span>
      {hint ? <span className={`text-xs font-normal ${on ? 'text-gray-200' : 'text-gray-500'}`}>{hint}</span> : null}
    </button>
  );
}

/** A service box; once picked it shows a quantity box in the service's own unit (sq ft, LF…). */
function ServiceChoice({
  on,
  onToggle,
  name,
  hint,
  unit,
  qty,
  onQty,
}: {
  on: boolean;
  onToggle: () => void;
  name: string;
  hint: string;
  unit: string;
  qty: string;
  onQty: (value: string) => void;
}) {
  return (
    <div className={`flex min-h-12 flex-col rounded-lg border-2 border-black ${on ? 'bg-black text-white' : 'bg-white'}`}>
      {/* Name on one line; price and the quantity box on the row under it. */}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        title={name}
        className={`flex w-full min-w-0 flex-col items-start rounded-lg px-3 pt-2 text-left text-sm font-medium ${on ? 'pb-1' : 'pb-2 hover:bg-gray-50'}`}
      >
        <span className="flex w-full min-w-0 items-center gap-2">
          {on ? (
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-white text-black" aria-hidden>
            <Check className="h-3 w-3" strokeWidth={3.5} />
          </span>
        ) : null}
          <span className="truncate">{name}</span>
        </span>
        {on ? null : <span className="text-xs font-normal text-gray-500">{hint}</span>}
      </button>
      {on ? (
        <label className="flex items-center justify-between gap-2 px-3 pb-2">
          <span className="text-xs font-normal text-gray-200">{hint}</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={qty}
            onChange={(e) => onQty(e.target.value)}
            placeholder={unit}
            aria-label={`${name}, how many ${unit}`}
            style={{ height: 24, minHeight: 24, lineHeight: "22px" }}
            className="h-6 w-16 rounded-md border border-white bg-white px-1 py-0 text-sm leading-none text-black focus:outline-none md:w-20 md:px-2"
          />
        </label>
      ) : null}
    </div>
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
  // "+ New service": added to the pro's price list and picked right away.
  const [newService, setNewService] = useState<{ name: string; unit: string; rate: string } | null>(null);
  const [newServiceBusy, setNewServiceBusy] = useState(false);
  const [newServiceError, setNewServiceError] = useState<string | null>(null);
  /** Quantity typed on each picked service, in that service's unit. */
  const [serviceQty, setServiceQty] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<PickedMaterial[]>([]);
  /** Each picked service brings its usual materials (base, sand, nails…); the pro taps to change them. */
  const [defaultPicks, setDefaultPicks] = useState<Record<string, DefaultPick>>({});
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
  const services = sortHardscapeServices(catalog.filter((item) => item.kind === 'service'));
  const pickedServices = services.filter((item) => serviceIds.includes(item.id));
  // Materials are a list for ordering and tracking, not priced picks: the service price covers them.
  const pickedMaterials: typeof pickedServices = [];
  const unitSet = new Set([...pickedServices, ...pickedMaterials].map((item) => item.unit));
  if (unitSet.size === 0) unitSet.add('sq ft');
  const units = [...unitSet];
  const unit = units.includes(unitPick) ? unitPick : units[0];

  // Size follows the first service quantity typed in the chosen unit, until the pro types a size.
  const autoSize = pickedServices.map((item) => (item.unit === unit ? Number(serviceQty[item.id]) || 0 : 0)).find((n) => n > 0) ?? 0;
  const size = qty !== '' ? Number(qty) || 0 : autoSize;
  const draft: QuoteSpot | null = area && spotName && pickedServices.length
    ? { area: area.label, subarea: spotName, services: pickedServices, materials: pickedMaterials, qty: size, unit }
    : null;
  // Each service bills its own quantity (or the size, when it is in the same unit and left empty).
  const suggestedTotal = pickedServices.reduce((sum, item) => {
    const own = Number(serviceQty[item.id]) || (item.unit === unit ? size : 0);
    return sum + Math.round(own * item.rateCents);
  }, 0);
  const typedAny = pickedServices.some((item) => Number(serviceQty[item.id]) > 0);
  const suggestedRate = draft ? (typedAny && size > 0 ? Math.round(suggestedTotal / size) : spotRateCents(draft)) : 0;
  const defaultRows = defaultMaterialsFor(pickedServices.map((item) => item.name));
  // The price follows the picks until the pro types their own.
  const rate = rateTyped ?? (suggestedRate ? (suggestedRate / 100).toFixed(2) : '');

  // Phones: after a single pick (customer, area, spot), slide the next step up so it is in view.
  const goToStep = (n: number) => {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches) return;
    window.setTimeout(() => {
      document.querySelector(`[data-pq-step="${n}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((value) => value !== id) : [...list, id]);

  const resetSpot = () => {
    setAreaKey('');
    setSubarea('');
    setServiceIds([]);
    setServiceQty({});
    setExtras([]);
    setDefaultPicks({});
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
    setSpots((current) => [...current, { ...draft, id: `${Date.now()}`, rateCents, extras: [...defaultsToMaterials(defaultRows, defaultPicks, draft.qty), ...extras] }]);
    resetSpot();
  };

  const spotWhere = (spot: PlannedSpot) => (spot.subarea === spot.area ? spot.area : `${spot.subarea} (${spot.area})`);
  const total = spots.reduce(
    (sum, spot) => sum + Math.round(spot.qty * spot.rateCents),
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
          lineItems: spots.map((spot) => spotLineItem(spot, spot.rateCents)),
          note: note.trim() || null,
          jobArea: jobArea || null,
        }),
      });
      const body = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !body.id) throw new Error(body.error || 'Could not create the estimate');
      const list = spots.flatMap((spot) =>
        spot.extras.map((m) => ({
          catalogItemId: m.source === 'mine' ? null : m.catalogItemId,
          productId: m.source === 'mine' ? m.catalogItemId : null,
          name: m.name,
          brand: m.brand || null,
          options: m.options || null,
          area: spotWhere(spot),
          unit: m.unit,
          qty: m.qty,
        }))
      );
      if (list.length) {
        await fetch(`/api/crm/estimates/${body.id}/materials`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materials: list }),
        }).catch(() => null);
      }
      router.push(`/${locale}/crm/estimates?id=${body.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the estimate');
      setSaving(false);
    }
  };


  const saveNewService = async () => {
    if (!newService || !newService.name.trim()) return;
    setNewServiceBusy(true);
    setNewServiceError(null);
    const name = newService.name.trim();
    // The list is saved whole and comes back with new ids: remember picks by name.
    const pickedNames = catalog.filter((item) => serviceIds.includes(item.id)).map((item) => item.name);
    const pickedQty = Object.fromEntries(catalog.filter((item) => serviceQty[item.id]).map((item) => [item.name, serviceQty[item.id]]));
    const list = [
      ...catalog.filter((item) => item.kind === 'service'),
      { kind: 'service' as const, name, unit: newService.unit.trim() || 'sq ft', rateCents: Math.round((Number(newService.rate) || 0) * 100) },
      ...catalog.filter((item) => item.kind === 'material'),
    ];
    try {
      const response = await fetch('/api/crm/protrades/hardscape/catalog', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: list.map((item) => ({ kind: item.kind, name: item.name, unit: item.unit, rateCents: item.rateCents })) }),
      });
      const body = (await response.json()) as { items?: HardscapeCatalogItem[]; error?: string };
      if (!response.ok || !body.items) throw new Error(body.error || 'Could not add the service');
      const items = body.items;
      setCatalog(items);
      const services = items.filter((item) => item.kind === 'service');
      const added = [...services].reverse().find((item) => item.name === name);
      setServiceIds([...services.filter((item) => pickedNames.includes(item.name)).map((item) => item.id), ...(added ? [added.id] : [])]);
      setServiceQty(Object.fromEntries(services.filter((item) => pickedQty[item.name]).map((item) => [item.id, pickedQty[item.name]])));
      setRateTyped(null);
      setNewService(null);
    } catch (error) {
      setNewServiceError(error instanceof Error ? error.message : 'Could not add the service');
    } finally {
      setNewServiceBusy(false);
    }
  };
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 py-4 md:p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Hardscape ProQuote</h1>
          <p className="text-sm text-gray-600">Build an estimate by tapping buttons.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPricesOpen(true)}>
          <Settings2 className="mr-1 h-4 w-4" />
          Prices
        </Button>
      </div>

      <Step n={1} title="Customer" done={Boolean(customerId)}>
        <PickerSelect
          value={customerId}
          onChange={(value) => { setCustomerId(value); setPlaceId(''); if (value) goToStep(2); }}
          placeholder={"Select customer"}
          options={customers.map((customer) => ({ value: String(customer.id), label: String(contactDisplayName(customer)) }))}
        />
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
                  {spot.extras.length ? (
                    <p className="text-xs text-gray-500">Materials: {spot.extras.map((m) => `${m.name} ${m.qty} ${m.unit}`).join(', ')}</p>
                  ) : null}
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

      {/* Step 2 shows once a customer is picked. */}
      {customerId ? (
      <Step n={2} title={spots.length ? 'Add another area' : 'Pick one area'} done={Boolean(area)}>
        <p className="text-xs text-gray-500">Pick an area, then its services, materials and the job details.</p>
        {/* Tap the spot on the plan: walls on the back and sides, open to the street. */}
        <PropertyPlanPicker
          value={areaKey}
          onPick={(key) => {
            const item = HARDSCAPE_AREAS.find((row) => row.key === key);
            if (!item) return;
            setAreaKey(item.key);
            setSubarea('');
            goToStep(item.subareas.length ? 3 : 4);
          }}
        />
      </Step>
      ) : null}

      {area && area.subareas.length ? (
        <Step n={3} title={`Where on ${area.label}`} done={Boolean(subarea)}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {area.subareas.map((name) => (
              <Choice key={name} on={subarea === name} onClick={() => { setSubarea(name); goToStep(4); }}>{name}</Choice>
            ))}
          </div>
        </Step>
      ) : null}

      {spotName ? (
        <Step n={4} title={`Services on ${spotName}`} done={pickedServices.length > 0}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {services.map((item) => (
              <ServiceChoice
                key={item.id}
                on={serviceIds.includes(item.id)}
                onToggle={() => {
                  setServiceIds((list) => toggle(list, item.id));
                  setRateTyped(null);
                }}
                name={item.name}
                hint={`${money(item.rateCents)} / ${item.unit}`}
                unit={item.unit}
                qty={serviceQty[item.id] ?? ''}
                onQty={(value) => {
                  setServiceQty((current) => ({ ...current, [item.id]: value }));
                  setRateTyped(null);
                }}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setNewServiceError(null);
                setNewService({ name: '', unit: 'sq ft', rate: '' });
              }}
              className="flex min-h-12 items-center justify-center gap-1 rounded-lg border-2 border-dashed border-black bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" /> New service
            </button>
          </div>
        </Step>
      ) : null}

      {spotName && pickedServices.length ? (
        <Step n={5} title="Materials list" done={extras.length > 0}>
          <p className="text-xs text-gray-500">
            Not billed on the estimate. The list goes to the project, so your team can order, track deliveries and compare
            estimated vs used.
          </p>
          <HardscapeDefaultMaterials rows={defaultRows} picks={defaultPicks} onChange={setDefaultPicks} size={size} />
          <HardscapeMaterialPicker picked={extras} onChange={setExtras} />
        </Step>
      ) : null}

      {draft ? (
        <Step n={6} title="Size and price">
          <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-800">{spotDescription(draft)}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormField label="Size" required>
              <Input type="number" inputMode="decimal" min={0} value={qty !== '' ? qty : autoSize ? String(autoSize) : ''} onChange={(e) => setQty(e.target.value)} placeholder="0" />
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
          <p className="text-xs text-gray-500">The price adds up each service times its quantity, spread over the size. Change it if this job is different.</p>
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

      <Modal
        isOpen={newService !== null}
        onClose={() => (newServiceBusy ? undefined : setNewService(null))}
        title="New service"
        showHeader
        maxWidth="md"
        contentClassName="p-4"
      >
        {newService ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void saveNewService();
            }}
          >
            <p className="text-sm text-gray-600">Added to your Hardscape prices and picked for this area. Change it later in Prices.</p>
            <FormField label="Service">
              <Input value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} placeholder="Paver steps, fire pit…" maxLength={120} required autoFocus />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Unit">
                <Select value={newService.unit} onChange={(e) => setNewService({ ...newService, unit: e.target.value })}>
                  {['sq ft', 'LF', 'each', 'yd', 'ton', 'hour', 'job'].map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Price per unit ($)">
                <Input type="number" inputMode="decimal" min={0} step="0.01" value={newService.rate} onChange={(e) => setNewService({ ...newService, rate: e.target.value })} placeholder="0.00" />
              </FormField>
            </div>
            {newServiceError ? <p className="text-sm text-red-600">{newServiceError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNewService(null)} disabled={newServiceBusy}>Cancel</Button>
              <Button type="submit" disabled={newServiceBusy || !newService.name.trim()}>
                {newServiceBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                Add service
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      {pricesOpen ? (
        <HardscapePrices
          items={catalog}
          setupError={setupError}
          onClose={() => setPricesOpen(false)}
          onSaved={(items) => {
            setCatalog(items);
            setServiceIds([]);
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
  // ⋮ menu per row: duplicate (copy right under it) or delete.
  const rowActions = useCrmRowActions();
  const duplicate = (id: string) =>
    setRows((current) => {
      const at = current.findIndex((row) => row.id === id);
      if (at < 0) return current;
      const copy = { ...current[at], id: `new-${Date.now()}`, name: `${current[at].name} (copy)`.slice(0, 120) };
      return [...current.slice(0, at + 1), copy, ...current.slice(at + 1)];
    });
  const remove = (id: string) => setRows((current) => current.filter((item) => item.id !== id));

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
      {/* Column names over the rows. */}
      <div className="grid grid-cols-[minmax(0,1fr)_2.9rem_3.3rem_auto] items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
        <span>Description</span>
        <span className="text-center">Unit</span>
        <span className="text-center">Price</span>
        <span className="w-7" aria-hidden />
      </div>
      {rows.filter((row) => row.kind === kind).map((row) => (
        <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_2.9rem_3.3rem_auto] items-center gap-2">
          <Input value={row.name} onChange={(e) => update(row.id, { name: e.target.value })} placeholder="Description" maxLength={120} aria-label="Description" />
          <Input value={row.unit} onChange={(e) => update(row.id, { unit: e.target.value })} placeholder="sq ft" maxLength={40} aria-label="Unit" className="px-1 text-center" />
          <Input type="number" inputMode="decimal" min={0} step="0.01" value={row.rate} onChange={(e) => update(row.id, { rate: e.target.value })} placeholder="$" aria-label="Price per unit" className="px-1 text-center" />
          <CrmRowActionsButton rowId={row.id} openId={rowActions.openId} onToggle={rowActions.toggle} />
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
            <p className="text-xs text-gray-600">Description, unit and price per unit. ProQuote adds these up for each area.</p>
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
      <CrmRowActionsPortal openId={rowActions.openId} position={rowActions.position} menuRef={rowActions.menuRef} zClassName="z-[120]">
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100"
          onClick={() => {
            if (rowActions.openId) duplicate(rowActions.openId);
            rowActions.close();
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </button>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
          onClick={() => {
            if (rowActions.openId) remove(rowActions.openId);
            rowActions.close();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </CrmRowActionsPortal>
    </div>
  );
}
