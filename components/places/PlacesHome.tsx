'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, Home, Building } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { AddressPinsMap } from '@/components/maps/AddressPinsMap';
import ViewToggle, { type ViewType } from '@/components/pageslayout/ViewToggle';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';
import type { PlaceCard, PlaceKind } from '@/lib/places/portal';

const KINDS: PlaceKind[] = ['house', 'business', 'building'];

function KindIcon({ kind }: { kind: PlaceKind }) {
  if (kind === 'business') return <Building2 className="w-5 h-5 text-red-600" />;
  if (kind === 'building') return <Building className="w-5 h-5 text-red-600" />;
  return <Home className="w-5 h-5 text-red-600" />;
}

function placeAddress(place: PlaceCard): string {
  return [place.street, place.city, place.state, place.zipCode].filter(Boolean).join(', ');
}

export function PlacesHome() {
  const t = useTranslations('places');
  const tAccount = useTranslations('common.account');
  const locale = useLocale();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [listView, setListView] = useState<ViewType>('list');
  const [places, setPlaces] = useState<PlaceCard[]>([]);
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<PlaceKind>('house');
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [adding, setAdding] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'street' | 'city' | 'state' | 'zip', string>>>({});
  const namePlaceholderText = t('namePlaceholder');
  const streetPlaceholderText = t('streetPlaceholder');
  const unitPlaceholderText = t('unitPlaceholder');
  const cityPlaceholderText = t('cityPlaceholder');
  const statePlaceholderText = t('statePlaceholder');
  const zipPlaceholderText = t('zipPlaceholder');
  const placeholders = useMemo(
    () =>
      adding
        ? [namePlaceholderText, streetPlaceholderText, unitPlaceholderText, cityPlaceholderText, statePlaceholderText, zipPlaceholderText]
        : ['', '', '', '', '', ''],
    [adding, namePlaceholderText, streetPlaceholderText, unitPlaceholderText, cityPlaceholderText, statePlaceholderText, zipPlaceholderText]
  );
  const [namePlaceholder, streetPlaceholder, unitPlaceholder, cityPlaceholder, statePlaceholder, zipPlaceholder] = useTypingPlaceholder({
    placeholders,
    typingSpeed: 50,
    delayBetweenFields: 300,
    startDelay: 400,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetch('/api/places', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPlaces(data.places ?? []);
        setEmailConfirmed(data.emailConfirmed !== false);
      })
      .catch(() => setError(t('loadFailed')))
      .finally(() => setLoading(false));
  }, [isAuthenticated, t]);

  const clearFieldError = (field: 'name' | 'street' | 'city' | 'state' | 'zip') => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Partial<Record<'name' | 'street' | 'city' | 'state' | 'zip', string>> = {};
    if (!name.trim()) nextErrors.name = t('nameRequired');
    if (!street.trim()) nextErrors.street = t('streetRequired');
    if (!city.trim()) nextErrors.city = t('cityRequired');
    if (state.trim().length !== 2) nextErrors.state = t('stateLength');
    if (!/^\d{5}(-\d{4})?$/.test(zip.trim())) nextErrors.zip = t('zipInvalid');
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name, street, unit, city, state, zipCode: zip }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('saveFailed'));
      window.location.href = `/${locale}/myplaces/${data.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return <div className="p-4 md:p-6 text-gray-500">{t('loading')}</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="p-4 md:p-6">
        <p>{t('signIn')}</p>
        <Link href={`/${locale}/signin`} className="inline-block mt-4 text-red-600 font-medium">
          {tAccount('signIn')}
        </Link>
      </div>
    );
  }

  return (
    <div className="px-2 pt-4 pb-28 space-y-3 md:px-4">
      <div>
        <p className="text-sm text-gray-700">{t('subtitle')}</p>
        {!emailConfirmed ? <p className="mt-1 text-sm text-red-600">{t('confirmEmail')}</p> : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {adding ? null : listView === 'map' ? (
        <AddressPinsMap
          pins={places.map((place) => ({
            id: place.id,
            title: place.name,
            detail: t(`kind.${place.kind}`),
            address: placeAddress(place),
          }))}
          onOpen={(id) => router.push(`/${locale}/myplaces/${id}`)}
        />
      ) : places.length === 0 ? (
        <p className="border-2 border-black rounded-lg p-4 text-sm text-gray-600">{t('empty')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {places.map((place) => (
            <Link
              key={place.id}
              href={`/${locale}/myplaces/${place.id}`}
              className="border-2 border-black rounded-lg p-4 flex items-start gap-3 hover:bg-gray-50"
            >
              <KindIcon kind={place.kind} />
              <span>
                <span className="block font-medium">{place.name}</span>
                <span className="block text-xs text-gray-600">
                  {t(`kind.${place.kind}`)}
                  {place.city ? ` · ${place.city}` : ''}
                  {place.state ? `, ${place.state}` : ''}
                </span>
                <span className="block text-xs mt-1">
                  {place.projectCount} {t('projects').toLowerCase()} · {place.maintenanceCount} {t('maintenance').toLowerCase()}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {adding ? <form onSubmit={onSubmit} className="border-2 border-black rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">{t('add')}</h2>
        <FormField label={t('selectType')}>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label={t('selectType')}>
            {KINDS.map((item) => {
              const selected = kind === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setKind(item)}
                  className={`rounded-lg border-2 border-black px-2 py-2 text-sm font-medium cursor-pointer ${
                    selected ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'
                  }`}
                >
                  {t(`kind.${item}`)}
                </button>
              );
            })}
          </div>
        </FormField>
        <FormField label={t('name')} required error={fieldErrors.name}>
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError('name');
            }}
            placeholder={namePlaceholder}
            disabled={saving}
            error={fieldErrors.name}
            required
          />
        </FormField>
        <FormField label={t('street')} required error={fieldErrors.street}>
          <AddressAutocomplete
            id="place-street"
            value={street}
            onChange={(value) => {
              setStreet(value);
              clearFieldError('street');
            }}
            onAddressSelect={(address: AddressData) => {
              setStreet(address.streetAddress);
              if (address.apartment) setUnit(address.apartment);
              if (address.city) setCity(address.city);
              if (address.state) setState(address.state);
              if (address.zipCode) setZip(address.zipCode);
              setFieldErrors((current) => {
                const next = { ...current };
                delete next.street;
                if (address.city) delete next.city;
                if (address.state) delete next.state;
                if (address.zipCode) delete next.zip;
                return next;
              });
            }}
            placeholder={streetPlaceholder}
            disabled={saving}
            required
          />
        </FormField>
        <FormField label={t('unit')}>
          <Input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder={unitPlaceholder}
            disabled={saving}
          />
        </FormField>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FormField label={t('city')} required error={fieldErrors.city}>
            <Input
              value={city}
              onChange={(event) => {
                setCity(event.target.value);
                clearFieldError('city');
              }}
              placeholder={cityPlaceholder}
              disabled={saving}
              error={fieldErrors.city}
              required
            />
          </FormField>
          <FormField label={t('state')} required error={fieldErrors.state}>
            <Input
              value={state}
              onChange={(event) => {
                setState(event.target.value);
                clearFieldError('state');
              }}
              placeholder={statePlaceholder}
              maxLength={2}
              disabled={saving}
              error={fieldErrors.state}
              required
            />
          </FormField>
          <FormField label={t('zip')} required error={fieldErrors.zip}>
            <Input
              value={zip}
              onChange={(event) => {
                setZip(event.target.value);
                clearFieldError('zip');
              }}
              placeholder={zipPlaceholder}
              maxLength={10}
              disabled={saving}
              error={fieldErrors.zip}
              required
            />
          </FormField>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
      </form> : null}

      <ViewToggle
        currentView={listView}
        onViewChange={(view) => {
          setListView(view);
          setAdding(false);
        }}
        views={['list', 'map']}
        hideBackgroundToggle
        onAdd={() => setAdding((open) => !open)}
        addOpen={adding}
        addLabel={t('add')}
        showAddOnDesktop
      />
    </div>
  );
}
