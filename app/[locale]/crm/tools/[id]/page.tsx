'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Hammer, History, Pencil, Receipt, Trash2, Truck, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ToolForm, toolFormError, toolPayload, useToolPickLists, type ToolFormValues } from '@/components/tools/ToolForm';
import { formatCents } from '@/lib/crm/catalog-options';
import { TOOL_STATUS_LABELS, TOOL_STATUSES, type ToolStatus } from '@/lib/crm/pro-tools';
import type { ToolListItem } from '@/lib/crm/pro-tools-db';

type ToolDetail = ToolListItem & {
  usefulLifeYears: number;
  salvageCents: number;
  yearlyDepreciationCents: number;
  upkeepCents: number;
  note: string | null;
  photoDriveFileId: string | null;
  createdAt: string;
};

interface Detail {
  tool: ToolDetail;
  expenses: { id: string; amountCents: number; category: string; date: string; description: string | null; isPurchase: boolean }[];
  history: { id: string; status: string | null; assignedTo: string | null; projectName: string | null; houseName: string | null; note: string | null; at: string }[];
  canEdit: boolean;
}

const UPKEEP_KINDS = ['Repair', 'Parts', 'Service', 'Fuel', 'Rental', 'Other'] as const;

function toValues(tool: ToolDetail): ToolFormValues {
  return {
    kind: tool.kind,
    name: tool.name,
    category: tool.category ?? '',
    brand: tool.brand ?? '',
    model: tool.model ?? '',
    serialNumber: tool.serialNumber ?? '',
    quantity: String(tool.quantity),
    purchaseDate: tool.purchaseDate ?? '',
    purchase: tool.purchaseCents ? (tool.purchaseCents / 100).toFixed(2) : '',
    usefulLifeYears: String(tool.usefulLifeYears),
    salvage: tool.salvageCents ? (tool.salvageCents / 100).toFixed(2) : '',
    status: tool.status,
    assignedCrewId: tool.assignedCrewId ?? '',
    projectId: tool.projectId ?? '',
    maintenancePlanId: tool.maintenancePlanId ?? '',
    location: tool.location ?? '',
    nextServiceDate: tool.nextServiceDate ?? '',
    photoDriveFileId: tool.photoDriveFileId ?? '',
    photoUrl: tool.photoUrl ?? '',
    note: tool.note ?? '',
  };
}

function yearsOwned(purchaseDate: string | null): number | null {
  if (!purchaseDate) return null;
  const years = (Date.now() - Date.parse(`${purchaseDate}T00:00:00`)) / (365.25 * 86_400_000);
  return years > 0 ? years : null;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-black/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-base font-semibold text-gray-900">{value}</p>
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export default function ToolDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const backHref = `/${locale}/crm/tools`;
  const lists = useToolPickLists();

  const [detail, setDetail] = useState<Detail | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(searchParams.get('warning'));
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ToolFormValues | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [move, setMove] = useState({ status: '' as ToolStatus | '', assignedCrewId: '', projectId: '', maintenancePlanId: '', note: '' });
  const [upkeep, setUpkeep] = useState({
    kind: 'Repair' as (typeof UPKEEP_KINDS)[number],
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    projectId: '',
    nextServiceDate: '',
  });

  const load = useCallback(async () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const [res, meta] = await Promise.all([
      fetch(`/api/crm/tools/${id}?timeZone=${encodeURIComponent(timeZone)}`, { credentials: 'include' }),
      fetch('/api/crm/tools?pageSize=1', { credentials: 'include' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as Promise<{ businessId?: string | null }>,
    ]);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not load the item');
    return { detail: body as Detail, businessId: (meta.businessId as string | null) ?? null };
  }, [id]);

  const apply = (fresh: { detail: Detail; businessId: string | null }) => {
    setDetail(fresh.detail);
    setBusinessId(fresh.businessId);
    setValues(toValues(fresh.detail.tool));
    const tool = fresh.detail.tool;
    setMove({
      status: tool.status,
      assignedCrewId: tool.assignedCrewId ?? '',
      projectId: tool.projectId ?? '',
      maintenancePlanId: tool.maintenancePlanId ?? '',
      note: '',
    });
  };

  useEffect(() => {
    let cancelled = false;
    load()
      .then((fresh) => !cancelled && apply(fresh))
      .catch((err: unknown) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Could not load the item'));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const run = async (action: () => Promise<Response>, done: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await action();
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Something went wrong');
      apply(await load());
      setNotice(done);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const json = (method: string, url: string, body: unknown) =>
    fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const saveEdit = async () => {
    if (!values) return;
    const invalid = toolFormError(values);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (await run(() => json('PATCH', `/api/crm/tools/${id}`, toolPayload(values)), 'Saved.')) setEditing(false);
  };

  const saveMove = () =>
    run(
      () =>
        json('PATCH', `/api/crm/tools/${id}`, {
          checkout: true,
          status: move.status || undefined,
          assignedCrewId: move.assignedCrewId || null,
          projectId: move.projectId || null,
          maintenancePlanId: move.maintenancePlanId || null,
          note: move.note.trim() || null,
        }),
      'Updated where it is.'
    );

  const saveUpkeep = async () => {
    const dollars = Number(upkeep.amount);
    if (!(dollars > 0)) {
      setError('Enter what it cost.');
      return;
    }
    const ok = await run(
      () =>
        json('POST', `/api/crm/tools/${id}/expenses`, {
          kind: upkeep.kind,
          amountCents: Math.round(dollars * 100),
          date: upkeep.date,
          description: upkeep.description.trim() || undefined,
          projectId: upkeep.projectId || null,
          ...(upkeep.nextServiceDate ? { nextServiceDate: upkeep.nextServiceDate } : {}),
        }),
      'Expense added. It also shows in Expenses.'
    );
    if (ok) setUpkeep((current) => ({ ...current, amount: '', description: '', nextServiceDate: '' }));
  };

  const remove = async () => {
    setBusy(true);
    const res = await fetch(`/api/crm/tools/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      router.replace(backHref);
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(typeof body.error === 'string' ? body.error : 'Could not delete');
    setBusy(false);
    setConfirmDelete(false);
  };

  if (loadError) {
    return (
      <div className="w-full md:max-w-3xl md:mx-auto space-y-4 py-4">
        <Link href={backHref} className="flex items-center gap-2 font-medium text-gray-700 hover:text-black">
          <ArrowLeft className="h-5 w-5" /> ProTools
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div>
      </div>
    );
  }
  if (!detail || !values) return <div className="p-12 text-center text-sm text-gray-500">Loading…</div>;

  const { tool, canEdit } = detail;
  const owned = yearsOwned(tool.purchaseDate);
  const totalCost = tool.purchaseCents + tool.upkeepCents;
  const costPerYear = owned && owned >= 0.25 ? Math.round((totalCost - tool.bookValueCents) / owned) : null;
  const where = [tool.projectName && `Project: ${tool.projectName}`, tool.houseName && `House: ${tool.houseName}`, tool.location]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="w-full md:max-w-3xl md:mx-auto space-y-4 pb-24">
      <div className="flex items-center justify-between gap-4 py-2">
        <Link href={backHref} className="flex items-center gap-2 font-medium text-gray-700 hover:text-black">
          <ArrowLeft className="h-5 w-5 shrink-0" /> ProTools
        </Link>
        {canEdit && !editing ? (
          <Button variant="secondary" size="sm" className="flex items-center gap-2" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        ) : null}
      </div>

      {notice ? <div className="rounded-lg border-2 border-green-600 bg-green-50 p-3 text-sm text-green-800">{notice}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveEdit();
          }}
          className="space-y-4"
        >
          <ToolForm values={values} onChange={setValues} lists={lists} businessId={businessId} disabled={busy} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                setValues(toValues(tool));
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto inline-flex items-center gap-1 text-sm text-red-700 underline"
              disabled={busy}
            >
              <Trash2 className="h-4 w-4" /> Delete item
            </button>
          </div>
        </form>
      ) : (
        <>
          <section className="rounded-lg border-2 border-black bg-white p-4">
            <div className="flex gap-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/20 bg-gray-50">
                {tool.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                  <img src={tool.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : tool.kind === 'equipment' ? (
                  <Truck className="h-8 w-8 text-gray-400" />
                ) : (
                  <Hammer className="h-8 w-8 text-gray-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h1 className="text-xl font-semibold text-gray-900">
                    {tool.name}
                    {tool.quantity > 1 ? <span className="font-normal text-gray-500"> × {tool.quantity}</span> : null}
                  </h1>
                  <span className="rounded-full border border-black px-2 py-0.5 text-xs font-medium">{TOOL_STATUS_LABELS[tool.status]}</span>
                </div>
                <p className="text-sm text-gray-600">
                  {[tool.kind === 'equipment' ? 'Equipment' : 'Tool', tool.category, [tool.brand, tool.model].filter(Boolean).join(' ')]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {tool.serialNumber ? <p className="text-xs text-gray-500">Serial {tool.serialNumber}</p> : null}
                <p className="mt-1 text-sm">
                  {tool.assignedTo ? <span className="font-medium">{tool.assignedTo}</span> : 'In the shop'}
                  {where ? <span className="text-gray-600"> · {where}</span> : null}
                </p>
                {tool.nextServiceDate ? (
                  <p
                    className={`mt-1 inline-flex items-center gap-1 text-xs ${
                      tool.serviceDue === 'overdue' ? 'font-medium text-red-700' : tool.serviceDue === 'soon' ? 'font-medium text-amber-700' : 'text-gray-600'
                    }`}
                  >
                    <Wrench className="h-3 w-3" /> Next service {tool.nextServiceDate}
                  </p>
                ) : null}
              </div>
            </div>
            {tool.note ? <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">{tool.note}</p> : null}
          </section>

          <section className="space-y-3 rounded-lg border-2 border-black bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">Cost and value</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Paid" value={formatCents(tool.purchaseCents)} hint={tool.purchaseDate ? `on ${tool.purchaseDate}` : 'No purchase date'} />
              <Stat label="Value today" value={formatCents(tool.bookValueCents)} hint={`${tool.usefulLifeYears} year life`} />
              <Stat label="Loses each year" value={formatCents(tool.yearlyDepreciationCents)} />
              <Stat label="Upkeep" value={formatCents(tool.upkeepCents)} hint="Repairs, parts, service" />
              <Stat label="Total cost" value={formatCents(totalCost)} hint="Paid + upkeep" />
              <Stat
                label="Cost per year"
                value={costPerYear != null ? formatCents(costPerYear) : '—'}
                hint={owned ? `Owned ${owned.toFixed(1)} years` : 'Needs a purchase date'}
              />
            </div>
          </section>
        </>
      )}

      {!editing ? (
        <section className="space-y-3 rounded-lg border-2 border-black bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">Check out / move</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label="Status">
              <Select value={move.status} onChange={(e) => setMove({ ...move, status: e.target.value as ToolStatus })} disabled={busy}>
                {TOOL_STATUSES.filter((status) => canEdit || status !== 'retired').map((status) => (
                  <option key={status} value={status}>
                    {TOOL_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Who has it">
              <Select value={move.assignedCrewId} onChange={(e) => setMove({ ...move, assignedCrewId: e.target.value })} disabled={busy}>
                <option value="">Nobody (in the shop)</option>
                {lists.crew.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Project">
              <Select value={move.projectId} onChange={(e) => setMove({ ...move, projectId: e.target.value })} disabled={busy}>
                <option value="">No project</option>
                {lists.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Maintenance house">
              <Select value={move.maintenancePlanId} onChange={(e) => setMove({ ...move, maintenancePlanId: e.target.value })} disabled={busy}>
                <option value="">No house</option>
                {lists.houses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField label="Note">
            <Input value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} placeholder="e.g. Blade is dull" maxLength={500} disabled={busy} />
          </FormField>
          <Button type="button" variant="primary" size="sm" onClick={() => void saveMove()} disabled={busy}>
            Save
          </Button>
        </section>
      ) : null}

      {canEdit && !editing ? (
        <section className="space-y-3 rounded-lg border-2 border-black bg-white p-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Receipt className="h-4 w-4" /> Add a repair or cost
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormField label="Type">
              <Select value={upkeep.kind} onChange={(e) => setUpkeep({ ...upkeep, kind: e.target.value as (typeof UPKEEP_KINDS)[number] })} disabled={busy}>
                {UPKEEP_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Cost ($)">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={upkeep.amount}
                onChange={(e) => setUpkeep({ ...upkeep, amount: e.target.value })}
                placeholder="0.00"
                disabled={busy}
              />
            </FormField>
            <FormField label="Date">
              <Input type="date" value={upkeep.date} onChange={(e) => setUpkeep({ ...upkeep, date: e.target.value })} disabled={busy} />
            </FormField>
            <FormField label="Bill to project">
              <Select value={upkeep.projectId} onChange={(e) => setUpkeep({ ...upkeep, projectId: e.target.value })} disabled={busy}>
                <option value="">Business cost</option>
                {lists.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Next service">
              <Input
                type="date"
                value={upkeep.nextServiceDate}
                onChange={(e) => setUpkeep({ ...upkeep, nextServiceDate: e.target.value })}
                disabled={busy}
              />
            </FormField>
          </div>
          <FormField label="What was done">
            <Input
              value={upkeep.description}
              onChange={(e) => setUpkeep({ ...upkeep, description: e.target.value })}
              placeholder="e.g. New blades and oil change"
              maxLength={400}
              disabled={busy}
            />
          </FormField>
          <Button type="button" variant="primary" size="sm" onClick={() => void saveUpkeep()} disabled={busy}>
            Add expense
          </Button>
        </section>
      ) : null}

      <section className="space-y-2 rounded-lg border-2 border-black bg-white p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Receipt className="h-4 w-4" /> Expenses
        </h2>
        {detail.expenses.length === 0 ? (
          <p className="text-sm text-gray-600">No expenses filed on this item.</p>
        ) : (
          <ul className="divide-y divide-black/10 text-sm">
            {detail.expenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{expense.isPurchase ? 'Purchase' : expense.description || expense.category}</div>
                  <div className="text-xs text-gray-600">
                    {expense.date} · {expense.category}
                  </div>
                </div>
                <span className="shrink-0 font-medium">{formatCents(expense.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/${locale}/crm/expenses`} className="text-xs underline">
          Open Expenses
        </Link>
      </section>

      <section className="space-y-2 rounded-lg border-2 border-black bg-white p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <History className="h-4 w-4" /> History
        </h2>
        {detail.history.length === 0 ? (
          <p className="text-sm text-gray-600">Nothing yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.history.map((event) => (
              <li key={event.id} className="border-l-2 border-black/20 pl-3">
                <div className="text-xs text-gray-500">{new Date(event.at).toLocaleString()}</div>
                <div>
                  {[
                    event.status && TOOL_STATUS_LABELS[event.status as ToolStatus],
                    event.assignedTo ? `with ${event.assignedTo}` : null,
                    event.projectName ? `project ${event.projectName}` : null,
                    event.houseName ? `house ${event.houseName}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  {event.note ? <span className="text-gray-600"> — {event.note}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmDelete ? (
        <ConfirmationModal
          isOpen
          onClose={() => setConfirmDelete(false)}
          title="Delete this item?"
          message="It leaves ProTools and the valuation. Its expenses stay in Expenses. To keep its history, set it to Retired instead."
          primaryButton={{ label: 'Delete', onClick: () => void remove() }}
          secondaryButton={{ label: 'Cancel', onClick: () => setConfirmDelete(false) }}
        />
      ) : null}
    </div>
  );
}
