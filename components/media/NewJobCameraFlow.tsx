'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, LocateFixed, Search, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { useAddressSearch } from '@/components/AddressAutocomplete/hooks/useAddressSearch';
import type { GooglePlacesResult } from '@/components/AddressAutocomplete/utils/addressParser';
import { requestCurrentLocation } from '@/lib/media/capture-location';

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
const LAS_VEGAS = { lat: 36.1699, lng: -115.1398 };

export interface NewJobDraft {
  name: string;
  note: string;
  street: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  customerId: string | null;
}

interface Spot {
  street: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
}

export interface ProjectFromCustomer {
  id: string;
  name: string;
  street: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

interface NewJobCameraFlowProps {
  open: boolean;
  customers: { id: string; name: string }[];
  /** When set, this project is created for that customer and starts at their address. */
  customer?: ProjectFromCustomer | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onTakePhoto: (draft: NewJobDraft) => Promise<void>;
}

interface PlaceComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cityLine(spot: { city: string; state: string; zip: string }): string {
  return [spot.city, [spot.state, spot.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export function newJobAddress(draft: Pick<NewJobDraft, 'street' | 'line2' | 'city' | 'state' | 'zip'>): string {
  return [draft.street, draft.line2, cityLine(draft)].filter(Boolean).join(' · ');
}

function part(components: PlaceComponent[], type: string, short = false): string {
  const match = components.find((component) => component.types?.includes(type));
  if (!match) return '';
  return (short ? match.shortText : match.longText) || match.longText || '';
}

function spotFromParts(components: PlaceComponent[], latitude: number, longitude: number, fallbackStreet: string): Spot {
  const street = [part(components, 'street_number'), part(components, 'route')].filter(Boolean).join(' ') || fallbackStreet;
  return {
    street,
    line2: part(components, 'subpremise'),
    city: part(components, 'locality') || part(components, 'postal_town') || part(components, 'sublocality'),
    state: part(components, 'administrative_area_level_1', true),
    zip: part(components, 'postal_code'),
    latitude,
    longitude,
  };
}

async function placeSpot(placeId: string, fallbackStreet: string): Promise<Spot | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || !placeId) return null;
  const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'location,addressComponents',
    },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    location?: { latitude?: number; longitude?: number };
    addressComponents?: PlaceComponent[];
  };
  const latitude = body.location?.latitude;
  const longitude = body.location?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return spotFromParts(body.addressComponents ?? [], latitude, longitude, fallbackStreet);
}

async function addressAt(latitude: number, longitude: number): Promise<Pick<Spot, 'street' | 'line2' | 'city' | 'state' | 'zip'>> {
  const empty = { street: '', line2: '', city: '', state: '', zip: '' };
  try {
    const response = await fetch(
      `/api/geocode?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`,
      { credentials: 'include' }
    );
    if (!response.ok) return empty;
    const body = (await response.json()) as {
      address?: { street?: string; line2?: string; city?: string; state?: string; zip?: string } | null;
    };
    if (!body.address) return empty;
    return {
      street: body.address.street || '',
      line2: body.address.line2 || '',
      city: body.address.city || '',
      state: body.address.state || '',
      zip: body.address.zip || '',
    };
  } catch {
    return empty;
  }
}

async function geocodeSpot(query: string): Promise<Spot | null> {
  const response = await fetch(`/api/geocode?address=${encodeURIComponent(query)}`, { credentials: 'include' });
  if (!response.ok) return null;
  const body = (await response.json()) as { coordinates?: { latitude?: number; longitude?: number } | null };
  const latitude = body.coordinates?.latitude;
  const longitude = body.coordinates?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  const address = await addressAt(latitude, longitude);
  return {
    street: address.street || query.split(',')[0]?.trim() || query,
    line2: address.line2,
    city: address.city,
    state: address.state,
    zip: address.zip,
    latitude,
    longitude,
  };
}

function FlyTo({ target, token }: { target: { lat: number; lng: number } | null; token: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target || token === 0) return;
    map.panTo(target);
    if ((map.getZoom() ?? 0) < 16) map.setZoom(17);
  }, [map, target, token]);
  return null;
}

function WatchCenter({ onMove }: { onMove: (latitude: number, longitude: number) => void }) {
  const map = useMap();
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('idle', () => {
      const center = map.getCenter();
      if (!center) return;
      onMoveRef.current(center.lat(), center.lng());
    });
    return () => listener.remove();
  }, [map]);
  return null;
}

function FloatField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [focus, setFocus] = useState(false);
  const lifted = focus || value.length > 0;
  return (
    <label className="relative block rounded-2xl bg-white px-4 shadow-sm">
      <span className={`pointer-events-none absolute left-4 text-gray-400 transition-all ${lifted ? 'top-2 text-xs' : 'top-1/2 -translate-y-1/2 text-base'}`}>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        className={`w-full bg-transparent text-base text-black outline-none ${lifted ? 'pb-2 pt-6' : 'h-14'}`}
      />
    </label>
  );
}

/**
 * Pick a job address on the map, confirm it, then open the camera from the project form.
 */
export function NewJobCameraFlow({ open, customers, customer = null, saving, error, onClose, onTakePhoto }: NewJobCameraFlowProps) {
  const t = useTranslations('jobsite');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const [phase, setPhase] = useState<'map' | 'details'>('map');
  const [query, setQuery] = useState('');
  const [spot, setSpot] = useState<Spot | null>(null);
  const [locating, setLocating] = useState(false);
  const [fly, setFly] = useState<{ lat: number; lng: number } | null>(null);
  const [flyToken, setFlyToken] = useState(0);
  const [mapFailed, setMapFailed] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [street, setStreet] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const spotRef = useRef<Spot | null>(null);
  const lookupTimer = useRef<number | null>(null);
  const lookupGen = useRef(0);
  spotRef.current = spot;
  const { suggestions, searchAddresses, clearSuggestions, searchError } = useAddressSearch();

  const flyTo = (next: Spot) => {
    lookupGen.current += 1;
    if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    setSpot(next);
    setFly({ lat: next.latitude, lng: next.longitude });
    setFlyToken((token) => token + 1);
  };

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setPhase('map');
    setSpot(null);
    setQuery('');
    setProjectName(customer?.street || customer?.name || '');
    setDescription('');
    setStreet(customer?.street ?? '');
    setLine2(customer?.line2 ?? '');
    setCity(customer?.city ?? '');
    setState(customer?.state ?? '');
    setZip(customer?.zip ?? '');
    setCustomerId(customer?.id ?? '');
    setCustomerOpen(false);
    setLocating(true);
    let cancelled = false;
    const presetQuery = customer
      ? [customer.street, customer.city, customer.state, customer.zip].filter(Boolean).join(', ')
      : '';
    if (presetQuery.length >= 5) {
      void geocodeSpot(presetQuery).then((found) => {
        if (cancelled) return;
        if (found) flyTo(found);
        setLocating(false);
      });
    } else {
      void requestCurrentLocation().then(async (location) => {
        if (cancelled) return;
        const latitude = location?.latitude ?? LAS_VEGAS.lat;
        const longitude = location?.longitude ?? LAS_VEGAS.lng;
        const address = await addressAt(latitude, longitude);
        if (cancelled) return;
        flyTo({ ...address, latitude, longitude });
        setLocating(false);
      });
    }
    return () => {
      cancelled = true;
      document.body.style.overflow = previous;
      if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    };
  }, [open, customer]);

  const lookupCenter = (latitude: number, longitude: number) => {
    const current = spotRef.current;
    if (current && metersBetween({ lat: current.latitude, lng: current.longitude }, { lat: latitude, lng: longitude }) < 40) {
      return;
    }
    if (lookupTimer.current) window.clearTimeout(lookupTimer.current);
    const gen = lookupGen.current + 1;
    lookupGen.current = gen;
    lookupTimer.current = window.setTimeout(() => {
      setLocating(true);
      void addressAt(latitude, longitude).then((address) => {
        if (lookupGen.current !== gen) return;
        setSpot({ ...address, latitude, longitude });
        setLocating(false);
      });
    }, 800);
  };

  const chooseQuery = async (text: string, placeId?: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    setQuery(trimmed);
    clearSuggestions();
    setLocating(true);
    const found = (placeId ? await placeSpot(placeId, trimmed.split(',')[0] || trimmed) : null) ?? await geocodeSpot(trimmed);
    setLocating(false);
    if (found) flyTo(found);
  };

  const confirmPlace = () => {
    if (!spot) return;
    setStreet(spot.street);
    setLine2(spot.line2);
    setCity(spot.city);
    setState(spot.state);
    setZip(spot.zip);
    setPhase('details');
  };

  const takePhoto = () => {
    void onTakePhoto({
      name: projectName,
      note: description,
      street,
      line2,
      city,
      state,
      zip,
      latitude: spot?.latitude ?? null,
      longitude: spot?.longitude ?? null,
      customerId: customerId || null,
    });
  };

  if (!open || typeof document === 'undefined') return null;

  const chosenCustomer = customers.find((customer) => customer.id === customerId);
  const coords = spot ? `${spot.latitude.toFixed(6)}, ${spot.longitude.toFixed(6)}` : '';

  const pinLabel = spot?.street || (spot ? cityLine(spot) : '');

  const mapScreen = (
    <div className="relative h-full w-full bg-gray-200">
      {apiKey && !mapFailed ? (
        <APIProvider apiKey={apiKey} onError={() => setMapFailed(true)}>
          <Map
            defaultCenter={LAS_VEGAS}
            defaultZoom={16}
            gestureHandling="greedy"
            disableDefaultUI
            clickableIcons={false}
            mapId={MAP_ID}
            style={{ width: '100%', height: '100%' }}
          >
            <FlyTo target={fly} token={flyToken} />
            <WatchCenter onMove={lookupCenter} />
          </Map>
        </APIProvider>
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-600">{t('mapUnavailable')}</div>
      )}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center">
        {pinLabel ? (
          <span className="mb-1 max-w-[240px] truncate rounded-full border-2 border-black bg-white px-3 py-1 text-xs font-bold text-black shadow">
            {pinLabel}
          </span>
        ) : null}
        <span className="relative block" style={{ width: 56, height: Math.round(56 * (252 / 256)) }}>
          <span
            className="absolute flex items-center justify-center bg-white text-lg font-bold leading-none text-black"
            style={{ left: '9%', top: '39%', width: '82%', height: '51.5%' }}
          >
            +
          </span>
          <img src="/map-pin-house.png" alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
        </span>
      </div>
      <div className="absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white shadow"
          aria-label={t('goBack')}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              searchAddresses(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void chooseQuery(query);
              }
            }}
            placeholder={t('typeAddress')}
            aria-label={t('typeAddress')}
            className="h-11 w-full rounded-full bg-white pl-10 pr-4 text-base shadow outline-none"
          />
          {(suggestions.length > 0 || searchError) && (
            <div className="mt-2 max-h-60 overflow-y-auto rounded-2xl bg-white shadow-lg">
              {searchError ? <p className="px-4 py-3 text-sm text-gray-600">{searchError}</p> : null}
              {suggestions.map((item: GooglePlacesResult) => (
                <button
                  key={item.place_id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => { void chooseQuery(item.description, item.place_id); }}
                  className="block w-full cursor-pointer border-b border-gray-100 px-4 py-3 text-left last:border-0"
                >
                  <span className="block text-sm font-medium">{item.structured_formatting?.main_text || item.description}</span>
                  {item.structured_formatting?.secondary_text ? (
                    <span className="block truncate text-xs text-gray-500">{item.structured_formatting.secondary_text}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => {
            void requestCurrentLocation().then(async (location) => {
              if (!location) return;
              const address = await addressAt(location.latitude, location.longitude);
              flyTo({
                street: address.street || spot?.street || '',
                line2: address.line2,
                city: address.city,
                state: address.state,
                zip: address.zip,
                latitude: location.latitude,
                longitude: location.longitude,
              });
            });
          }}
          className="mb-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white shadow"
          aria-label={t('locationSetting')}
        >
          <LocateFixed className="h-5 w-5" />
        </button>
        <div className="rounded-2xl bg-white p-4 shadow-xl">
          <p className="text-lg font-bold text-black">{pinLabel || (locating ? t('locatingAddress') : t('typeAddress'))}</p>
          {spot?.street && cityLine(spot) ? <p className="text-gray-700">{cityLine(spot)}</p> : null}
          {coords ? <p className="mt-1 text-sm text-gray-500">{coords}</p> : null}
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={onClose} className="h-12 flex-1 cursor-pointer rounded-xl bg-gray-200 font-semibold text-gray-700">
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={confirmPlace}
              disabled={!spot}
              className="h-12 flex-1 cursor-pointer rounded-xl bg-blue-600 font-semibold text-white disabled:opacity-40"
            >
              {t('confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const detailsScreen = (
    <div className="flex h-full flex-col bg-gray-100">
      <div className="flex items-center gap-3 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => setPhase('map')} className="flex h-10 w-10 cursor-pointer items-center justify-center" aria-label={t('goBack')}>
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h2 className="flex-1 text-center text-lg font-bold">{t('enterProjectDetails')}</h2>
        <span className="w-10" />
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        <FloatField label={t('projectName')} value={projectName} onChange={setProjectName} />
        <FloatField label={t('addressLine1')} value={street} onChange={setStreet} />
        <FloatField label={t('addressLine2')} value={line2} onChange={setLine2} />
        <div className="grid grid-cols-[1fr_5rem_6rem] gap-3">
          <FloatField label={t('cityLabel')} value={city} onChange={setCity} />
          <FloatField label={t('stateLabel')} value={state} onChange={setState} />
          <FloatField label={t('zipCode')} value={zip} onChange={setZip} />
        </div>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t('projectDescription')}
          rows={5}
          className="w-full resize-none rounded-2xl bg-white px-4 py-4 text-base shadow-sm outline-none placeholder:text-gray-400"
        />
        <button
          type="button"
          onClick={() => setCustomerOpen(true)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-4 text-left shadow-sm"
        >
          <UserRound className="h-5 w-5 text-gray-700" />
          <span>
            <span className="block font-medium">{t('addCustomerInfo')}</span>
            {chosenCustomer ? <span className="block text-sm text-gray-500">{chosenCustomer.name}</span> : null}
          </span>
        </button>
      </div>
      <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <button
          type="button"
          onClick={takePhoto}
          disabled={saving || !street.trim()}
          className="h-14 w-full cursor-pointer rounded-full bg-neutral-900 text-base font-semibold text-white disabled:opacity-40"
        >
          {saving ? t('creatingProject') : t('takePhotoHere')}
        </button>
      </div>
      {customerOpen ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/40" onClick={() => setCustomerOpen(false)}>
          <div className="max-h-[70%] overflow-y-auto rounded-t-3xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
            <p className="mb-3 font-bold">{t('addCustomerInfo')}</p>
            <button
              type="button"
              onClick={() => { setCustomerId(''); setCustomerOpen(false); }}
              className="mb-2 w-full cursor-pointer rounded-xl border border-gray-200 px-4 py-3 text-left"
            >
              {t('customerFromAddress')}
            </button>
            {customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => { setCustomerId(customer.id); setCustomerOpen(false); }}
                className="block w-full cursor-pointer border-t border-gray-100 px-4 py-3 text-left"
              >
                {customer.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[115] flex justify-center bg-black/50 md:items-center md:p-2">
      <div className="relative h-full w-full max-w-[960px] overflow-hidden bg-white md:h-[calc(100dvh-1rem)] md:rounded-lg md:border-2 md:border-black">
        {phase === 'map' ? mapScreen : detailsScreen}
      </div>
    </div>,
    document.body
  );
}
