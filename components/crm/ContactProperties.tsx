'use client';

import { useEffect, useState } from 'react';
import { Building, Building2, Home } from 'lucide-react';
import type { ContactProperty } from '@/lib/places/contact-places';

function KindIcon({ kind }: { kind: ContactProperty['kind'] }) {
  if (kind === 'business') return <Building2 className="h-5 w-5 text-red-600" aria-hidden />;
  if (kind === 'building') return <Building className="h-5 w-5 text-red-600" aria-hidden />;
  return <Home className="h-5 w-5 text-red-600" aria-hidden />;
}

/**
 * The customer's houses on this contact: the My Places they shared with you in a chat or
 * approved for you. Each estimate and invoice picks one; the first is the default.
 */
export function ContactProperties({ customerId }: { customerId: string }) {
  const [loaded, setLoaded] = useState<{ customerId: string; properties: ContactProperty[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crm/customers/${encodeURIComponent(customerId)}/places`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { properties: [] }))
      .then((data: { properties?: ContactProperty[] }) => {
        if (!cancelled) setLoaded({ customerId, properties: Array.isArray(data.properties) ? data.properties : [] });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ customerId, properties: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const properties = loaded?.customerId === customerId ? loaded.properties : [];
  if (properties.length === 0) return null;

  return (
    <div className="mb-3 overflow-hidden rounded-lg border-2 border-black bg-white">
      <div className="border-b-2 border-black px-3 py-2">
        <p className="text-sm font-semibold text-black">
          Properties <span className="font-normal text-gray-500">· {properties.length}</span>
        </p>
        <p className="text-xs text-gray-500">Houses this customer shared with you on My Places. Pick one on each estimate or invoice.</p>
      </div>
      <ul className="grid grid-cols-1 gap-2 p-2 md:grid-cols-2">
        {properties.map((property) => (
          <li key={property.id} className="flex items-center gap-3 rounded-lg border-2 border-black p-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-gray-50">
              <KindIcon kind={property.kind} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-black">
                {property.name}
                {property.isDefault ? <span className="ml-2 text-xs font-normal text-gray-500">Default</span> : null}
              </span>
              <span className="block truncate text-xs text-gray-600">
                {[property.street, property.city, property.state, property.zipCode].filter(Boolean).join(', ')}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
