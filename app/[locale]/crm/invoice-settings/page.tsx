'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';

interface InvoiceSettings {
  owner_id: string;
  default_business_id: string | null;
  default_display_name_id?: string | null;
  theme_color_hex: string;
  invoice_prefix: string;
  next_number: number;
  company_tagline: string | null;
}

interface BusinessOption {
  id: string;
  businessName: string;
}

interface DisplayNameOption {
  id: string;
  display_name: string;
}

export default function CRMInvoiceSettingsPage() {
  const locale = useLocale();
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [businesses, setBusinesses] = useState<BusinessOption[]>([]);
  const [displayNames, setDisplayNames] = useState<DisplayNameOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** '' | 'b:uuid' (business) | 'd:uuid' (display name) */
  const [defaultValue, setDefaultValue] = useState('');
  const [themeColorHex, setThemeColorHex] = useState('#000000');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [nextNumber, setNextNumber] = useState(1);
  const [companyTagline, setCompanyTagline] = useState('');

  const [addNameOpen, setAddNameOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [addingName, setAddingName] = useState(false);

  const fetchSettings = useCallback(async () => {
    const [settingsRes, businessesRes] = await Promise.all([
      fetch('/api/crm/invoice-settings', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/me/businesses/list', { credentials: 'include' }).then((r) => r.json()),
    ]);
    if (settingsRes.settings) {
      const s = settingsRes.settings as InvoiceSettings;
      setSettings(s);
      if (s.default_display_name_id) {
        setDefaultValue(`d:${s.default_display_name_id}`);
      } else if (s.default_business_id) {
        setDefaultValue(`b:${s.default_business_id}`);
      } else {
        setDefaultValue('');
      }
      setThemeColorHex(s.theme_color_hex || '#000000');
      setInvoicePrefix(s.invoice_prefix || 'INV');
      setNextNumber(s.next_number ?? 1);
      setCompanyTagline(s.company_tagline ?? '');
    }
    setDisplayNames(settingsRes.displayNames ?? []);
    const list = (businessesRes.businesses ?? []) as Array<{ id: string; businessName?: string }>;
    setBusinesses(list.map((b) => ({ id: b.id, businessName: b.businessName ?? b.id })));
  }, []);

  useEffect(() => {
    fetchSettings()
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [fetchSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const defaultBusinessId = defaultValue.startsWith('b:') ? defaultValue.slice(2) : '';
    const defaultDisplayNameId = defaultValue.startsWith('d:') ? defaultValue.slice(2) : '';
    try {
      const res = await fetch('/api/crm/invoice-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          defaultBusinessId: defaultBusinessId || null,
          defaultDisplayNameId: defaultDisplayNameId || null,
          themeColorHex: themeColorHex || '#000000',
          invoicePrefix: invoicePrefix || 'INV',
          nextNumber: nextNumber >= 1 ? nextNumber : 1,
          companyTagline: companyTagline.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      if (data.settings) setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDisplayName = async () => {
    const name = newDisplayName.trim();
    if (!name) return;
    setAddingName(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/invoice-settings/display-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add');
      const created = data.displayName as { id: string; display_name: string };
      setDisplayNames((prev) => [...prev, { id: created.id, display_name: created.display_name }]);
      setDefaultValue(`d:${created.id}`);
      setNewDisplayName('');
      setAddNameOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add display name');
    } finally {
      setAddingName(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex justify-center">
        <div className="p-12 text-center text-gray-500 text-sm">Loading invoice settings…</div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-xl">
      <div className="py-2 md:mb-6 flex items-center justify-between gap-4">
        <Link
          href={`/${locale}/crm/invoices`}
          className="flex items-center gap-2 text-gray-700 hover:text-black font-medium"
        >
          <ArrowLeft className="w-5 h-5 shrink-0" />
          Back
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Invoice settings</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Set default business and theme for invoices. Used when creating or converting to invoices.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}
        <FormField label="Default business">
          <Select
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
          >
            <option value="">None</option>
            {businesses.map((b) => (
              <option key={`b-${b.id}`} value={`b:${b.id}`}>
                {b.businessName}
              </option>
            ))}
            {displayNames.length > 0 ? <option disabled>— Display names —</option> : null}
            {displayNames.map((d) => (
              <option key={`d-${d.id}`} value={`d:${d.id}`}>
                {d.display_name} (display only)
              </option>
            ))}
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            Logo, name, and address on invoices when not specified per invoice. Use a display name for a name-only line on the invoice.
          </p>
          <button
            type="button"
            onClick={() => setAddNameOpen(true)}
            className="inline-flex items-center gap-1.5 mt-2 text-sm font-medium text-black hover:text-gray-700 focus:outline-none focus:underline cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden />
            Add display name
          </button>
        </FormField>
        <Modal
          isOpen={addNameOpen}
          onClose={() => { setAddNameOpen(false); setNewDisplayName(''); setError(null); }}
          title="Add display name"
          showHeader={true}
          maxWidth="sm"
        >
          <p className="text-sm text-gray-600 mb-3">
            Add a business name that appears only on the invoice (no logo or address). Useful for DBA or trading names.
          </p>
          <Input
            value={newDisplayName}
            onChange={(e) => setNewDisplayName(e.target.value)}
            placeholder="e.g. ABC Services LLC"
            className="mb-4"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDisplayName())}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAddNameOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleAddDisplayName} disabled={!newDisplayName.trim() || addingName}>
              {addingName ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </Modal>
        <FormField label="Theme color">
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={themeColorHex}
              onChange={(e) => setThemeColorHex(e.target.value)}
              className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
              aria-label="Theme color"
            />
            <Input
              type="text"
              value={themeColorHex}
              onChange={(e) => setThemeColorHex(e.target.value)}
              placeholder="#000000"
              className="font-mono"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Accent color for invoice header, tagline, and tinted block.
          </p>
        </FormField>
        <FormField label="Invoice number prefix">
          <Input
            value={invoicePrefix}
            onChange={(e) => setInvoicePrefix(e.target.value)}
            placeholder="INV"
          />
          <p className="text-xs text-gray-500 mt-1">
            Next invoice will be {invoicePrefix}-{String(nextNumber).padStart(4, '0')}.
          </p>
        </FormField>
        <FormField label="Next invoice number">
          <Input
            type="number"
            min={1}
            value={nextNumber}
            onChange={(e) => setNextNumber(parseInt(e.target.value, 10) || 1)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Only change if you need to sync with an external sequence.
          </p>
        </FormField>
        <FormField label="Company tagline (optional)">
          <Input
            value={companyTagline}
            onChange={(e) => setCompanyTagline(e.target.value)}
            placeholder="e.g. Excellence in Products & Services"
          />
        </FormField>
        <div className="flex gap-2 pt-2">
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}
