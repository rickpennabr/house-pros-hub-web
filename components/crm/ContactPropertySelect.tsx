'use client';

import { useEffect, useState } from 'react';
import { Select } from '@/components/ui/Select';
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
  }, [customerId]);

  const properties = loaded?.customerId === customerId ? loaded.properties : [];
  if (!customerId || properties.length === 0) return null;

  const defaultProperty = properties.find((property) => property.isDefault) ?? properties[0];
  const label = 'Property';
  const control =
    properties.length === 1 ? (
      <p className="py-2 text-sm text-gray-900">{propertyLine(properties[0])}</p>
    ) : (
      <Select
        value={value === defaultProperty.id ? '' : value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{`${propertyLine(defaultProperty)} (default)`}</option>
        {properties
          .filter((property) => property.id !== defaultProperty.id)
          .map((property) => (
            <option key={property.id} value={property.id}>
              {propertyLine(property)}
            </option>
          ))}
      </Select>
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
    <div className="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-x-4 gap-y-1">
      <label className="text-gray-600">{label}</label>
      {control}
    </div>
  );
}
