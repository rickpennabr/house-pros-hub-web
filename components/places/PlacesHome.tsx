'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, Home, Building } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { PlaceCard, PlaceKind } from '@/lib/places/portal';

const KINDS: PlaceKind[] = ['house', 'business', 'building'];

function KindIcon({ kind }: { kind: PlaceKind }) {
  if (kind === 'business') return <Building2 className="w-5 h-5 text-red-600" />;
  if (kind === 'building') return <Building className="w-5 h-5 text-red-600" />;
  return <Home className="w-5 h-5 text-red-600" />;
}

export function PlacesHome() {
  const t = useTranslations('places');
  const tAccount = useTranslations('common.account');
  const locale = useLocale();
  const { isAuthenticated, isLoading } = useAuth();
  const [places, setPlaces] = useState<PlaceCard[]>([]);
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<PlaceKind>('house');
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

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

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/places', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name, street, city, state, zipCode: zip }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('saveFailed'));
      window.location.href = `/${locale}/places/${data.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return <div className="max-w-3xl mx-auto p-6 text-gray-500">{t('loading')}</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-3">{t('signIn')}</p>
        <Link href={`/${locale}/signin`} className="inline-block mt-4 text-red-600 font-medium">
          {tAccount('signIn')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-2 text-sm text-gray-700">{t('subtitle')}</p>
        {!emailConfirmed ? <p className="mt-2 text-sm text-red-600">{t('confirmEmail')}</p> : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {places.length === 0 ? <p className="text-sm text-gray-600">{t('empty')}</p> : null}

      <div className="grid gap-3">
        {places.map((place) => (
          <Link
            key={place.id}
            href={`/${locale}/places/${place.id}`}
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

      <form onSubmit={onSubmit} className="border-2 border-black rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">{t('add')}</h2>
        <FormField label={t('kind.house')}>
          <Select value={kind} onChange={(event) => setKind(event.target.value as PlaceKind)}>
            {KINDS.map((item) => (
              <option key={item} value={item}>
                {t(`kind.${item}`)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t('name')}>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </FormField>
        <FormField label={t('street')}>
          <Input value={street} onChange={(event) => setStreet(event.target.value)} />
        </FormField>
        <div className="grid grid-cols-3 gap-2">
          <FormField label={t('city')}>
            <Input value={city} onChange={(event) => setCity(event.target.value)} />
          </FormField>
          <FormField label={t('state')}>
            <Input value={state} onChange={(event) => setState(event.target.value)} maxLength={2} />
          </FormField>
          <FormField label={t('zip')}>
            <Input value={zip} onChange={(event) => setZip(event.target.value)} />
          </FormField>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
      </form>
    </div>
  );
}
