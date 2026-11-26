'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { ContactProperty } from '@/lib/places/contact-places';

function propertyLine(property: ContactProperty): string {
  const where = [property.street, property.city].filter(Boolean).join(', ');
  return where ? `${property.name} · ${where}` : property.name;
}

interface ContactPropertySelectProps {
  customerId: string;
  /** The house this document is for. Empty means the contact's default house. */
  value: string;
  onChange: (placeId: string) => void;
  disabled?: boolean;
  /** 'row' matches the estimate form (label beside); 'stacked' matches the invoice form. */
  variant?: 'row' | 'stacked';
  /**
   * Called once the contact's houses load. Lets the chat pick the house the customer shared there.
   * Return a place id to select it, or nothing to keep the value.
   */
  onLoaded?: (properties: ContactProperty[]) => string | void;
  /** Change it to load the contact's properties again (e.g. after adding one). */
  reloadKey?: number;
}

/**
 * Which of the customer's houses (My Places they shared with this pro) the estimate or invoice is
 * for. Hidden when the contact has none; read-only text when there is one.
 */
export function ContactPropertySelect({
  customerId,
  value,
  onChange,
  disabled = false,
  variant = 'row',
  onLoaded,
  reloadKey = 0,
}: ContactPropertySelectProps) {
  const [loaded, setLoaded] = useState<{ customerId: string; properties: ContactProperty[] } | null>(null);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    fetch(`/api/crm/customers/${encodeURIComponent(customerId)}/places`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { properties: [] }))
      .then((data: { properties?: ContactProperty[] }) => {
        if (cancelled) return;
        const properties = Array.isArray(data.properties) ? data.properties : [];
        setLoaded({ customerId, properties });
        const picked = onLoaded?.(properties);
        if (typeof picked === 'string') {
          // The default house is the empty value.
          const defaultId = (properties.find((property) => property.isDefault) ?? properties[0])?.id;
          onChange(picked === defaultId ? '' : picked);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded({ customerId, properties: [] });
      });
    return () => {
      cancelled = true;
    };
    // Load once per customer; onLoaded / onChange are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, reloadKey]);

  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const properties = loaded?.customerId === customerId ? loaded.properties : [];
  if (!customerId || properties.length === 0) return null;

  const defaultProperty = properties.find((property) => property.isDefault) ?? properties[0];
  const label = 'Property';
  const control =
    properties.length === 1 ? (
      <p className="py-2 text-sm text-gray-900">{propertyLine(properties[0])}</p>
    ) : (
      // The Hub's own list (not the browser's): it stays inside the screen and long addresses wrap.
      <div ref={boxRef} className="relative w-full min-w-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border-2 border-black bg-white py-2 pl-2 pr-2 text-left text-black disabled:opacity-50 md:pl-3 md:pr-3"
        >
          <span className="min-w-0 truncate">
            {(() => {
              const current = properties.find((property) => property.id === value) ?? defaultProperty;
              return `${propertyLine(current)}${current.id === defaultProperty.id ? ' (default)' : ''}`;
            })()}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {open ? (
          <ul role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border-2 border-black bg-white shadow-lg">
            {[defaultProperty, ...properties.filter((property) => property.id !== defaultProperty.id)].map((property) => {
              const isDefault = property.id === defaultProperty.id;
              const selected = isDefault ? !value || value === defaultProperty.id : value === property.id;
              return (
                <li key={property.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(isDefault ? '' : property.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-gray-50 ${selected ? 'bg-gray-100' : ''}`}
                  >
                    <span className="min-w-0 flex-1 break-words">
                      <span className="block font-medium text-gray-900">{property.name}{isDefault ? ' (default)' : ''}</span>
                      <span className="block text-xs text-gray-600">{[property.street, property.city].filter(Boolean).join(', ')}</span>
                    </span>
                    {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    );

  if (variant === 'stacked') {
    return (
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</label>
        {control}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-y-1">
      <label className="text-gray-600">{label}</label>
      {control}
    </div>
  );
}
