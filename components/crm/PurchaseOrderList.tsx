'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CRMSearchField } from '@/components/crm/CRMSearchField';
import { money, PO_STATUS_CLASS, PO_STATUS_LABEL, PurchaseOrderEditor, type PurchaseOrderView } from '@/components/crm/PurchaseOrderEditor';
import type { PoStatus } from '@/lib/crm/purchase-orders';

type Filter = 'all' | 'open' | 'draft' | 'received' | 'cancelled';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'draft', label: 'Drafts' },
  { key: 'received', label: 'Received' },
  { key: 'cancelled', label: 'Cancelled' },
];
const OPEN: PoStatus[] = ['sent', 'confirmed', 'partial'];

/** Purchase orders: the full list (CRM page) or one project's (project page, with projectId). */
export function PurchaseOrderList({ projectId, compact = false }: { projectId?: string; compact?: boolean }) {
  const [orders, setOrders] = useState<PurchaseOrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<{ id: string | null } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/crm/purchase-orders${projectId ? `?projectId=${projectId}` : ''}`, { credentials: 'include' });
      const body = await r.json();
      setOrders(body.purchaseOrders ?? []);
      setSetupError(body.setupError ?? (r.ok ? null : body.error ?? null));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    // Opened from a link (?po=<id>).
    const id = new URLSearchParams(window.location.search).get('po');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on open / reset when the input clears
    if (id && !projectId) setOpen({ id });
  }, [load, projectId]);

  const q = search.trim().toLowerCase();
  const shown = orders.filter((po) => {
    if (filter === 'open' && !OPEN.includes(po.status)) return false;
    if (filter === 'draft' && po.status !== 'draft') return false;
    if (filter === 'received' && !['received', 'closed'].includes(po.status)) return false;
    if (filter === 'cancelled' && po.status !== 'cancelled') return false;
    if (!q) return true;
    return [po.poNumber, po.supplierName, po.projectName, ...po.lines.map((l) => l.description)].some((v) => v?.toLowerCase().includes(q));
  });
  const openTotal = orders.filter((po) => OPEN.includes(po.status)).reduce((sum, po) => sum + po.totalCents, 0);
  const toArrive = orders.reduce((sum, po) => sum + po.committedCents, 0);

  return (
    <div className="space-y-3">
      {!compact ? (
        <>
          <CRMSearchField value={search} onChange={setSearch} placeholder="Search POs, suppliers, items…" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`rounded-lg px-3 py-1 text-sm ${filter === f.key ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Button onClick={() => setOpen({ id: null })}>
              <Plus className="mr-1 h-4 w-4" /> New PO
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border-2 border-black p-3">
              <p className="text-xs text-gray-500">Open orders</p>
              <p className="text-lg font-bold">{money(openTotal)}</p>
            </div>
            <div className="rounded-lg border-2 border-black p-3">
              <p className="text-xs text-gray-500">Still to arrive</p>
              <p className="text-lg font-bold">{money(toArrive)}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-gray-900">Purchase orders</h3>
          <Button onClick={() => setOpen({ id: null })}>
            <Plus className="mr-1 h-4 w-4" /> Order materials
          </Button>
        </div>
      )}

      {setupError ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{setupError}</p> : null}

      {loading ? (
        <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
      ) : shown.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
          {orders.length ? 'No purchase orders match.' : 'No purchase orders yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border-2 border-black bg-white">
          {shown.map((po) => (
            <li key={po.id}>
              <button type="button" onClick={() => setOpen({ id: po.id })} className="flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{po.poNumber}</span>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${PO_STATUS_CLASS[po.status]}`}>{PO_STATUS_LABEL[po.status]}</span>
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {[po.supplierName ?? 'No supplier', !projectId ? po.projectName : null, po.neededBy ? `Needed ${po.neededBy}` : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-semibold text-gray-900">{money(po.totalCents)}</span>
                  {po.committedCents > 0 ? <span className="block text-xs text-amber-700">{money(po.committedCents)} to arrive</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <PurchaseOrderEditor poId={open.id} projectId={projectId ?? null} onClose={() => setOpen(null)} onChanged={() => void load()} />
      ) : null}
    </div>
  );
}
