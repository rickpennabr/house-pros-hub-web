'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EMPTY_TOOL, ToolForm, toolFormError, toolPayload, useToolPickLists, type ToolFormValues } from '@/components/tools/ToolForm';

export default function AddToolPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const backHref = `/${locale}/crm/tools`;
  const lists = useToolPickLists();
  const [values, setValues] = useState<ToolFormValues>(() => ({
    ...EMPTY_TOOL,
    // Opened from a project or a maintenance house: start it there.
    projectId: searchParams.get('projectId') || '',
    maintenancePlanId: searchParams.get('maintenancePlanId') || '',
  }));
  const [recordExpense, setRecordExpense] = useState(true);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/crm/tools?pageSize=1', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : {}))
      .then((body: { businessId?: string | null }) => !cancelled && setBusinessId(body.businessId ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const hasCost = Number(values.purchase) > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const invalid = toolFormError(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...toolPayload(values), recordExpense: hasCost && recordExpense }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not add the item');
      const query = data.warning ? `?warning=${encodeURIComponent(data.warning)}` : '';
      router.replace(`${backHref}/${data.id}${query}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the item');
      setSaving(false);
    }
  };

  return (
    <div className="w-full md:max-w-3xl md:mx-auto pb-24">
      <div className="py-2 md:mb-4 flex items-center justify-between gap-4">
        <Link href={backHref} className="flex items-center gap-2 font-medium text-gray-700 hover:text-black">
          <ArrowLeft className="h-5 w-5 shrink-0" /> ProTools
        </Link>
        <span className="text-lg font-semibold text-gray-900">Add item</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
        <ToolForm values={values} onChange={setValues} lists={lists} businessId={businessId} disabled={saving} />

        {hasCost ? (
          <label className="flex items-start gap-3 rounded-lg border-2 border-black bg-white p-4 text-sm">
            <input
              type="checkbox"
              checked={recordExpense}
              onChange={(e) => setRecordExpense(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-black"
              disabled={saving}
            />
            <span>
              <span className="block font-medium">Add the purchase to Expenses</span>
              <span className="block text-gray-600">
                {values.projectId
                  ? 'Filed as a job cost on the project you picked, so you can bill it.'
                  : `Filed under ${values.kind === 'equipment' ? 'Equipment' : 'Tools'} on the date you bought it.`}{' '}
                Leave off if you already entered this expense.
              </span>
            </span>
          </label>
        ) : null}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => router.push(backHref)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? 'Adding…' : 'Add item'}
          </Button>
        </div>
      </form>
    </div>
  );
}
