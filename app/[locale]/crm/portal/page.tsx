'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PortalPropertyHistory, type PropertyHistory } from '@/components/crm/PortalPropertyHistory';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Building, Building2, Home, User } from 'lucide-react';
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
    // ?customerId= from a contact's "Go to portal" opens on that customer.
    const requested = new URLSearchParams(window.location.search).get('customerId');
    const list: CustomerRow[] = data.customers ?? [];
    const fromLink = requested && list.some((row) => row.id === requested) ? requested : '';
    setCustomerId((current) => current || fromLink || list[0]?.id || '');
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
    <div className="p-4 md:p-6 max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Customer portal</h1>
        <p className="text-sm text-gray-700 mt-1">
          Everything done for a customer, one property at a time: charges, invoices, estimates, maintenance, projects
          and files.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <FormField
        label={
          <span className="inline-flex items-center gap-1.5">
            <User className="h-4 w-4 text-red-600" aria-hidden />
            Customer
          </span>
        }
      >
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
        <FormField
          label={
            <span className="inline-flex items-center gap-1.5">
              <Home className="h-4 w-4 text-red-600" aria-hidden />
              {`Property (${properties.length})`}
            </span>
          }
        >
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
        <div className="flex items-center gap-3">
          {/* Same header as the customer's My Places page: kind tile, name, address. */}
          <span className="flex h-[77px] w-[77px] shrink-0 items-center justify-center rounded-xl border-2 border-black bg-gray-50 text-red-600 md:h-28 md:w-28">
            {(property?.kind ?? customer.portal_kind) === 'business' ? (
              <Building2 className="h-8 w-8" aria-hidden />
            ) : (property?.kind ?? customer.portal_kind) === 'building' ? (
              <Building className="h-8 w-8" aria-hidden />
            ) : (
              <Home className="h-8 w-8" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="hidden text-xs uppercase tracking-wide text-gray-500 md:block">
              {contactDisplayName(customer)}
              {customer.company_name ? ` · ${customer.company_name}` : ''}
            </p>
            <h2 className="text-[18.4px] font-semibold leading-tight md:text-2xl">
              {property?.name || contactDisplayName(customer)}
            </h2>
            {(() => {
              const street = (property ? property.street : customer.street_address)?.trim() || '';
              const locality = property
                ? [property.city, property.state, property.zipCode].filter(Boolean).join(', ')
                : customer.city?.trim() || '';
              return street || locality ? (
                <p className="text-sm text-gray-700">
                  {street ? <span className="block">{street}</span> : null}
                  {locality ? <span className="block">{locality}</span> : null}
                </p>
              ) : (
                <p className="text-sm text-gray-700">No street on the customer yet.</p>
              );
            })()}
            <p className="mt-1 text-xs text-gray-500">
              {customer.email ? customer.email : 'No email on this customer.'}
              {customer.portal_user_id ? ' · Linked to their account' : ' · Waiting for them to sign in with that email'}
            </p>
          </div>
        </div>
      ) : null}

      {customer && propertyData ? <PortalPropertyHistory data={propertyData} locale={locale} customerId={customerId} /> : null}
    </div>
  );
}
