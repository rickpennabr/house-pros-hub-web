'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Hammer, Truck, X } from 'lucide-react';
import Accordion from '@/components/ui/Accordion';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { FileDropTarget } from '@/components/ui/FileDropTarget';
import { Select } from '@/components/ui/Select';
import { uploadProDriveFile } from '@/lib/drive/upload-client';
import {
  DEFAULT_LIFE_YEARS,
  TOOL_CATEGORIES,
  TOOL_STATUS_LABELS,
  TOOL_STATUSES,
  type ToolKind,
  type ToolStatus,
} from '@/lib/crm/pro-tools';
import { PickerSelect } from '@/components/ui/PickerSelect';

export interface ToolFormValues {
  /** Empty until the user picks Tool or Equipment. */
  kind: ToolKind | '';
  name: string;
  category: string;
  brand: string;
  model: string;
  serialNumber: string;
  quantity: string;
  purchaseDate: string;
  /** Dollars as typed. */
  purchase: string;
  usefulLifeYears: string;
  salvage: string;
  /** Dollars per day charged to the job it works on. */
  dailyRate: string;
  status: ToolStatus;
  assignedCrewId: string;
  projectId: string;
  maintenancePlanId: string;
  location: string;
  nextServiceDate: string;
  photoDriveFileId: string;
  photoUrl: string;
  note: string;
}

export const EMPTY_TOOL: ToolFormValues = {
  kind: '',
  name: '',
  category: '',
  brand: '',
  model: '',
  serialNumber: '',
  quantity: '1',
  purchaseDate: '',
  purchase: '',
  usefulLifeYears: '',
  salvage: '',
  dailyRate: '',
  status: 'available',
  assignedCrewId: '',
  projectId: '',
  maintenancePlanId: '',
  location: '',
  nextServiceDate: '',
  photoDriveFileId: '',
  photoUrl: '',
  note: '',
};

const cents = (dollars: string) => {
  const value = Number(dollars);
  return dollars.trim() === '' || !Number.isFinite(value) ? 0 : Math.max(0, Math.round(value * 100));
};

export function toolFormError(values: ToolFormValues): string | null {
  if (!values.kind) return 'Pick Tool or Equipment.';
  if (!values.name.trim()) return 'Name the item.';
  const quantity = Number(values.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return 'Quantity must be 1 or more.';
  if (!(Number(values.usefulLifeYears) > 0)) return 'Useful life must be more than 0 years.';
  if (cents(values.salvage) > cents(values.purchase)) return 'Value at the end cannot be more than the cost.';
  return null;
}

/** Request body for POST/PATCH /api/crm/tools. */
export function toolPayload(values: ToolFormValues) {
  return {
    kind: (values.kind || 'tool') as ToolKind,
    name: values.name.trim(),
    category: values.category.trim() || null,
    brand: values.brand.trim() || null,
    model: values.model.trim() || null,
    serialNumber: values.serialNumber.trim() || null,
    quantity: Number(values.quantity) || 1,
    purchaseDate: values.purchaseDate || null,
    purchaseCents: cents(values.purchase),
    usefulLifeYears: Number(values.usefulLifeYears) || DEFAULT_LIFE_YEARS[values.kind || 'tool'],
    salvageCents: cents(values.salvage),
    dailyRateCents: values.dailyRate.trim() === '' ? undefined : cents(values.dailyRate),
    status: values.status,
    assignedCrewId: values.assignedCrewId || null,
    projectId: values.projectId || null,
    maintenancePlanId: values.maintenancePlanId || null,
    location: values.location.trim() || null,
    nextServiceDate: values.nextServiceDate || null,
    photoDriveFileId: values.photoDriveFileId || null,
    note: values.note.trim() || null,
  };
}

export interface ToolPickLists {
  crew: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  houses: { id: string; name: string }[];
}

/** Crew, projects, and maintenance houses for the "where is it" pickers. */
export function useToolPickLists(): ToolPickLists {
  const [lists, setLists] = useState<ToolPickLists>({ crew: [], projects: [], houses: [] });
  useEffect(() => {
    let cancelled = false;
    const get = (url: string) =>
      fetch(url, { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : {}))
        .catch(() => ({})) as Promise<Record<string, unknown>>;
    Promise.all([
      get('/api/crm/maintenance/crew'),
      get('/api/crm/projects?pageSize=200&sortBy=updated_at&sortDir=desc'),
      get('/api/crm/maintenance/houses?pageSize=100&sortBy=name'),
    ]).then(([crew, projects, houses]) => {
      if (cancelled) return;
      setLists({
        crew: ((crew.crew ?? []) as Array<{ id: string; displayName: string; status?: string }>)
          .filter((member) => member.status !== 'disabled')
          .map((member) => ({ id: member.id, name: member.displayName })),
        projects: ((projects.projects ?? []) as Array<{ id: string; name: string; status?: string }>)
          .filter((project) => project.status !== 'cancelled')
          .map((project) => ({ id: project.id, name: project.name })),
        houses: ((houses.houses ?? []) as Array<{ id: string; customerName: string; placeName: string | null }>).map((house) => ({
          id: house.id,
          name: house.placeName ? `${house.customerName} · ${house.placeName}` : house.customerName,
        })),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return lists;
}

interface ToolFormProps {
  values: ToolFormValues;
  onChange: (values: ToolFormValues) => void;
  lists: ToolPickLists;
  businessId: string | null;
  disabled?: boolean;
}

const textareaClass =
  'w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none disabled:opacity-50';

export function ToolForm({ values, onChange, lists, businessId, disabled = false }: ToolFormProps) {
  const set = <K extends keyof ToolFormValues>(key: K, value: ToolFormValues[K]) => onChange({ ...values, [key]: value });
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [costOpen, setCostOpen] = useState(true);
  const [whereOpen, setWhereOpen] = useState(true);

  const pickKind = (kind: ToolKind) => {
    const lifeUntouched = values.usefulLifeYears === ''
      || (values.kind !== '' && values.usefulLifeYears === String(DEFAULT_LIFE_YEARS[values.kind]));
    onChange({ ...values, kind, usefulLifeYears: lifeUntouched ? String(DEFAULT_LIFE_YEARS[kind]) : values.usefulLifeYears });
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file || !businessId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const saved = await uploadProDriveFile({ file, ownerType: 'business', ownerId: businessId, ensureFolderNames: ['ProTools'] });
      onChange({ ...values, photoDriveFileId: saved.id, photoUrl: URL.createObjectURL(file) });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not upload the photo');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Accordion
        title="What it is"
        subtitle={detailsOpen ? undefined : [values.kind === 'equipment' ? 'Equipment' : values.kind === 'tool' ? 'Tool' : '', values.name.trim()].filter(Boolean).join(' · ')}
        isOpen={detailsOpen}
        onToggle={() => setDetailsOpen((open) => !open)}
        flush
      >
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { kind: 'tool', label: 'Tool', hint: 'Drills, saws, trimmers', Icon: Hammer },
              { kind: 'equipment', label: 'Equipment', hint: 'Mowers, trailers, lifts', Icon: Truck },
            ] as const
          ).map(({ kind, label, hint, Icon }) => (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              aria-pressed={values.kind === kind}
              onClick={() => pickKind(kind)}
              className={`flex items-center gap-3 rounded-lg border-2 border-black p-3 text-left transition-colors ${
                values.kind === kind ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>
                <span className="block font-semibold">{label}</span>
                <span className={`block text-xs ${values.kind === kind ? 'text-gray-200' : 'text-gray-500'}`}>{hint}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-4">
          <div className="shrink-0">
            <FileDropTarget
              onFiles={(files) => void uploadPhoto(files[0])}
              accept="image/*"
              disabled={disabled || uploading || !businessId}
            >
            <button
              type="button"
              disabled={disabled || uploading || !businessId}
              onClick={() => fileInput.current?.click()}
              className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-black bg-gray-50 text-gray-500 hover:bg-gray-100"
              aria-label="Add a photo"
            >
              {values.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed storage or local preview URL
                <img src={values.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-xs">
                  <Camera className="h-5 w-5" />
                  {uploading ? 'Uploading…' : 'Photo'}
                </span>
              )}
            </button>
            </FileDropTarget>
            {values.photoUrl && !disabled ? (
              <button
                type="button"
                onClick={() => onChange({ ...values, photoDriveFileId: '', photoUrl: '' })}
                className="mt-1 inline-flex items-center gap-1 text-xs underline"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            ) : null}
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void uploadPhoto(e.target.files?.[0])}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <FormField label="Name" required>
              <Input
                value={values.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={values.kind === 'equipment' ? 'e.g. Zero-turn mower' : 'e.g. Cordless drill'}
                maxLength={120}
                disabled={disabled}
              />
            </FormField>
            <FormField label="Category">
              <Input
                list="tool-categories"
                value={values.category}
                onChange={(e) => set('category', e.target.value)}
                placeholder="Pick or type one"
                maxLength={60}
                disabled={disabled}
              />
              <datalist id="tool-categories">
                {TOOL_CATEGORIES.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </FormField>
          </div>
        </div>
        {uploadError ? <p className="text-xs text-red-700">{uploadError}</p> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Brand">
            <Input value={values.brand} onChange={(e) => set('brand', e.target.value)} maxLength={80} disabled={disabled} />
          </FormField>
          <FormField label="Model">
            <Input value={values.model} onChange={(e) => set('model', e.target.value)} maxLength={80} disabled={disabled} />
          </FormField>
          <FormField label="Serial number">
            <Input value={values.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} maxLength={80} disabled={disabled} />
          </FormField>
        </div>
      </Accordion>

      <Accordion
        title="Cost and value"
        subtitle={costOpen || !values.purchase ? undefined : `$${values.purchase} paid`}
        isOpen={costOpen}
        onToggle={() => setCostOpen((open) => !open)}
        flush
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <FormField label="Total paid ($)">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={values.purchase}
              onChange={(e) => set('purchase', e.target.value)}
              placeholder="0.00"
              disabled={disabled}
            />
          </FormField>
          <FormField label="Quantity">
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={values.quantity}
              onChange={(e) => set('quantity', e.target.value)}
              disabled={disabled}
            />
          </FormField>
          <FormField label="Bought on">
            <Input type="date" value={values.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} disabled={disabled} />
          </FormField>
          <FormField label="Useful life (years)" tip="How long it usually lasts. Its value drops evenly over these years.">
            <Input
              type="number"
              inputMode="decimal"
              min="0.5"
              max="50"
              step="0.5"
              value={values.usefulLifeYears}
              onChange={(e) => set('usefulLifeYears', e.target.value)}
              disabled={disabled}
            />
          </FormField>
          <FormField label="Value at the end ($)" tip="What you could sell it for when it is worn out. Leave empty for 0.">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={values.salvage}
              onChange={(e) => set('salvage', e.target.value)}
              placeholder="0.00"
              disabled={disabled}
            />
          </FormField>
          <FormField
            label="Daily rate charged to jobs ($)"
            tip="What a day of this item costs a job: wear, fuel, upkeep. Days it is assigned to a project or house count on that job's financial report. Leave empty or 0 for none."
          >
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={values.dailyRate}
              onChange={(e) => set('dailyRate', e.target.value)}
              placeholder="0.00"
              disabled={disabled}
            />
          </FormField>
          <FormField label="Next service">
            <Input
              type="date"
              value={values.nextServiceDate}
              onChange={(e) => set('nextServiceDate', e.target.value)}
              disabled={disabled}
            />
          </FormField>
        </div>
      </Accordion>

      <Accordion
        title="Where it is"
        isOpen={whereOpen}
        onToggle={() => setWhereOpen((open) => !open)}
        flush
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Status">
            <Select value={values.status} onChange={(e) => set('status', e.target.value as ToolStatus)} disabled={disabled}>
              {TOOL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TOOL_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Who has it">
            <PickerSelect
              value={values.assignedCrewId}
              onChange={(value) => set('assignedCrewId', value)}
              noneLabel={"Nobody (in the shop)"}
              disabled={disabled}
              options={lists.crew.map((member) => ({ value: String(member.id), label: String(member.name) }))}
            />
          </FormField>
          <FormField label="Project">
            <PickerSelect
              value={values.projectId}
              onChange={(value) => set('projectId', value)}
              noneLabel={"No project"}
              disabled={disabled}
              options={lists.projects.map((project) => ({ value: String(project.id), label: String(project.name) }))}
            />
          </FormField>
          <FormField label="Maintenance house">
            <PickerSelect
              value={values.maintenancePlanId}
              onChange={(value) => set('maintenancePlanId', value)}
              noneLabel={"No house"}
              disabled={disabled}
              options={lists.houses.map((house) => ({ value: String(house.id), label: String(house.name) }))}
            />
          </FormField>
          <FormField label="Kept at">
            <Input
              value={values.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Shop, Truck 2, Storage unit…"
              maxLength={120}
              disabled={disabled}
            />
          </FormField>
        </div>
        <FormField label="Notes">
          <textarea
            value={values.note}
            onChange={(e) => set('note', e.target.value)}
            rows={3}
            maxLength={2000}
            className={textareaClass}
            disabled={disabled}
          />
        </FormField>
      </Accordion>
    </div>
  );
}
