'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, AdvancedMarker, InfoWindow, Map, useMap } from '@vis.gl/react-google-maps';

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
const LAS_VEGAS = { lat: 36.1699, lng: -115.1398 };

export interface AddressPin {
  id: string;
  title: string;
  detail?: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface LocatedPin extends AddressPin {
  position: google.maps.LatLngLiteral;
}

const geocodeCache = new globalThis.Map<string, google.maps.LatLngLiteral | null>();

async function geocodeAddress(address: string): Promise<google.maps.LatLngLiteral | null> {
  const key = address.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null;
  try {
    const response = await fetch(`/api/geocode?address=${encodeURIComponent(address.trim())}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { coordinates?: { latitude?: number; longitude?: number } | null };
    const latitude = body.coordinates?.latitude;
    const longitude = body.coordinates?.longitude;
    const position = typeof latitude === 'number' && typeof longitude === 'number' ? { lat: latitude, lng: longitude } : null;
    geocodeCache.set(key, position);
    return position;
  } catch {
    return null;
  }
}

async function locate(pin: AddressPin): Promise<LocatedPin | null> {
  if (typeof pin.latitude === 'number' && typeof pin.longitude === 'number') {
    return { ...pin, position: { lat: pin.latitude, lng: pin.longitude } };
  }
  if (!pin.address.trim()) return null;
  const position = await geocodeAddress(pin.address);
  return position ? { ...pin, position } : null;
}

function FitPins({ pins }: { pins: LocatedPin[] }) {
  const map = useMap();
  const key = pins.map((pin) => pin.id).join(',');

  useEffect(() => {
    if (!map || pins.length === 0) return;
    if (pins.length === 1) {
      map.setCenter(pins[0].position);
      map.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    pins.forEach((pin) => bounds.extend(pin.position));
    map.fitBounds(bounds, 48);
  }, [map, key, pins]);

  return null;
}

function PinMarker({ title, selected }: { title: string; selected: boolean }) {
  const letter = (title.trim().charAt(0) || '•').toUpperCase();
  const width = selected ? 56 : 44;
  return (
    <div className="relative block" style={{ width, height: Math.round(width * (252 / 256)) }}>
      <span
        className="absolute flex items-center justify-center bg-white font-bold text-black"
        style={{ left: '9%', top: '39%', width: '82%', height: '51.5%', fontSize: Math.round(width * 0.34) }}
      >
        {letter}
      </span>
      <img src="/map-pin-house.png" alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

function MapCanvas({
  pins,
  onOpen,
}: {
  pins: AddressPin[];
  onOpen?: (id: string) => void;
}) {
  const [located, setLocated] = useState<LocatedPin[]>([]);
  const [pending, setPending] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pinClick = useRef(false);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const pinKey = useMemo(
    () => pins.map((pin) => `${pin.id}|${pin.address}|${pin.latitude ?? ''}|${pin.longitude ?? ''}`).join('\n'),
    [pins]
  );

  useEffect(() => {
    let cancelled = false;
    setPending(true);
    const queue = pinsRef.current.filter((pin) => pin.address.trim() || (pin.latitude != null && pin.longitude != null));
    let cursor = 0;
    const found: LocatedPin[] = [];

    async function worker() {
      while (cursor < queue.length && !cancelled) {
        const pin = queue[cursor];
        cursor += 1;
        const placed = await locate(pin);
        if (placed) found.push(placed);
      }
    }

    void Promise.all(Array.from({ length: Math.min(4, queue.length) }, () => worker())).then(() => {
      if (cancelled) return;
      setLocated(found);
      setPending(false);
    });

    return () => {
      cancelled = true;
    };
  }, [pinKey]);

  const selected = located.find((pin) => pin.id === selectedId) ?? null;

  return (
    <>
      {pending && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
          <p className="text-sm text-gray-600">Placing addresses…</p>
        </div>
      )}
      {!pending && located.length === 0 && (
        <div className="absolute inset-x-4 top-4 z-10 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm text-black">
          None of these rows have an address that can be placed on the map.
        </div>
      )}
      <Map
        mapId={MAP_ID}
        style={{ width: '100%', height: '100%' }}
        defaultCenter={LAS_VEGAS}
        defaultZoom={11}
        gestureHandling="greedy"
        disableDefaultUI={false}
        onClick={() => {
          if (pinClick.current) {
            pinClick.current = false;
            return;
          }
          setSelectedId(null);
        }}
      >
        <FitPins pins={located} />
        {located.map((pin) => (
          <AdvancedMarker
            key={pin.id}
            position={pin.position}
            title={pin.title}
            zIndex={pin.id === selectedId ? 500 : 1}
            onClick={() => {
              pinClick.current = true;
              setSelectedId((current) => (current === pin.id ? null : pin.id));
            }}
          >
            <PinMarker title={pin.title} selected={pin.id === selectedId} />
          </AdvancedMarker>
        ))}
        {selected && (
          <InfoWindow position={selected.position} pixelOffset={[0, -64]} headerDisabled onCloseClick={() => setSelectedId(null)}>
            <div className="max-w-[240px] p-1 text-black">
              <p className="font-bold">{selected.title}</p>
              {selected.detail ? <p className="mt-1 text-sm text-gray-700">{selected.detail}</p> : null}
              {selected.address ? <p className="mt-1 text-sm">{selected.address}</p> : null}
              {onOpen ? (
                <button
                  type="button"
                  className="mt-2 text-sm font-semibold underline"
                  onClick={() => onOpen(selected.id)}
                >
                  Open
                </button>
              ) : null}
            </div>
          </InfoWindow>
        )}
      </Map>
    </>
  );
}

interface AddressPinsMapProps {
  pins: AddressPin[];
  onOpen?: (id: string) => void;
  className?: string;
}

export function AddressPinsMap({ pins, onOpen, className = 'h-[min(70vh,640px)]' }: AddressPinsMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!apiKey || failed) {
    return (
      <div className={`flex items-center justify-center border-2 border-black bg-gray-50 ${className}`}>
        <p className="px-4 text-center text-sm text-gray-600">The map could not load.</p>
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden border-2 border-black ${className}`}>
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50">
          <p className="text-sm text-gray-600">Loading map…</p>
        </div>
      )}
      <APIProvider apiKey={apiKey} libraries={['marker']} onLoad={() => setReady(true)} onError={() => setFailed(true)}>
        {ready ? <MapCanvas pins={pins} onOpen={onOpen} /> : <div className="h-full w-full" />}
      </APIProvider>
    </div>
  );
}
