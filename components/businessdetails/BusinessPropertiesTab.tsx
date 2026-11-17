'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Home, Loader2, Plus, Trash2 } from 'lucide-react';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getCsrfToken } from '@/lib/utils/csrf';

export interface RealtorProperty {
  id: string;
  title: string;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  price_cents: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  status: string;
  description: string | null;
  image_url: string | null;
  show_on_profile: boolean;
}

interface BusinessPropertiesTabProps {
  businessId: string;
  isOwner: boolean;
}

function formatPrice(cents: number | null): string {
  if (cents == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

function statusLabel(status: string, t: (key: string) => string): string {
  switch (status) {
    case 'pending':
      return t('statusPending');
    case 'sold':
      return t('statusSold');
    case 'off_market':
      return t('statusOffMarket');
    default:
      return t('statusForSale');
  }
}

export default function BusinessPropertiesTab({ businessId, isOwner }: BusinessPropertiesTabProps) {
  const t = useTranslations('businessProperties');
  const [properties, setProperties] = useState<RealtorProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [price, setPrice] = useState('');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const response = await fetch(`/api/businesses/${businessId}/properties`, { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      setError(null);
      if (!response.ok) throw new Error(data.error || t('loadError'));
      setProperties((data.properties ?? []) as RealtorProperty[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadError'));
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (property) =>
        property.title.toLowerCase().includes(q) ||
        (property.city ?? '').toLowerCase().includes(q) ||
        (property.street_address ?? '').toLowerCase().includes(q)
    );
  }, [properties, query]);

  const save = async () => {
    if (!title.trim()) {
      setError(t('titleRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const csrf = await getCsrfToken();
      const priceCents = price.trim() ? Math.round(Number(price) * 100) : null;
      const response = await fetch(`/api/businesses/${businessId}/properties`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({
          title: title.trim(),
          city: city.trim() || null,
          price_cents: Number.isFinite(priceCents) ? priceCents : null,
          beds: beds.trim() ? Number(beds) : null,
          baths: baths.trim() ? Number(baths) : null,
          show_on_profile: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('saveError'));
      setProperties((current) => [data.property as RealtorProperty, ...current]);
      setShowForm(false);
      setTitle('');
      setCity('');
      setPrice('');
      setBeds('');
      setBaths('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (propertyId: string) => {
    setError(null);
    try {
      const csrf = await getCsrfToken();
      const response = await fetch(`/api/businesses/${businessId}/properties/${propertyId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('deleteError'));
      setProperties((current) => current.filter((property) => property.id !== propertyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deleteError'));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-black">{t('heading')}</h2>
        {isOwner ? (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="flex items-center gap-2"
            onClick={() => setShowForm((open) => !open)}
          >
            <Plus className="h-4 w-4" />
            {t('add')}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {showForm ? (
        <div className="space-y-3 rounded-lg border-2 border-black p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">{t('title')}</span>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t('city')}</span>
              <Input value={city} onChange={(event) => setCity(event.target.value)} className="w-full" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t('price')}</span>
              <Input value={price} onChange={(event) => setPrice(event.target.value)} className="w-full" placeholder="450000" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t('beds')}</span>
              <Input value={beds} onChange={(event) => setBeds(event.target.value)} className="w-full" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">{t('baths')}</span>
              <Input value={baths} onChange={(event) => setBaths(event.target.value)} className="w-full" />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="primary" size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? t('saving') : t('save')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {properties.length > 0 ? (
        <TypingSearchInput value={query} onChange={setQuery} placeholder={t('search')}
          clearLabel={t('clearSearch')} className="w-full" />
      ) : null}

      {properties.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
          <Home className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-700">{isOwner ? t('emptyOwner') : t('empty')}</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-600">{t('noResults')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((property) => (
            <li key={property.id} className="rounded-lg border-2 border-black p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-black">{property.title}</p>
                  <p className="text-sm text-gray-600">
                    {[property.city, property.state].filter(Boolean).join(', ') || property.street_address || '—'}
                  </p>
                  <p className="mt-1 text-sm font-medium">{formatPrice(property.price_cents)}</p>
                  <p className="text-xs text-gray-500">
                    {statusLabel(property.status, t)}
                    {property.beds != null ? ` · ${property.beds} ${t('bedsShort')}` : ''}
                    {property.baths != null ? ` · ${property.baths} ${t('bathsShort')}` : ''}
                  </p>
                </div>
                {isOwner ? (
                  <button
                    type="button"
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                    aria-label={t('remove')}
                    onClick={() => void remove(property.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
