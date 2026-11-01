'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { InvoiceTemplateBusiness } from './InvoiceTemplate';
import type { CompanyDisplayOverride } from '@/lib/invoices/companyDisplay';

export interface InvoiceCompanyEditorProps {
  isOpen: boolean;
  onClose: () => void;
  /** Current company display (merged business, or default business for new invoice) */
  initialValues: InvoiceTemplateBusiness;
  onSave: (values: CompanyDisplayOverride) => void;
  /** If provided, show "Reset to default" and call when clicked */
  onResetToDefault?: () => void;
  saving?: boolean;
}

const EMPTY: InvoiceTemplateBusiness = {
  business_name: '',
  address: null,
  email: null,
  phone: null,
  website: null,
  business_logo: null,
  company_tagline: null,
};

function toFormValues(b: InvoiceTemplateBusiness): Record<keyof CompanyDisplayOverride, string> {
  return {
    business_name: b.business_name ?? '',
    address: b.address ?? '',
    email: b.email ?? '',
    phone: b.phone ?? '',
    website: b.website ?? '',
    business_logo: b.business_logo ?? '',
    company_tagline: b.company_tagline ?? '',
  };
}

function toOverride(values: Record<keyof CompanyDisplayOverride, string>): CompanyDisplayOverride {
  const o: CompanyDisplayOverride = {};
  if (values.business_name !== undefined) o.business_name = values.business_name.trim() || '';
  if (values.address !== undefined) o.address = values.address.trim() || '';
  if (values.email !== undefined) o.email = values.email.trim() || '';
  if (values.phone !== undefined) o.phone = values.phone.trim() || '';
  if (values.website !== undefined) o.website = values.website.trim() || '';
  if (values.business_logo !== undefined) o.business_logo = values.business_logo.trim() || '';
  if (values.company_tagline !== undefined) o.company_tagline = values.company_tagline.trim() || '';
  return o;
}

export function InvoiceCompanyEditor({
  isOpen,
  onClose,
  initialValues,
  onSave,
  onResetToDefault,
  saving = false,
}: InvoiceCompanyEditorProps) {
  const [form, setForm] = useState<Record<keyof CompanyDisplayOverride, string>>(() =>
    toFormValues(initialValues ?? EMPTY)
  );

  useEffect(() => {
    if (isOpen) setForm(toFormValues(initialValues ?? EMPTY));
  }, [isOpen, initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(toOverride(form));
    onClose();
  };

  const handleReset = () => {
    onResetToDefault?.();
    // Parent is responsible for closing when reset is provided (e.g. after async PATCH).
    if (!onResetToDefault) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Company information on invoice"
      showHeader
      maxWidth="md"
    >
      <p className="text-sm text-gray-600 mb-4">
        This information appears on the invoice header. Change it here when you want payment in the name of a different entity (e.g. legal company instead of DBA).
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Business / company name</span>
          <Input
            value={form.business_name}
            onChange={(e) => setForm((p) => ({ ...p, business_name: e.target.value }))}
            placeholder="Legal or trading name"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Address</span>
          <textarea
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            placeholder="Street, city, state, ZIP"
            rows={3}
            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Email</span>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="billing@company.com"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Phone</span>
            <Input
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="(555) 123-4567"
            />
          </label>
        </div>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Website</span>
          <Input
            value={form.website}
            onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
            placeholder="https://example.com"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Logo URL (optional)</span>
          <Input
            value={form.business_logo}
            onChange={(e) => setForm((p) => ({ ...p, business_logo: e.target.value }))}
            placeholder="https://... or leave blank to use business logo"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Company tagline (optional)</span>
          <Input
            value={form.company_tagline}
            onChange={(e) => setForm((p) => ({ ...p, company_tagline: e.target.value }))}
            placeholder="e.g. Licensed &amp; Insured"
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-2">
          {onResetToDefault && (
            <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={saving}>
              Reset to default
            </Button>
          )}
          <div className="flex-1" />
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
