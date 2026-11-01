'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Globe, MapPin, Phone } from 'lucide-react'
import { APIProvider, AdvancedMarker, InfoWindow, Map, useMap } from '@vis.gl/react-google-maps'
import type { Supplier } from './SupplierCard'

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

const LAS_VEGAS_BOUNDS = {
  north: 36.32,
  south: 35.95,
  east: -114.95,
  west: -115.4,
}

interface SuppliersMapProps {
  apiKey: string
  suppliers: Supplier[]
  selectedId: number | null
  hoveredId: number | null
  onSelect: (id: number | null) => void
  onHover: (id: number) => void
  onHoverEnd: (id: number) => void
  onError: () => void
}

function SupplierMapPin({
  name,
  logo,
  selected,
  lifted,
}: {
  name: string
  logo?: string
  selected: boolean
  lifted: boolean
}) {
  const [logoFailed, setLogoFailed] = useState(false)
  const showLogo = Boolean(logo) && !logoFailed
  const letter = (name.trim().charAt(0) || 'S').toUpperCase()
  const width = selected ? 68 : 52
  const height = Math.round(width * (252 / 256))
  const lift = 16

  return (
    <div data-supplier-pin="" aria-hidden="true" className="relative block" style={{ paddingTop: lift }}>
      <div
        className="relative block"
        style={{
          width,
          height,
          transform: lifted ? `translateY(-${lift}px)` : 'translateY(0)',
          transition: 'transform 180ms ease',
          filter: lifted
            ? 'drop-shadow(0 8px 6px rgba(0,0,0,0.45))'
            : selected
              ? 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))'
              : 'drop-shadow(0 1px 1px rgba(0,0,0,0.35))',
        }}
      >
      <span
        className="absolute flex items-center justify-center overflow-hidden bg-white"
        style={{ left: '9%', top: '39%', width: '82%', height: '51.5%' }}
      >
        {showLogo ? (
          <img
            src={logo}
            alt=""
            onError={() => setLogoFailed(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <span
            className="font-bold leading-none text-neutral-900"
            style={{ fontSize: Math.round(width * 0.34) }}
          >
            {letter}
          </span>
        )}
      </span>
      <img
        src="/map-pin-house.png"
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      </div>
    </div>
  )
}

function SupplierInfo({ supplier }: { supplier: Supplier }) {
  const website = supplier.website.trim()
  const websiteHref = website
    ? website.startsWith('http')
      ? website
      : `https://${website}`
    : ''

  return (
    <div className="max-w-[260px] p-1 text-black">
      <div className="mb-2 flex items-center gap-2">
        {supplier.logo ? (
          <img src={supplier.logo} alt="" className="h-10 w-10 shrink-0 object-contain" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
            {supplier.name.trim().charAt(0).toUpperCase() || 'S'}
          </span>
        )}
        <h3 className="text-base font-bold leading-tight">{supplier.name}</h3>
      </div>
      {supplier.address ? <p className="text-sm">{supplier.address}</p> : null}
      {supplier.phone ? <p className="mt-1 text-sm">{supplier.phone}</p> : null}
      {supplier.materials.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {supplier.materials.map((material) => (
            <span key={material} className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
              {material}
            </span>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex justify-end gap-3 border-t border-gray-200 pt-2">
        {supplier.phone ? (
          <a href={`tel:${supplier.phone}`} className="text-red-600" title="Call">
            <Phone size={18} />
          </a>
        ) : null}
        {supplier.address ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supplier.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-600"
            title="Directions"
          >
            <MapPin size={18} />
          </a>
        ) : null}
        {websiteHref ? (
          <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="text-red-600" title="Website">
            <Globe size={18} />
          </a>
        ) : null}
      </div>
    </div>
  )
}

function FitPins({ suppliers }: { suppliers: Supplier[] }) {
  const map = useMap()
  const pinKey = suppliers
    .filter((supplier) => supplier.coordinates)
    .map((supplier) => supplier.id)
    .join(',')

  useEffect(() => {
    if (!map || !pinKey) return
    const bounds = new google.maps.LatLngBounds()
    for (const supplier of suppliers) {
      if (supplier.coordinates) bounds.extend(supplier.coordinates)
    }
    if (bounds.isEmpty()) return
    map.setOptions({ maxZoom: 13 })
    map.fitBounds(bounds, 48)
    const listener = map.addListener('idle', () => {
      map.setOptions({ maxZoom: undefined })
      listener.remove()
    })
    return () => listener.remove()
  }, [map, pinKey, suppliers])

  return null
}

function FocusSupplier({ supplier }: { supplier: Supplier | null }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !supplier?.coordinates) return
    map.panTo(supplier.coordinates)
    const zoom = map.getZoom() ?? 0
    if (zoom < 13) map.setZoom(13)
  }, [map, supplier])

  return null
}

export default function SuppliersMap({
  apiKey,
  suppliers,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onHoverEnd,
  onError,
}: SuppliersMapProps) {
  const [ready, setReady] = useState(false)
  const pinClick = useRef(false)
  const pins = useMemo(
    () => suppliers.filter((supplier) => supplier.coordinates),
    [suppliers],
  )
  const selected = useMemo(
    () => pins.find((supplier) => supplier.id === selectedId) ?? null,
    [pins, selectedId],
  )

  return (
    <div className="relative h-full w-full">
      {!ready ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center border-2 border-black bg-gray-50">
          <p className="text-gray-600">Loading Map...</p>
        </div>
      ) : null}
      <APIProvider apiKey={apiKey} libraries={['marker']} onLoad={() => setReady(true)} onError={onError}>
        <Map
          mapId={MAP_ID}
          style={{ width: '100%', height: '100%' }}
          defaultBounds={LAS_VEGAS_BOUNDS}
          gestureHandling="greedy"
          disableDefaultUI={false}
          onClick={(event) => {
            if (pinClick.current) {
              pinClick.current = false
              return
            }
            const target = event.domEvent?.target
            if (target instanceof Element && target.closest('[data-supplier-pin], .gm-style-iw')) return
            onSelect(null)
          }}
        >
          <FitPins suppliers={pins} />
          <FocusSupplier supplier={selected} />
          {pins.map((supplier) => {
            const selected = supplier.id === selectedId
            const lifted = supplier.id === hoveredId
            return (
              <AdvancedMarker
                key={supplier.id}
                position={supplier.coordinates!}
                title={supplier.name}
                zIndex={lifted ? 600 : selected ? 500 : 1}
                onClick={() => {
                  pinClick.current = true
                  onSelect(selected ? null : supplier.id)
                }}
                onMouseEnter={() => onHover(supplier.id)}
                onMouseLeave={() => onHoverEnd(supplier.id)}
              >
                <SupplierMapPin
                  name={supplier.name}
                  logo={supplier.logo}
                  selected={selected}
                  lifted={lifted}
                />
              </AdvancedMarker>
            )
          })}
          {selected?.coordinates ? (
            <InfoWindow
              position={selected.coordinates}
              pixelOffset={[0, -72]}
              headerDisabled
              onCloseClick={() => onSelect(null)}
            >
              <SupplierInfo supplier={selected} />
            </InfoWindow>
          ) : null}
        </Map>
      </APIProvider>
    </div>
  )
}
