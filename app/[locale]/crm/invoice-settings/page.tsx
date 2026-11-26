'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft, Building2, Plus, X } from 'lucide-react';
import { PAYMENT_TERM_OPTIONS } from '@/lib/invoices/invoice-brand';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { FileDropTarget } from '@/components/ui/FileDropTarget';
import { CardPaymentsSettings } from '@/components/crm/CardPaymentsSettings';

interface InvoiceSettings {
  owner_id: string;
  default_business_id: string | null;
  default_display_name_id?: string | null;
  theme_color_hex: string;
  invoice_prefix: string;
  next_number: number;
  company_tagline: string | null;
  logo_url?: string | null;
  default_payment_terms?: string | null;
  default_note?: string | null;
  footer_text?: string | null;
  payment_instructions?: string | null;
  reminder_message?: string | null;
  company_address?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  company_website?: string | null;
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
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('Due on receipt');
  const [defaultNote, setDefaultNote] = useState('');
  const [footerText, setFooterText] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [previewTab, setPreviewTab] = useState<'reminder' | 'invoice'>('reminder');
  const [previewKey, setPreviewKey] = useState(0);
  /** Uploaded invoice logo; null uses the business logo. */
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [businessLogo, setBusinessLogo] = useState<{ url: string; businessName: string } | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);

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
      setDefaultPaymentTerms(s.default_payment_terms || 'Due on receipt');
      setDefaultNote(s.default_note ?? '');
      setFooterText(s.footer_text ?? '');
      setPaymentInstructions(s.payment_instructions ?? '');
      setReminderMessage(s.reminder_message ?? '');
      setCompanyAddress(s.company_address ?? '');
      setCompanyEmail(s.company_email ?? '');
      setCompanyPhone(s.company_phone ?? '');
      setCompanyWebsite(s.company_website ?? '');
      setLogoUrl(s.logo_url ?? null);
    }
    setBusinessLogo(settingsRes.businessLogo ?? null);
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
    setSaved(false);
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
          defaultPaymentTerms: defaultPaymentTerms.trim() || null,
          defaultNote: defaultNote.trim() || null,
          footerText: footerText.trim() || null,
          paymentInstructions: paymentInstructions.trim() || null,
          reminderMessage: reminderMessage.trim() || null,
          companyAddress: companyAddress.trim() || null,
          companyEmail: companyEmail.trim() || null,
          companyPhone: companyPhone.trim() || null,
          companyWebsite: companyWebsite.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      if (data.settings) setSettings(data.settings);
      setSaved(true);
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setLogoBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/crm/invoice-settings/logo', { method: 'POST', credentials: 'include', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not upload the logo');
      setLogoUrl(data.logoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the logo');
    } finally {
      setLogoBusy(false);
      if (logoInput.current) logoInput.current.value = '';
    }
  };

  const resetToBusinessLogo = async () => {
    setLogoBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/invoice-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ logoUrl: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not reset the logo');
      setLogoUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the logo');
    } finally {
      setLogoBusy(false);
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
        How your invoices look and what new invoices start with. Used when creating or converting to invoices.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}
        <h2 className="text-base font-semibold text-gray-900 pt-2">Branding</h2>
        <FormField label="Logo">
          <div className="flex items-center gap-4">
            {/* Same tile as the business sign-up: click to upload, red X removes. */}
            <div className="relative shrink-0">
              <FileDropTarget inputRef={logoInput} accept="image/png,image/jpeg,image/webp">
              <button
                type="button"
                onClick={() => logoInput.current?.click()}
                disabled={logoBusy}
                aria-label={logoUrl || businessLogo ? 'Upload a different logo' : 'Upload logo'}
                className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-4 border-white bg-white shadow-xl transition-transform hover:scale-105 disabled:opacity-60"
              >
                {logoUrl || businessLogo?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl || businessLogo?.url} alt="Invoice logo" className="h-full w-full object-cover object-center" />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-black p-2 text-white">
                    <Building2 className="h-6 w-6" aria-hidden />
                    <span className="text-center text-[8px] font-bold uppercase">Upload logo</span>
                  </span>
                )}
                {logoBusy ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs font-medium">Saving…</span>
                ) : null}
              </button>
              </FileDropTarget>
              {logoUrl ? (
                <button
                  type="button"
                  onClick={() => void resetToBusinessLogo()}
                  disabled={logoBusy}
                  title={businessLogo ? 'Remove and use the business logo' : 'Remove logo'}
                  aria-label={businessLogo ? 'Remove and use the business logo' : 'Remove logo'}
                  className="absolute -right-2 -top-2 z-20 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border-2 border-white bg-red-500 shadow-lg transition-colors hover:bg-red-600"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              ) : null}
              <input
                ref={logoInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadLogo(file);
                }}
              />
            </div>
            <p className="min-w-0 text-sm text-gray-700">
              {logoUrl
                ? 'Custom logo for invoices.'
                : businessLogo
                  ? `Using the ${businessLogo.businessName} logo from your Pro account.`
                  : 'No logo yet.'}{' '}
              <span className="text-gray-500">Tap the logo to use a different one.</span>
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Only changes invoices; your business profile keeps its logo. PNG, JPEG or WebP, up to 5MB.
          </p>
        </FormField>
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
        <FormField label="Company tagline (optional)">
          <Input
            value={companyTagline}
            onChange={(e) => setCompanyTagline(e.target.value)}
            placeholder="e.g. Excellence in Products & Services"
          />
        </FormField>

        <h2 className="text-base font-semibold text-gray-900 pt-4">Company information</h2>
        <p className="text-xs text-gray-500 -mt-2">
          Printed at the top of every invoice. Leave a field blank to use what is on your business profile.
        </p>
        <FormField label="Address">
          <textarea
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Street, city, state, ZIP"
            className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none"
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email">
            <Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="billing@company.com" />
          </FormField>
          <FormField label="Phone">
            <Input type="tel" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="(555) 123-4567" />
          </FormField>
        </div>
        <FormField label="Website">
          <Input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://example.com" />
        </FormField>

        <h2 className="text-base font-semibold text-gray-900 pt-4">Numbering</h2>
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

        <h2 className="text-base font-semibold text-gray-900 pt-4">New invoices</h2>
        <FormField label="Default payment terms">
          <Select value={defaultPaymentTerms} onChange={(e) => setDefaultPaymentTerms(e.target.value)}>
            {PAYMENT_TERM_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {!(PAYMENT_TERM_OPTIONS as readonly string[]).includes(defaultPaymentTerms) ? (
              <option value={defaultPaymentTerms}>{defaultPaymentTerms}</option>
            ) : null}
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            New invoices start with these terms, and the due date follows them (Net 30 is due 30 days after the invoice date).
          </p>
        </FormField>
        <FormField label="Default message to customer (optional)">
          <textarea
            value={defaultNote}
            onChange={(e) => setDefaultNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. Thank you for your business! We appreciate the opportunity to work on your home."
            className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">Filled in on each new invoice; you can edit it per invoice.</p>
        </FormField>

        <h2 className="text-base font-semibold text-gray-900 pt-4">Footer</h2>
        <FormField label="Invoice footer (optional)">
          <textarea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={'e.g. Make checks payable to The Paver Pro. Zelle: billing@example.com.\nA 1.5% monthly late fee applies to balances past due. Licensed and insured, NV #12345.'}
            className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Printed at the bottom of every invoice, on screen and in the PDF: payment instructions, license number, terms and conditions.
          </p>
        </FormField>

        <CardPaymentsSettings />

        <h2 className="text-base font-semibold text-gray-900 pt-4">Payment reminders</h2>
        <FormField label="Other ways to pay (optional)">
          <textarea
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={'e.g. Zelle: billing@example.com\nChecks payable to The Paver Pro'}
            className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">Shown on reminder emails under the card pay button.</p>
        </FormField>
        <FormField label="Default reminder message (optional)">
          <textarea
            value={reminderMessage}
            onChange={(e) => setReminderMessage(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="e.g. Just a friendly nudge. Let me know if you have any questions about the work."
            className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Filled in when you send a reminder from an invoice&apos;s menu (Send reminder appears once an invoice is due).
          </p>
        </FormField>

        <h2 className="text-base font-semibold text-gray-900 pt-4">Previews</h2>
        <p className="text-xs text-gray-500">Sample data with your saved branding. Save to refresh.</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {([
            ['reminder', 'Reminder email'],
            ['invoice', 'Invoice email'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreviewTab(key)}
              className={`shrink-0 rounded-lg border-2 border-black px-3 py-1.5 text-sm font-medium ${previewTab === key ? 'bg-black text-white' : 'bg-white'}`}
            >
              {label}
            </button>
          ))}
          <Link
            href={`/${locale}/crm/invoices`}
            className="shrink-0 rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-medium"
          >
            Invoice, PDF &amp; payer views →
          </Link>
        </div>
        <div className="overflow-hidden rounded-lg border-2 border-gray-200">
          <iframe
            key={`${previewTab}-${previewKey}`}
            title="Email preview"
            src={`/api/crm/invoice-settings/preview?kind=${previewTab}`}
            className="h-[520px] w-full bg-gray-100"
            sandbox=""
          />
        </div>
        <p className="text-xs text-gray-500">
          Open any invoice to see the invoice view, Download PDF, Copy payment link (what the payer sees) and Edit.
        </p>

        <div className="flex items-center gap-3 pt-2 pb-12">
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
          {saved && !saving ? <span className="text-sm text-gray-600">Saved.</span> : null}
        </div>
      </form>
      </div>
    </div>
  );
}
