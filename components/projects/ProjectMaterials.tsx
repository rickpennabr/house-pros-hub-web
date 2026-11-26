'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, Truck, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { MATERIAL_UNITS, formatQty } from '@/lib/crm/project-materials';

interface Delivery {
  id: string;
  deliveredOn: string;
  quantity: number;
  source: string | null;
  note: string | null;
  by: string | null;
}

interface Material {
  id: string;
  name: string;
  unit: string;
  note: string | null;
  plannedQty: number;
  /** Quantity on the estimate (ProQuote); null when the material was added on the project. */
  estimatedQty: number | null;
  deliveredQty: number;
  remainingQty: number;
  extraQty: number;
  status: 'not_sent' | 'partial' | 'sent' | 'over';
  deliveries: Delivery[];
}

const STATUS: Record<Material['status'], { label: string; className: string }> = {
  not_sent: { label: 'Not sent', className: 'border-gray-300 text-gray-700' },
  partial: { label: 'Partly sent', className: 'border-amber-500 text-amber-700' },
  sent: { label: 'All sent', className: 'border-green-600 text-green-700' },
  over: { label: 'Sent extra', className: 'border-red-500 text-red-700' },
};

/** Used (sent) against the estimate: "+20 over" in red, "-15 under" in green, nothing until something is sent. */
function VsEstimate({ estimated, used }: { estimated: number; used: number }) {
  if (used <= 0) return null;
  const diff = Math.round((used - estimated) * 100) / 100;
  if (diff === 0) return <span className="block text-xs text-gray-600">on estimate</span>;
  const pct = estimated > 0 ? ` (${Math.round((Math.abs(diff) / estimated) * 100)}%)` : '';
  return diff > 0 ? (
    <span className="block text-xs font-medium text-red-700">+{formatQty(diff)} over{pct}</span>
  ) : (
    <span className="block text-xs font-medium text-green-700">{formatQty(diff)} under{pct}</span>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Materials for a project, any trade: what was planned, each delivery, and what is still to send.
 * Owner and crew can add materials and log deliveries.
 */
export function ProjectMaterials({ projectId, onCount }: { projectId: string; onCount?: (count: number) => void }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState<string>('Pallet');
  const [planned, setPlanned] = useState('');
  const [note, setNote] = useState('');

  const [deliveryFor, setDeliveryFor] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(today());
  const [source, setSource] = useState('');

  const [editing, setEditing] = useState<string | null>(null);
  const [editPlanned, setEditPlanned] = useState('');
  const [editNote, setEditNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/projects/${projectId}/materials`, { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load materials');
      setMaterials(data.materials ?? []);
      setSetupError(data.setupError ?? null);
      onCount?.((data.materials ?? []).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load materials');
    } finally {
      setLoading(false);
    }
  }, [projectId, onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addMaterial = async () => {
    const ok = await send(`/api/crm/projects/${projectId}/materials`, 'POST', { name, unit, plannedQty: planned || '0', note });
    if (ok) {
      setName('');
      setPlanned('');
      setNote('');
    }
  };

  const startDelivery = (material: Material) => {
    setDeliveryFor(material.id);
    setQty(material.remainingQty > 0 ? formatQty(material.remainingQty) : '');
    setDate(today());
    setSource('');
    setOpen(material.id);
  };

  const logDelivery = async (materialId: string) => {
    const ok = await send(`/api/crm/projects/${projectId}/materials/${materialId}/deliveries`, 'POST', { quantity: qty, deliveredOn: date, source });
    if (ok) setDeliveryFor(null);
  };

  const saveEdit = async (materialId: string) => {
    const ok = await send(`/api/crm/projects/${projectId}/materials/${materialId}`, 'PATCH', { plannedQty: editPlanned || '0', note: editNote });
    if (ok) setEditing(null);
  };

  const units = MATERIAL_UNITS as readonly string[];
  const totals = materials.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { not_sent: 0, partial: 0, sent: 0, over: 0 }
  );

  return (
    <div className="space-y-4">
      {setupError ? <p className="rounded-lg border-2 border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">{setupError}</p> : null}

      <div className="rounded-lg border-2 border-black p-3">
        <p className="mb-2 text-sm font-bold">Add material</p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,2fr)_140px_120px_minmax(0,1.5fr)_auto]">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Demi, Sierra Blend" className="col-span-2 md:col-span-1" aria-label="Material" />
          <Select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">
            {units.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
          <Input value={planned} onChange={(e) => setPlanned(e.target.value)} inputMode="decimal" placeholder="Planned qty" aria-label="Planned quantity" />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="col-span-2 md:col-span-1" aria-label="Note" />
          <Button type="button" size="sm" onClick={() => void addMaterial()} disabled={busy || !name.trim() || Boolean(setupError)} className="col-span-2 md:col-span-1">
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-500">Loading materials…</p> : null}
      {!loading && materials.length === 0 && !setupError ? (
        <p className="text-sm text-gray-600">No materials yet. Add what the job needs, then log each delivery as it goes out.</p>
      ) : null}

      {materials.length > 0 ? (
        <>
          <p className="text-sm text-gray-700">
            {materials.length} material{materials.length === 1 ? '' : 's'} · {totals.sent + totals.over} all sent · {totals.partial} partly sent ·{' '}
            {totals.not_sent} not sent
          </p>
          <ul className="space-y-2">
            {materials.map((material) => {
              const expanded = open === material.id;
              const status = STATUS[material.status];
              return (
                <li key={material.id} className="rounded-lg border-2 border-black bg-white">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : material.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      aria-expanded={expanded}
                    >
                      {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{material.name}</span>
                        {material.note ? <span className="block truncate text-xs text-gray-600">{material.note}</span> : null}
                      </span>
                    </button>
                    <div className={`grid gap-4 text-sm tabular-nums ${material.estimatedQty != null ? 'grid-cols-4' : 'grid-cols-3'}`}>
                      {material.estimatedQty != null ? (
                        <span>
                          <span className="block text-xs text-gray-500">Estimated</span>
                          {formatQty(material.estimatedQty)}
                          <VsEstimate estimated={material.estimatedQty} used={material.deliveredQty} />
                        </span>
                      ) : null}
                      <span>
                        <span className="block text-xs text-gray-500">Planned</span>
                        {formatQty(material.plannedQty)} {material.unit}
                      </span>
                      <span>
                        <span className="block text-xs text-gray-500">Sent</span>
                        {formatQty(material.deliveredQty)}
                      </span>
                      <span>
                        <span className="block text-xs text-gray-500">To send</span>
                        <span className={material.remainingQty > 0 ? 'font-bold' : ''}>{formatQty(material.remainingQty)}</span>
                      </span>
                    </div>
                    <span className={`rounded-md border-2 px-2 py-0.5 text-xs font-medium ${status.className}`}>
                      {status.label}
                      {material.extraQty > 0 ? ` +${formatQty(material.extraQty)}` : ''}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="sm" variant="secondary" onClick={() => startDelivery(material)} disabled={busy}>
                        <Truck className="mr-1 h-4 w-4" /> Sent
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(material.id);
                          setEditPlanned(formatQty(material.plannedQty));
                          setEditNote(material.note ?? '');
                          setOpen(material.id);
                        }}
                        className="rounded-md p-1.5 hover:bg-gray-100"
                        aria-label={`Edit ${material.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove ${material.name} and its deliveries?`)) {
                            void send(`/api/crm/projects/${projectId}/materials/${material.id}`, 'DELETE');
                          }
                        }}
                        className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                        aria-label={`Remove ${material.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className="space-y-3 border-t-2 border-black p-3">
                      {editing === material.id ? (
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="text-xs font-medium">
                            Planned ({material.unit})
                            <Input value={editPlanned} onChange={(e) => setEditPlanned(e.target.value)} inputMode="decimal" className="mt-1 w-28" />
                          </label>
                          <label className="min-w-[12rem] flex-1 text-xs font-medium">
                            Note
                            <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} className="mt-1" />
                          </label>
                          <Button type="button" size="sm" onClick={() => void saveEdit(material.id)} disabled={busy}>
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : null}

                      {deliveryFor === material.id ? (
                        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-2">
                          <label className="text-xs font-medium">
                            Quantity sent ({material.unit})
                            <Input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" className="mt-1 w-28" />
                          </label>
                          <label className="text-xs font-medium">
                            Date
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
                          </label>
                          <label className="min-w-[10rem] flex-1 text-xs font-medium">
                            From (yard or supplier)
                            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Yard, Belgard" className="mt-1" />
                          </label>
                          <Button type="button" size="sm" onClick={() => void logDelivery(material.id)} disabled={busy || !qty}>
                            Save delivery
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setDeliveryFor(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : null}

                      {material.deliveries.length === 0 ? (
                        <p className="text-sm text-gray-600">Nothing sent yet.</p>
                      ) : (
                        <ul className="divide-y divide-gray-200 text-sm">
                          {material.deliveries.map((delivery) => (
                            <li key={delivery.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                              <span>
                                <span className="font-medium tabular-nums">
                                  {formatQty(delivery.quantity)} {material.unit}
                                </span>{' '}
                                · {shortDate(delivery.deliveredOn)}
                                {delivery.source ? ` · from ${delivery.source}` : ''}
                                {delivery.by ? <span className="text-gray-500"> · logged by {delivery.by}</span> : null}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  void send(`/api/crm/projects/${projectId}/materials/${material.id}/deliveries?deliveryId=${delivery.id}`, 'DELETE')
                                }
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                              >
                                <Undo2 className="h-3.5 w-3.5" /> Undo
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
