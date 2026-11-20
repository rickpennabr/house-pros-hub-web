'use client';

import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ContactPropertySelect } from '@/components/crm/ContactPropertySelect';
import { AddContactProperty } from '@/components/crm/ContactPropertiesEditor';
import type { ContactProperty } from '@/lib/places/contact-places';
import {
  MAINTENANCE_FREQUENCIES,
  MAINTENANCE_FREQUENCY_LABELS,
  type MaintenanceFrequency,
} from '@/lib/crm/estimate-agreement';

export interface HouseAgreementValues {
  /** Empty: the contact's default house (or their own address when they have no shared houses). */
  placeId: string;
  name: string;
  frequency: MaintenanceFrequency;
  /** Dollars, as typed. */
  amount: string;
  nextVisitDate: string;
  endDate: string;
  scopeOfWork: string;
  accessNotes: string;
}

export const EMPTY_HOUSE_AGREEMENT: HouseAgreementValues = {
  placeId: '',
  name: 'Maintenance agreement',
  frequency: 'monthly',
  amount: '',
  nextVisitDate: '',
  endDate: '',
  scopeOfWork: '',
  accessNotes: '',
};

/** Request body for POST/PATCH /api/crm/maintenance/houses. */
export function houseAgreementPayload(values: HouseAgreementValues, properties: ContactProperty[]) {
  const dollars = values.amount.trim() === '' ? null : Number(values.amount);
  const defaultPlace = properties.find((property) => property.isDefault) ?? properties[0];
  return {
    // Save the exact house, so two houses of one contact never share an agreement by accident.
    placeId: values.placeId || defaultPlace?.id || null,
    name: values.name.trim(),
    frequency: values.frequency,
    amountCents: dollars === null || !Number.isFinite(dollars) ? null : Math.max(0, Math.round(dollars * 100)),
    nextVisitDate: values.nextVisitDate || null,
    endDate: values.endDate || null,
    scopeOfWork: values.scopeOfWork.trim() || null,
    accessNotes: values.accessNotes.trim() || null,
  };
}

export function houseAgreementError(values: HouseAgreementValues): string | null {
  if (!values.name.trim()) return 'Name the agreement.';
  if (values.amount.trim() !== '' && !(Number(values.amount) >= 0)) return 'Enter a valid price per visit.';
  if (values.endDate && values.nextVisitDate && values.endDate < values.nextVisitDate) {
    return 'The end date is before the next visit.';
  }
  return null;
}

/** Job lines in the scope text (one per line; commas also split older free text). */
export function scopeItems(scope: string): string[] {
  return scope
    .split(/[\n,]/)
    .map((item) => item.trim().replace(/\.$/, '').trim())
    .filter(Boolean);
}

const sameJob = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function toggleJob(scope: string, job: string): string {
  const items = scopeItems(scope);
  const next = items.some((item) => sameJob(item, job))
    ? items.filter((item) => !sameJob(item, job))
    : [...items, job];
  return next.join('\n');
}

interface ServiceOption {
  id: string;
  name: string;
}

/** Common maintenance jobs as buttons; new ones join the business list for the next house and visits. */
function JobPicker({ scope, onChange, disabled }: { scope: string; onChange: (scope: string) => void; disabled: boolean }) {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [newJob, setNewJob] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/crm/maintenance/services', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { services: [] }))
      .then((data) => !cancelled && setServices(data.services ?? []))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const items = scopeItems(scope);
  const picked = (name: string) => items.some((item) => sameJob(item, name));

  const addJob = async () => {
    const name = newJob.trim();
    if (!name || adding) return;
    setAdding(true);
    setError(null);
    try {
      const existing = services.find((service) => sameJob(service.name, name));
      if (!existing) {
        const res = await fetch('/api/crm/maintenance/services', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not add the job');
        setServices((prev) => (prev.some((s) => s.id === data.service.id) ? prev : [...prev, data.service]));
      }
      if (!picked(existing?.name ?? name)) onChange(toggleJob(scope, existing?.name ?? name));
      setNewJob('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the job');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {services.map((service) => {
          const on = picked(service.name);
          return (
            <button
              key={service.id}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => onChange(toggleJob(scope, service.name))}
              className={`inline-flex items-center gap-1.5 rounded-lg border-2 border-black px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                on ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'
              }`}
            >
              {on ? <Check className="h-3.5 w-3.5" /> : null}
              {service.name}
            </button>
          );
        })}
      </div>
      {!disabled ? (
        <div className="flex gap-2">
          <Input
            value={newJob}
            onChange={(e) => setNewJob(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void addJob();
              }
            }}
            placeholder="New job, e.g. Trash hauling"
            maxLength={80}
          />
          <button
            type="button"
            onClick={() => void addJob()}
            disabled={adding || !newJob.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border-2 border-black px-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add job
          </button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

const textareaClass =
  'w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none disabled:opacity-50';

interface HouseAgreementFormProps {
  customerId: string;
  /** Contact's own address, shown when they have no shared houses. */
  contactAddress?: string;
  values: HouseAgreementValues;
  onChange: (values: HouseAgreementValues) => void;
  onPropertiesLoaded?: (properties: ContactProperty[]) => void;
  disabled?: boolean;
}

/** The maintenance agreement for one house: schedule, price, the job, and how to get in. */
export function HouseAgreementForm({
  customerId,
  contactAddress,
  values,
  onChange,
  onPropertiesLoaded,
  disabled = false,
}: HouseAgreementFormProps) {
  const set = <K extends keyof HouseAgreementValues>(key: K, value: HouseAgreementValues[K]) =>
    onChange({ ...values, [key]: value });
  const [propertiesVersion, setPropertiesVersion] = useState(0);

  return (
    <div className="space-y-4">
      {customerId ? (
        <div className="space-y-1">
          <ContactPropertySelect
            customerId={customerId}
            value={values.placeId}
            onChange={(placeId) => set('placeId', placeId)}
            onLoaded={(properties) => {
              onPropertiesLoaded?.(properties);
            }}
            disabled={disabled}
            variant="stacked"
            reloadKey={propertiesVersion}
          />
          {contactAddress ? (
            <p className="text-xs text-gray-500">Contact address: {contactAddress}</p>
          ) : null}
          <p className="text-xs text-gray-500">Maintaining another house for this contact? Add it as a property.</p>
          <AddContactProperty
            customerId={customerId}
            disabled={disabled}
            onAdded={(placeId) => {
              set('placeId', placeId);
              setPropertiesVersion((version) => version + 1);
            }}
          />
        </div>
      ) : null}

      <section className="space-y-4 rounded-lg border-2 border-black p-4">
        <h2 className="text-base font-semibold text-gray-900">Maintenance agreement</h2>
        <FormField label="Agreement name" required>
          <Input
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Weekly landscape maintenance"
            disabled={disabled}
          />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="How often" required>
            <Select
              value={values.frequency}
              onChange={(e) => set('frequency', e.target.value as MaintenanceFrequency)}
              disabled={disabled}
            >
              {MAINTENANCE_FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {MAINTENANCE_FREQUENCY_LABELS[frequency]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Price per visit ($)">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={values.amount}
              onChange={(e) => set('amount', e.target.value)}
              placeholder="0.00"
              disabled={disabled}
            />
          </FormField>
          <FormField label="Next visit">
            <Input
              type="date"
              value={values.nextVisitDate}
              onChange={(e) => set('nextVisitDate', e.target.value)}
              disabled={disabled}
            />
          </FormField>
          <FormField label="Agreement ends" tip="Leave empty for an open-ended agreement.">
            <Input
              type="date"
              value={values.endDate}
              onChange={(e) => set('endDate', e.target.value)}
              disabled={disabled}
            />
          </FormField>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border-2 border-black p-4">
        <h2 className="text-base font-semibold text-gray-900">The job</h2>
        <FormField label="Jobs at this house" tip="Tap the jobs the crew does each visit. New jobs stay in your list for the next house.">
          <JobPicker scope={values.scopeOfWork} onChange={(scope) => set('scopeOfWork', scope)} disabled={disabled} />
        </FormField>
        <FormField label="What the crew does each visit" tip="One job per line. Add details the buttons do not cover.">
          <textarea
            value={values.scopeOfWork}
            onChange={(e) => set('scopeOfWork', e.target.value)}
            rows={5}
            maxLength={4000}
            placeholder={'Mow front and back lawn\nTrim hedges along the driveway\nCheck irrigation and replace broken heads\nBlow and clean walkways'}
            className={textareaClass}
            disabled={disabled}
          />
        </FormField>
        <FormField label="Access notes" tip="Gate code, pets, parking, water shut-off.">
          <textarea
            value={values.accessNotes}
            onChange={(e) => set('accessNotes', e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Side gate code 1234 · Dog in backyard · Park on the street"
            className={textareaClass}
            disabled={disabled}
          />
        </FormField>
      </section>
    </div>
  );
}
