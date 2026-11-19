'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { AlertTriangle, Hammer, Plus, Search, Truck, User, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import { formatCents } from '@/lib/crm/catalog-options';
import { TOOL_STATUS_LABELS, type ToolKind, type ToolStatus } from '@/lib/crm/pro-tools';
import type { ToolListItem, ToolsSummary } from '@/lib/crm/pro-tools-db';

const FILTERS: { id: '' | ToolStatus | 'service_due'; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'in_use', label: 'In use' },
  { id: 'repair', label: 'In repair' },
  { id: 'service_due', label: 'Service due' },
  { id: 'retired', label: 'Retired' },
  { id: 'lost', label: 'Lost' },
];

const STATUS_BADGE: Record<ToolStatus, string> = {
  available: 'bg-green-50 text-green-800 border-green-300',
  in_use: 'bg-blue-50 text-blue-800 border-blue-300',
  repair: 'bg-amber-50 text-amber-800 border-amber-300',
  retired: 'bg-gray-100 text-gray-600 border-gray-300',
  lost: 'bg-red-50 text-red-700 border-red-300',
};

const PAGE_SIZE = 24;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border-2 border-black bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function ToolCard({ tool, href }: { tool: ToolListItem; href: string }) {
  const where = tool.projectName ?? tool.houseName ?? tool.location;
  return (
    <Link href={href} className="flex gap-3 rounded-lg border-2 border-black bg-white p-3 transition-shadow hover:shadow-lg">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/20 bg-gray-50">
        {tool.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
          <img src={tool.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : tool.kind === 'equipment' ? (
          <Truck className="h-6 w-6 text-gray-400" />
        ) : (
          <Hammer className="h-6 w-6 text-gray-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold text-gray-900">
            {tool.name}
            {tool.quantity > 1 ? <span className="font-normal text-gray-500"> × {tool.quantity}</span> : null}
          </p>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[tool.status]}`}>
            {TOOL_STATUS_LABELS[tool.status]}
          </span>
        </div>
        <p className="truncate text-xs text-gray-600">
          {[tool.category, [tool.brand, tool.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ') || '—'}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-700">
          <span>Value {formatCents(tool.bookValueCents)}</span>
          {tool.assignedTo ? (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" /> {tool.assignedTo}
            </span>
          ) : null}
          {where ? <span className="truncate">@ {where}</span> : null}
          {tool.serviceDue ? (
            <span className={`inline-flex items-center gap-1 font-medium ${tool.serviceDue === 'overdue' ? 'text-red-700' : 'text-amber-700'}`}>
              <Wrench className="h-3 w-3" /> {tool.serviceDue === 'overdue' ? 'Service overdue' : 'Service soon'}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function ProToolsPage() {
  const locale = useLocale();
  const router = useRouter();
  const base = `/${locale}/crm/tools`;
  const [kind, setKind] = useState<'' | ToolKind>('');
  const [status, setStatus] = useState<(typeof FILTERS)[number]['id']>('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ tools: ToolListItem[]; total: number; summary: ToolsSummary | null; canEdit: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      summary: '1',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    if (kind) params.set('kind', kind);
    if (status) params.set('status', status);
    if (debounced.trim()) params.set('search', debounced.trim());
    const res = await fetch(`/api/crm/tools?${params}`, { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not load ProTools');
    return body;
  }, [page, kind, status, debounced]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((body) => {
        if (cancelled) return;
        setData(body);
        setError(null);
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load ProTools'));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const summary = data?.summary;
  const addItem = () => router.push(`${base}/new`);

  return (
    <div className="w-full space-y-4 pb-24">
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">ProTools</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Your tools and equipment: what you own, who has it, where it is working, and what it is worth.
          </p>
        </div>
        {data?.canEdit !== false ? (
          <Button variant="primary" size="sm" className="flex shrink-0 items-center gap-2" onClick={addItem}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add item</span>
            <span className="sm:hidden">Add</span>
          </Button>
        ) : null}
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Items" value={String(summary.itemCount)} hint={`${summary.activeCount} in service`} />
          <Stat label="Paid" value={formatCents(summary.purchaseCents)} hint="Total purchase cost" />
          <Stat label="Value today" value={formatCents(summary.bookValueCents)} hint={`Loses ${formatCents(summary.yearlyDepreciationCents)} a year`} />
          <Stat
            label="Upkeep"
            value={formatCents(summary.upkeepCents)}
            hint={summary.serviceDueCount > 0 ? `${summary.serviceDueCount} need service` : 'Repairs, parts, service'}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, brand, serial, who has it…"
            className="pl-9"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          {(
            [
              { id: '', label: 'All' },
              { id: 'tool', label: 'Tools' },
              { id: 'equipment', label: 'Equipment' },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setKind(option.id);
                setPage(1);
              }}
              className={`h-11 rounded-lg border-2 border-black px-4 text-sm font-medium ${
                kind === option.id ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => {
              setStatus(filter.id);
              setPage(1);
            }}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-black px-3 py-1.5 text-sm font-medium ${
              status === filter.id ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
            }`}
          >
            {filter.id === 'service_due' ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
            {filter.label}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}

      {!data && !error ? <div className="p-12 text-center text-sm text-gray-500">Loading ProTools…</div> : null}

      {data && data.tools.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-black/30 p-10 text-center">
          <Hammer className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            {debounced || status || kind ? 'Nothing matches.' : 'No tools or equipment yet. Add your first item to start tracking it.'}
          </p>
          {data.canEdit && !debounced && !status && !kind ? (
            <Button variant="primary" size="sm" className="mt-3 inline-flex items-center gap-2" onClick={addItem}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
          ) : null}
        </div>
      ) : null}

      {data && data.tools.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} href={`${base}/${tool.id}`} />
          ))}
        </div>
      ) : null}

      {data && data.total > PAGE_SIZE ? (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(data.total / PAGE_SIZE)}
          onPageChange={setPage}
          totalItems={data.total}
          itemsPerPage={PAGE_SIZE}
          itemLabel="items"
        />
      ) : null}

      {summary && summary.byCategory.length > 0 ? (
        <section className="space-y-2 rounded-lg border-2 border-black bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">Value by category</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-1 font-semibold">Category</th>
                <th className="py-1 text-right font-semibold">Items</th>
                <th className="py-1 text-right font-semibold">Paid</th>
                <th className="py-1 text-right font-semibold">Value today</th>
              </tr>
            </thead>
            <tbody>
              {summary.byCategory.map((row) => (
                <tr key={row.category} className="border-t border-black/10">
                  <td className="py-1.5">{row.category}</td>
                  <td className="py-1.5 text-right">{row.count}</td>
                  <td className="py-1.5 text-right">{formatCents(row.purchaseCents)}</td>
                  <td className="py-1.5 text-right font-medium">{formatCents(row.bookValueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-500">
            Value today assumes each item loses value evenly over its useful life. Retired and lost items count as $0.
          </p>
        </section>
      ) : null}
    </div>
  );
}
