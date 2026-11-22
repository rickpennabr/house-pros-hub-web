'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Leaf, Loader2, Minus, Plus, ScanSearch, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FileDropTarget } from '@/components/ui/FileDropTarget';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { uploadProDriveFile } from '@/lib/drive/upload-client';
import { PlantIdentifierModal } from '@/components/ai/PlantIdentifierModal';
import type { PlantIdentification } from '@/lib/ai/plant-id';

interface PlantImage {
  id: string;
  driveFileId: string;
  url: string | null;
}

interface Plant {
  id: string;
  name: string;
  quantity: number;
  area: string | null;
  notes: string | null;
  images: PlantImage[];
}

const AREA_KEYS = ['front', 'back', 'side', 'pool', 'patio', 'planters', 'parkway'] as const;
const PLANT_IMAGE_LIMIT = 8;

interface MaintenancePlantsPanelProps {
  customerId: string;
  /** The maintenance house. Its plants, plus older ones shared by the contact's houses. */
  planId?: string | null;
  businessId: string | null;
  disabled?: boolean;
}

/** Plant inventory for the property being maintained. Saved on the customer, so it carries to every visit. */
export function MaintenancePlantsPanel({ customerId, planId = null, businessId, disabled = false }: MaintenancePlantsPanelProps) {
  const t = useTranslations('maintenance.plants');
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const newPhotosInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ customerId, ...(planId ? { planId } : {}) });
    fetch(`/api/crm/maintenance/plants?${query}`, { credentials: 'include' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) throw new Error(body.error || t('loadFailed'));
        setPlants(body.plants ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, planId, t]);

  const replacePlant = (next: Plant | undefined) => {
    if (!next) return;
    setPlants((current) => current.map((plant) => (plant.id === next.id ? next : plant)));
  };

  async function uploadPhotos(plantId: string, files: File[]): Promise<Plant | undefined> {
    if (!businessId) throw new Error(t('noBusiness'));
    let latest: Plant | undefined;
    for (const file of files) {
      const saved = await uploadProDriveFile({
        file,
        ownerType: 'business',
        ownerId: businessId,
        ensureFolderNames: ['Maintenance', 'Plants', customerId.slice(0, 8)],
      });
      const response = await fetch(`/api/crm/maintenance/plants/${plantId}/images`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driveFileId: saved.id }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || t('photoFailed'));
      latest = body.plant;
    }
    return latest;
  }

  async function addPlant() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('nameRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/crm/maintenance/plants', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, planId, name: trimmed, quantity, area: area || null, notes: notes.trim() || null }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || t('saveFailed'));
      let plant: Plant = body.plant;
      setPlants((current) => [...current, plant]);
      if (pendingPhotos.length > 0) {
        setUploadingFor(plant.id);
        const withPhotos = await uploadPhotos(plant.id, pendingPhotos.slice(0, PLANT_IMAGE_LIMIT));
        if (withPhotos) plant = withPhotos;
        replacePlant(plant);
      }
      setName('');
      setQuantity(1);
      setNotes('');
      setPendingPhotos([]);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setSaving(false);
      setUploadingFor(null);
    }
  }

  async function addPhotosToPlant(plant: Plant, files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const room = PLANT_IMAGE_LIMIT - plant.images.length;
    if (room <= 0) {
      setError(t('photoLimit', { count: PLANT_IMAGE_LIMIT }));
      return;
    }
    setUploadingFor(plant.id);
    setError(null);
    try {
      replacePlant(await uploadPhotos(plant.id, Array.from(files).slice(0, room)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('photoFailed'));
    } finally {
      setUploadingFor(null);
    }
  }

  async function removePhoto(plant: Plant, imageId: string) {
    setError(null);
    const response = await fetch(`/api/crm/maintenance/plants/${plant.id}/images/${imageId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || t('photoFailed'));
      return;
    }
    replacePlant(body.plant);
  }

  async function changeQuantity(plant: Plant, next: number) {
    if (next < 1 || next > 9999) return;
    replacePlant({ ...plant, quantity: next });
    const response = await fetch(`/api/crm/maintenance/plants/${plant.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: next }),
    });
    if (!response.ok) {
      replacePlant(plant);
      setError(t('saveFailed'));
    }
  }

  async function removePlant(plant: Plant) {
    if (!window.confirm(t('removeConfirm', { name: plant.name }))) return;
    setError(null);
    const response = await fetch(`/api/crm/maintenance/plants/${plant.id}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) {
      setError(t('saveFailed'));
      return;
    }
    setPlants((current) => current.filter((item) => item.id !== plant.id));
  }

  const totalPlants = plants.reduce((sum, plant) => sum + plant.quantity, 0);
  const areaLabel = (value: string | null) =>
    value && (AREA_KEYS as readonly string[]).includes(value) ? t(`area_${value}` as 'area_front') : value;

  return (
    <section className="space-y-3 rounded-lg border-2 border-black p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Leaf className="h-4 w-4 text-green-700" />
          {t('title')}
          {plants.length > 0 && (
            <span className="text-xs font-normal text-gray-600">{t('summary', { kinds: plants.length, total: totalPlants })}</span>
          )}
        </div>
        {!showForm && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={() => setIdentifying(true)}>
              <ScanSearch className="mr-1 h-4 w-4" />
              {t('identify')}
            </Button>
            <Button type="button" size="sm" disabled={disabled} onClick={() => setShowForm(true)} className="rounded-lg">
              <Plus className="mr-1 h-4 w-4" />
              {t('add')}
            </Button>
          </div>
        )}
      </div>

      <PlantIdentifierModal
        isOpen={identifying}
        onClose={() => setIdentifying(false)}
        useLabel={t('addIdentified')}
        onUse={(result: PlantIdentification, photo: File) => {
          // Fill the plant form: the name the crew knows, the Latin name and care in the notes, the photo.
          const care = [result.care.water, result.care.pruning].filter(Boolean).join(' ');
          setName(result.commonName || result.scientificName);
          setNotes([result.commonName && result.scientificName ? result.scientificName : '', care].filter(Boolean).join('. '));
          setPendingPhotos([photo]);
          setShowForm(true);
          setIdentifying(false);
        }}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showForm && (
        <div className="space-y-2 rounded-lg border border-black/20 p-3">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('namePlaceholder')} />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">{t('quantity')}</span>
              <button
                type="button"
                aria-label={`${t('quantity')} -1`}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-black"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <input
                type="number"
                min={1}
                max={9999}
                value={quantity}
                onChange={(event) => setQuantity(Math.min(9999, Math.max(1, Number(event.target.value) || 1)))}
                className="w-16 rounded-lg border-2 border-black px-2 py-1 text-center text-sm"
              />
              <button
                type="button"
                aria-label={`${t('quantity')} +1`}
                onClick={() => setQuantity((q) => Math.min(9999, q + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-black"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <select
              value={area}
              onChange={(event) => setArea(event.target.value)}
              className="rounded-lg border-2 border-black px-3 py-1.5 text-sm"
            >
              <option value="">{t('areaChoose')}</option>
              {AREA_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`area_${key}` as 'area_front')}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder={t('notesPlaceholder')}
            className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={newPhotosInput}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(event) => {
                setPendingPhotos(Array.from(event.target.files ?? []).slice(0, PLANT_IMAGE_LIMIT));
                event.target.value = '';
              }}
            />
            {/* Computer: a drop box. Phone: the camera button. */}
            <FileDropZone
              className="hidden w-full md:block"
              compact
              multiple
              accept="image/*"
              onFiles={(files) => setPendingPhotos(files.slice(0, PLANT_IMAGE_LIMIT))}
              label={pendingPhotos.length > 0 ? t('photosPicked', { count: pendingPhotos.length }) : undefined}
              hint={`Up to ${PLANT_IMAGE_LIMIT} photos · JPEG, PNG or WebP`}
            />
            <FileDropTarget
              onFiles={(files) => setPendingPhotos(files.slice(0, PLANT_IMAGE_LIMIT))}
              accept="image/*"
              multiple
              rounded="rounded-lg"
              className="md:hidden"
            >
              <Button type="button" variant="outline" size="sm" onClick={() => newPhotosInput.current?.click()} className="rounded-lg border-2 border-black">
                <Camera className="mr-1 h-4 w-4" />
                {pendingPhotos.length > 0 ? t('photosPicked', { count: pendingPhotos.length }) : t('addPhotos')}
              </Button>
            </FileDropTarget>
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={saving} onClick={() => void addPlant()} className="rounded-lg">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {t('save')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setPendingPhotos([]);
              }}
              className="rounded-lg"
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {loaded && plants.length === 0 && !showForm && <p className="text-sm text-gray-600">{t('empty')}</p>}

      <ul className="space-y-2">
        {plants.map((plant) => (
          <li key={plant.id} className="rounded-lg border border-black/15 p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{plant.name}</div>
                <div className="text-xs text-gray-600">
                  {[areaLabel(plant.area), plant.notes].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={`${t('quantity')} -1`}
                  disabled={disabled || plant.quantity <= 1}
                  onClick={() => void changeQuantity(plant, plant.quantity - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-black disabled:opacity-40"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-8 text-center font-mono text-sm tabular-nums">{plant.quantity}</span>
                <button
                  type="button"
                  aria-label={`${t('quantity')} +1`}
                  disabled={disabled}
                  onClick={() => void changeQuantity(plant, plant.quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-black disabled:opacity-40"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={t('remove')}
                  disabled={disabled}
                  onClick={() => void removePlant(plant)}
                  className="ml-1 p-1 text-gray-600 hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {plant.images.map((image) => (
                <div key={image.id} className="relative">
                  {image.url ? (
                    <button type="button" onClick={() => setPreview(image.url)} aria-label={t('viewPhoto')}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed ProDrive URL */}
                      <img src={image.url} alt={plant.name} className="h-14 w-14 rounded-md object-cover" />
                    </button>
                  ) : (
                    <div className="h-14 w-14 rounded-md bg-gray-100" />
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      aria-label={t('removePhoto')}
                      onClick={() => void removePhoto(plant, image.id)}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-black text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {plant.images.length < PLANT_IMAGE_LIMIT && !disabled && (
                <FileDropTarget
                  onFiles={(files) => void addPhotosToPlant(plant, files)}
                  accept="image/*"
                  multiple
                  rounded="rounded-md"
                >
                  <label className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-black/40 text-gray-600">
                    {uploadingFor === plant.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      aria-label={t('addPhotos')}
                      onChange={(event) => {
                        void addPhotosToPlant(plant, event.target.files);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </FileDropTarget>
              )}
            </div>
          </li>
        ))}
      </ul>

      {preview && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- signed ProDrive URL */}
          <img src={preview} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}
    </section>
  );
}
