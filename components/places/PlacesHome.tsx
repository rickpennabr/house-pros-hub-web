'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, Home, Building, ClipboardList, MoreVertical, Share2 } from 'lucide-react';
import { BookProPicker } from '@/components/booking/BookProPicker';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { AddressPinsMap } from '@/components/maps/AddressPinsMap';
import ViewToggle, { type ViewType } from '@/components/pageslayout/ViewToggle';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';
import type { PendingPro, PlaceCard, PlaceKind } from '@/lib/places/portal';
import { PendingProsCard } from '@/components/places/PendingProsCard';
import { FileDropTarget } from '@/components/ui/FileDropTarget';

const KINDS: PlaceKind[] = ['house', 'business', 'building'];

function KindIcon({ kind }: { kind: PlaceKind }) {
  // Sized for the 64px card placeholder.
  if (kind === 'business') return <Building2 className="w-7 h-7 text-red-600" />;
  if (kind === 'building') return <Building className="w-7 h-7 text-red-600" />;
  return <Home className="w-7 h-7 text-red-600" />;
}

function placeAddress(place: PlaceCard): string {
  return [place.street, place.city, place.state, place.zipCode].filter(Boolean).join(', ');
}

/**
 * Until the person proves they own their email, no pro's records saved under it are shared
 * (someone could have signed up with another person's address).
 */
function VerifyEmailBanner({ locale }: { locale: string }) {
  const t = useTranslations('places');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const linkFailed = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('verified') === '0';

  async function send() {
    setState('sending');
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      setState(res.ok ? 'sent' : 'failed');
    } catch {
      setState('failed');
    }
  }

  return (
    <div className="mx-auto mt-2 max-w-2xl rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm text-red-700">
      <p>{linkFailed ? t('verifyLinkFailed') : t('confirmEmail')}</p>
      {state === 'sent' ? (
        <p className="mt-2 font-medium">{t('verifySent')}</p>
      ) : (
        <button
          type="button"
          onClick={() => void send()}
          disabled={state === 'sending'}
          className="mt-2 rounded-lg bg-black px-3 py-1.5 font-semibold text-white disabled:opacity-60"
        >
          {state === 'sending' ? '…' : t('verifySend')}
        </button>
      )}
      {state === 'failed' ? <p className="mt-1">{t('verifyFailed')}</p> : null}
    </div>
  );
}

export function PlacesHome() {
  const t = useTranslations('places');
  const tAccount = useTranslations('common.account');
  const locale = useLocale();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [listView, setListView] = useState<ViewType>('list');
  const [places, setPlaces] = useState<PlaceCard[]>([]);
  const [pendingPros, setPendingPros] = useState<PendingPro[]>([]);
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const [sharePlaceId, setSharePlaceId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoPreview = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile]);
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);
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
        setPendingPros(data.pendingPros ?? []);
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
      if (photoFile) {
        // The place is saved either way; a failed photo can be added again from its details page.
        const body = new FormData();
        body.append('file', photoFile);
        await fetch(`/api/places/${data.id}/photo`, { method: 'POST', credentials: 'include', body }).catch(() => null);
      }
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

  const noPlaces = places.length === 0 && !adding && listView !== 'map';

  return (
    <div className="px-2 pt-4 pb-28 space-y-3 md:px-4">
      <div className={noPlaces ? 'mt-[20px] flex flex-col items-center gap-4' : undefined}>
        <p className="mx-auto text-center text-xl font-bold text-black md:max-w-2xl md:text-balance">{t('subtitle')}</p>
        {noPlaces ? (
          <Button type="button" variant="primary" onClick={() => setAdding(true)}>{t('add')}</Button>
        ) : null}
        {!emailConfirmed ? <VerifyEmailBanner locale={locale} /> : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {adding || pendingPros.length === 0 ? null : <PendingProsCard pros={pendingPros} places={places} />}

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
      ) : places.length === 0 ? null : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {places.map((place) => (
            <div key={place.id} className="relative">
            <Link
              href={`/${locale}/myplaces/${place.id}`}
              className="border-2 border-black rounded-lg p-2 pr-11 flex items-center gap-3 hover:bg-gray-50"
            >
              <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-black bg-gray-50">
                {place.photoUrl ? (
                  // Property photo from public storage; changes when the owner replaces it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={place.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <KindIcon kind={place.kind} />
                  </span>
                )}
              </span>
              <span className="min-w-0">
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
            <button
              type="button"
              aria-label={t('cardMenu')}
              aria-expanded={cardMenuId === place.id}
              onClick={() => setCardMenuId((open) => (open === place.id ? null : place.id))}
              className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg border-2 border-transparent text-black hover:border-black"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {cardMenuId === place.id ? (
              <>
                <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setCardMenuId(null)} />
                <div className="absolute right-1.5 top-11 z-20 w-52 rounded-lg border-2 border-black bg-white p-2 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setCardMenuId(null);
                      router.push(`/${locale}/myplaces/${place.id}?view=request`);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium hover:bg-gray-100"
                  >
                    <ClipboardList className="h-4 w-4 text-red-600" />
                    {t('serviceRequest')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCardMenuId(null);
                      setSharePlaceId(place.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium hover:bg-gray-100"
                  >
                    <Share2 className="h-4 w-4 text-red-600" />
                    {t('shareWithPro')}
                  </button>
                </div>
              </>
            ) : null}
            </div>
          ))}
        </div>
      )}

      {adding ? <form onSubmit={onSubmit} className="border-2 border-black rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">{t('add')}</h2>
        <div className="flex items-center gap-3">
          <FileDropTarget inputRef={photoInputRef} className="shrink-0" rounded="rounded-xl">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={saving}
            aria-label={photoFile ? t('photoChange') : t('photoAdd')}
            className="relative h-[77px] w-[77px] shrink-0 overflow-hidden rounded-xl border-2 border-black bg-gray-50 disabled:opacity-60 md:h-28 md:w-28"
          >
            {photoPreview ? (
              // Local preview of the picked file (blob URL).
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <KindIcon kind={kind} />
              </span>
            )}
          </button>
          </FileDropTarget>
          <span className="text-sm text-gray-600">{photoFile ? t('photoChange') : t('photoAdd')}</span>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
          />
        </div>
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

      <BookProPicker
        open={Boolean(sharePlaceId)}
        onClose={() => setSharePlaceId(null)}
        title={t('shareWithPro')}
        onPick={(pro) => {
          const placeId = sharePlaceId;
          setSharePlaceId(null);
          if (!placeId) return;
          router.push(`/${locale}/probot?contact=${encodeURIComponent(pro.slug || pro.id)}&sharePlace=${placeId}`);
        }}
      />

      {places.length > 0 ? (
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
      ) : null}
    </div>
  );
}
