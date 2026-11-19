'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PortalPropertyHistory, type PropertyHistory } from '@/components/crm/PortalPropertyHistory';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { HubCustomerImport } from '@/components/crm/HubCustomerImport';

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  company_name: string | null;
  email: string | null;
  street_address: string | null;
  city: string | null;
  portal_kind: 'house' | 'business' | 'building' | null;
  portal_user_id: string | null;
}

/**
 * Read-only record of what was done for a customer, one property at a time: charges, invoices,
 * estimates, maintenance, projects and files. Records are added in their own CRM pages.
 */
export default function CustomerPortalPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const locale = (useParams()?.locale as string) || 'en';
  /** The property picked for this customer; empty is their default house. */
  const [placeId, setPlaceId] = useState('');
  const [history, setHistory] = useState<{ key: string; data: PropertyHistory } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/crm/portal', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load the portal');
    setCustomers(data.customers ?? []);
    setCustomerId((current) => current || data.customers?.[0]?.id || '');
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load the portal'));
  }, [load]);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    const key = `${customerId}:${placeId}`;
    const query = new URLSearchParams({ customerId });
    if (placeId) query.set('placeId', placeId);
    fetch(`/api/crm/portal/property?${query}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load this property');
        if (!cancelled) setHistory({ key, data });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this property');
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, placeId]);

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    setPlaceId('');
  };

  const customer = customers.find((row) => row.id === customerId) ?? null;
  const propertyData = history?.key === `${customerId}:${placeId}` ? history.data : null;
  // Keep the picker steady while another property of the same customer loads.
  const properties = history?.key.startsWith(`${customerId}:`) ? history.data.properties : [];
  const property =
    properties.find((row) => row.id === placeId) ?? properties.find((row) => row.isDefault) ?? properties[0] ?? null;

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customer portal</h1>
        <p className="text-sm text-gray-700 mt-1">
          Everything done for a customer, one property at a time: charges, invoices, estimates, maintenance, projects
          and files.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <FormField label="Customer">
        <Select value={customerId} onChange={(event) => pickCustomer(event.target.value)}>
          {customers.length === 0 ? <option value="">No customers yet</option> : null}
          {customers.map((row) => (
            <option key={row.id} value={row.id}>
              {contactDisplayName(row)}
              {row.company_name ? ` · ${row.company_name}` : ''}
            </option>
          ))}
        </Select>
        <HubCustomerImport
          onImported={async (imported) => {
            try {
              await load();
              pickCustomer(imported.id);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not refresh customers');
            }
          }}
        />
      </FormField>

      {customer && properties.length > 1 ? (
        <FormField label={`Property (${properties.length})`}>
          <Select value={property?.id ?? ''} onChange={(event) => setPlaceId(event.target.value)}>
            {properties.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {[row.street, row.city].filter(Boolean).length ? ` · ${[row.street, row.city].filter(Boolean).join(', ')}` : ''}
                {row.isDefault ? ' (default)' : ''}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}

      {customer ? (
        <div className="border-2 border-black rounded-lg p-4 space-y-1 text-sm">
          <p className="font-medium">
            {property
              ? [property.name, property.street, property.city].filter(Boolean).join(', ')
              : [customer.street_address, customer.city].filter(Boolean).join(', ') || 'No street on the customer yet.'}
          </p>
          <p className="text-xs text-gray-600">
            {customer.email ? customer.email : 'No email on this customer.'}
            {customer.portal_user_id ? ' · Linked to their account.' : ' · Waiting for them to sign in with that email.'}
          </p>
        </div>
      ) : null}

      {customer && propertyData ? <PortalPropertyHistory data={propertyData} locale={locale} /> : null}
    </div>
  );
}
