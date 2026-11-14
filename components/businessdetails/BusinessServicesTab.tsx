'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Pencil, Search, Tag, Trash2, X, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getCsrfToken } from '@/lib/utils/csrf';
import {
  formatCatalogPrice,
  SERVICE_PRICE_TYPES,
  SERVICE_UNITS,
  type CatalogService,
  type ServicePriceType,
  type ServiceUnit,
} from '@/lib/booking/catalogService';

interface BusinessServicesTabProps {
  businessId: string;
  businessSlug: string;
  isOwner: boolean;
  /** Name-only services already saved on the business, shown until the catalog exists. */
  fallbackNames?: string[];
  /** True when the pro turned on appointments in ProsCRM. */
  bookingEnabled?: boolean;
}

interface ServiceForm {
  name: string;
  description: string;
  category: string;
  price: string;
  priceMax: string;
  priceType: ServicePriceType;
  unit: ServiceUnit;
  imageUrl: string;
  isActive: boolean;
}

const emptyForm = (): ServiceForm => ({
  name: '',
  description: '',
  category: '',
  price: '',
  priceMax: '',
  priceType: 'fixed',
  unit: 'job',
  imageUrl: '',
  isActive: true,
});

function formFromService(service: CatalogService): ServiceForm {
  return {
    name: service.name,
    description: service.description,
    category: service.category,
    price: service.priceCents > 0 ? String(service.priceCents / 100) : '',
    priceMax: service.priceMaxCents != null && service.priceMaxCents > 0 ? String(service.priceMaxCents / 100) : '',
    priceType: service.priceType,
    unit: service.unit,
    imageUrl: service.imageUrl ?? '',
    isActive: service.isActive,
  };
}

export default function BusinessServicesTab({
  businessId,
  businessSlug,
  isOwner,
  fallbackNames = [],
  bookingEnabled = false,
}: BusinessServicesTabProps) {
  const t = useTranslations('businessServices');
  const locale = useLocale();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const unitLabels: Record<ServiceUnit, string> = {
    job: t('job'),
    hour: t('hour'),
    sqft: t('sqft'),
    each: t('each'),
  };

  const needle = query.trim().toLowerCase();
  const visibleServices = useMemo(() => {
    if (!needle) return services;
    return services.filter((service) =>
      [service.name, service.description, service.category].join(' ').toLowerCase().includes(needle)
    );
  }, [needle, services]);
  const visibleFallback = useMemo(() => {
    if (!needle) return fallbackNames;
    return fallbackNames.filter((name) => name.toLowerCase().includes(needle));
  }, [fallbackNames, needle]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/services`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('error'));
      setServices(Array.isArray(data.services) ? data.services : []);
      setReady(data.ready !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setLoading(false);
    }
  }, [businessId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setPhotoFile(null);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (service: CatalogService) => {
    setEditingId(service.id);
    setForm(formFromService(service));
    setPhotoFile(null);
    setShowForm(true);
    setError(null);
  };

  const uploadPhoto = async (file: File): Promise<string> => {
    const body = new FormData();
    body.append('file', file);
    body.append('businessId', businessId);
    const res = await fetch('/api/storage/upload-business-image', {
      method: 'POST',
      credentials: 'include',
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || t('error'));
    return data.url as string;
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const imageUrl = photoFile ? await uploadPhoto(photoFile) : form.imageUrl.trim();
      const csrfToken = await getCsrfToken();
      const payload = {
        name: form.name,
        description: form.description,
        category: form.category,
        price: form.price === '' ? 0 : Number(form.price),
        priceMax: form.priceType === 'range' && form.priceMax !== '' ? Number(form.priceMax) : null,
        priceType: form.priceType,
        unit: form.unit,
        imageUrl: imageUrl || null,
        isActive: form.isActive,
      };
      const url = editingId
        ? `/api/businesses/${encodeURIComponent(businessId)}/services/${editingId}`
        : `/api/businesses/${encodeURIComponent(businessId)}/services`;
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('error'));
      setShowForm(false);
      setPhotoFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (serviceId: string) => {
    setSaving(true);
    setError(null);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/services/${serviceId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('error'));
      setPendingDeleteId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white md:p-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-red-500" size={20} />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="h-10 w-full rounded-lg border-2 border-black bg-white pl-10 pr-8 text-base text-black placeholder:text-gray-500 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-gray-600 hover:text-black"
              aria-label={t('cancel')}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {isOwner && ready && !showForm && (
          <Button type="button" variant="primary" size="sm" onClick={openCreate}>
            {t('add')}
          </Button>
        )}
      </div>
      {isOwner && !bookingEnabled && (
        <p className="text-sm text-gray-600">{t('bookingOffHint')}</p>
      )}

      {error && (
        <p className="rounded-lg border-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {!ready && isOwner && <p className="text-sm text-gray-600">{t('unavailable')}</p>}

      {showForm && isOwner && (
        <form
          className="space-y-3 rounded-lg border-2 border-black p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder={t('name')}
            required
            minLength={2}
            maxLength={80}
          />
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder={t('description')}
            maxLength={200}
            rows={2}
            className="w-full rounded-lg border-2 border-black p-2 text-sm"
          />
          <Input
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            placeholder={t('category')}
            maxLength={80}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t('priceType')}</span>
              <select
                value={form.priceType}
                onChange={(event) => setForm((current) => ({ ...current, priceType: event.target.value as ServicePriceType }))}
                className="w-full rounded-lg border-2 border-black bg-white p-2"
              >
                {SERVICE_PRICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === 'fixed' ? t('fixed') : type === 'starting_at' ? t('startingAt') : t('range')}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t('unit')}</span>
              <select
                value={form.unit}
                onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value as ServiceUnit }))}
                className="w-full rounded-lg border-2 border-black bg-white p-2"
              >
                {SERVICE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unitLabels[unit]}
                  </option>
                ))}
              </select>
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              placeholder={t('price')}
            />
            {form.priceType === 'range' && (
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.priceMax}
                onChange={(event) => setForm((current) => ({ ...current, priceMax: event.target.value }))}
                placeholder={t('priceHigh')}
                required
              />
            )}
          </div>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('photo')}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            {t('active')}
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setPhotoFile(null);
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        </form>
      )}

      {services.length === 0 && !showForm && fallbackNames.length > 0 && visibleFallback.length === 0 && (
        <p className="text-sm text-gray-600">{t('noResults')}</p>
      )}

      {services.length === 0 && !showForm && visibleFallback.length > 0 && (
        <div className="space-y-3">
          <ul className="flex flex-wrap gap-2">
            {visibleFallback.map((name) => (
              <li key={name} className="rounded-lg border-2 border-black px-3 py-1.5 text-sm font-medium">
                {name}
              </li>
            ))}
          </ul>
          {bookingEnabled && (
            <Link
              href={`/${locale}/book/${businessSlug}`}
              className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-black px-3 py-1.5 text-sm font-medium text-white"
            >
              <Calendar className="h-4 w-4" />
              {t('makeAppointment')}
            </Link>
          )}
        </div>
      )}

      {services.length === 0 && !showForm && fallbackNames.length === 0 && (
        <p className="text-sm text-gray-600">{isOwner ? t('emptyOwner') : t('empty')}</p>
      )}

      {services.length > 0 && visibleServices.length === 0 && (
        <p className="text-sm text-gray-600">{t('noResults')}</p>
      )}

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {visibleServices.map((service) => {
          const price = formatCatalogPrice(service, locale, {
            requestPrice: t('requestPrice'),
            from: t('from'),
            units: unitLabels,
          });
          return (
            <li key={service.id} className="flex gap-3 rounded-lg border-2 border-black p-3">
              {service.imageUrl ? (
                <Image
                  src={service.imageUrl}
                  alt=""
                  width={72}
                  height={72}
                  className="h-16 w-16 shrink-0 rounded-lg border-2 border-black object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-gray-50">
                  <Tag className="h-6 w-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-semibold text-black">{service.name}</p>
                  {!service.isActive && isOwner && (
                    <span className="shrink-0 text-xs font-medium text-gray-500">{t('hidden')}</span>
                  )}
                </div>
                {service.category ? <p className="text-xs text-gray-500">{service.category}</p> : null}
                <p className="text-sm font-medium text-black">{price}</p>
                {service.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-700">{service.description}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {service.isActive && bookingEnabled && (
                    <Link
                      href={`/${locale}/book/${businessSlug}?service=${service.id}`}
                      className="inline-flex items-center gap-1 rounded-lg border-2 border-black bg-black px-3 py-1 text-xs font-medium text-white"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {t('makeAppointment')}
                    </Link>
                  )}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => openEdit(service)}
                      className="inline-flex items-center gap-1 rounded-lg border-2 border-black px-3 py-1 text-xs font-medium"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t('edit')}
                    </button>
                  )}
                  {isOwner && pendingDeleteId !== service.id && (
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(service.id)}
                      className="inline-flex items-center gap-1 rounded-lg border-2 border-red-600 px-3 py-1 text-xs font-medium text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('remove')}
                    </button>
                  )}
                  {isOwner && pendingDeleteId === service.id && (
                    <button
                      type="button"
                      onClick={() => void remove(service.id)}
                      disabled={saving}
                      className="rounded-lg border-2 border-red-600 bg-red-600 px-3 py-1 text-xs font-medium text-white"
                    >
                      {t('confirmRemove')}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
