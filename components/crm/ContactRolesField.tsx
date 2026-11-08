'use client';

import { useEffect, useState } from 'react';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { CrmContactRole } from '@/lib/crm/contact-role';

interface ContactRolesFieldProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ContactRolesField({ selectedIds, onChange }: ContactRolesFieldProps) {
  const [roles, setRoles] = useState<CrmContactRole[]>([]);
  const [name, setName] = useState('');
  const [canInvoice, setCanInvoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/crm/roles', { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { roles?: CrmContactRole[] }) => {
        if (cancelled) return;
        const list = data.roles ?? [];
        setRoles(list);
        if (selectedIds.length === 0) {
          const customer = list.find((role) => role.slug === 'customer' && role.is_system);
          if (customer) onChange([customer.id]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Select Customer once, when the catalog first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((roleId) => roleId !== id) : [...selectedIds, id]);
  };

  const addRole = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: trimmed, canInvoice }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add role');
      const role = data.role as CrmContactRole;
      setRoles((current) => [...current, role]);
      onChange([...selectedIds, role.id]);
      setName('');
      setCanInvoice(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="col-span-2 md:col-span-3 space-y-3">
      <FormField label="Roles" required>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => {
            const selected = selectedIds.includes(role.id);
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => toggle(role.id)}
                aria-pressed={selected}
                className={`rounded-full border-2 border-black px-3 py-1 text-sm font-medium cursor-pointer ${
                  selected ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'
                }`}
              >
                {role.name}
              </button>
            );
          })}
        </div>
      </FormField>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="New role" className="min-w-[180px] flex-1">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void addRole();
              }
            }}
            placeholder="Architect, realtor..."
            maxLength={40}
          />
        </FormField>
        <label className="mb-2 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={canInvoice}
            onChange={(event) => setCanInvoice(event.target.checked)}
            className="h-4 w-4 accent-black"
          />
          Can be invoiced
        </label>
        <Button type="button" variant="secondary" size="sm" className="mb-0.5" disabled={saving || name.trim().length < 2} onClick={() => void addRole()}>
          {saving ? 'Adding…' : 'Add role'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <p className="text-xs text-gray-500">A contact can have more than one role. Estimates and invoices use roles marked “Can be invoiced.”</p>
    </div>
  );
}
