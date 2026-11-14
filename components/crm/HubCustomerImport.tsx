'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface HubCustomerOption {
  id: string;
  first_name: string;
  last_name: string;
  display_name?: string | null;
  company_name?: string | null;
}

interface HubCustomerImportProps {
  onImported: (customer: HubCustomerOption) => void;
  disabled?: boolean;
}

/**
 * Copies a hub customer's own contact details into this pro's contacts.
 * The pro types the email the customer uses to sign in.
 */
export function HubCustomerImport({ onImported, disabled = false }: HubCustomerImportProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/crm/customers/from-hub', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: boolean;
        customer?: HubCustomerOption;
      };
      if (!res.ok || !data.customer) {
        throw new Error(data.error || 'Could not use that account');
      }
      onImported(data.customer);
      setMessage(
        data.created
          ? 'Added to your contacts from their House Pros account.'
          : 'Already in your contacts. Selected them.'
      );
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not use that account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        type="button"
        className="text-sm text-gray-800 underline"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
      >
        Use their House Pros account
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-gray-600">
            Enter the email they use to sign in. Their name, phone, and address are copied into your contacts only.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="customer@email.com"
              autoComplete="off"
              disabled={disabled || busy}
            />
            <Button type="button" size="sm" onClick={() => void submit()} disabled={disabled || busy || !email.trim()}>
              {busy ? 'Looking up…' : 'Add'}
            </Button>
          </div>
          {message ? <p className="text-xs text-gray-700">{message}</p> : null}
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
