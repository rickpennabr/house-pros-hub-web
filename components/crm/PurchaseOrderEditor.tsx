'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, PackageCheck, Plus, Send, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { canEditLines, canReceive, type PoStatus } from '@/lib/crm/purchase-orders';
import { PickerSelect } from '@/components/ui/PickerSelect';

export interface PurchaseOrderView {
  id: string;
  poNumber: string;
  status: PoStatus;
  supplierId: string | null;
  supplierName: string | null;
  supplierEmail: string | null;
  projectId: string | null;
  projectName: string | null;
  orderDate: string;
  neededBy: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  taxCents: number;
  shippingCents: number;
  subtotalCents: number;
  totalCents: number;
  committedCents: number;
  sentAt: string | null;
  confirmedAt: string | null;
  lines: { id: string; description: string; quantity: number; unit: string; unitPriceCents: number; materialId: string | null; receivedQty: number }[];
}

interface LineDraft {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  price: string;
  materialId: string | null;
}

interface Option {
  id: string;
  label: string;
}

interface ProjectMaterial {
  id: string;
  name: string;
  unit: string;
  remainingQty: number;
}

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  confirmed: 'Confirmed',
  partial: 'Partly received',
  received: 'Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const PO_STATUS_CLASS: Record<PoStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-indigo-50 text-indigo-700',
  partial: 'bg-amber-50 text-amber-700',
  received: 'bg-green-50 text-green-700',
  closed: 'bg-gray-200 text-gray-700',
  cancelled: 'bg-red-50 text-red-700',
};

export const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const toDraft = (line: PurchaseOrderView['lines'][number]): LineDraft => ({
  key: line.id,
  description: line.description,
  quantity: String(line.quantity),
  unit: line.unit,
  price: line.unitPriceCents ? (line.unitPriceCents / 100).toFixed(2) : '',
  materialId: line.materialId,
});

async function call(url: string, method: string, body?: unknown) {
  const r = await fetch(url, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

/**
 * Create or open a purchase order: supplier, project, items, then send, receive, close.
 * Pass poId to open one, or projectId to start a new one for that project.
 */
export function PurchaseOrderEditor({
  poId,
  projectId: startProjectId,
  onClose,
  onChanged,
}: {
  poId: string | null;
  projectId?: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [po, setPo] = useState<PurchaseOrderView | null>(null);
  const [loading, setLoading] = useState(Boolean(poId));
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [projects, setProjects] = useState<Option[]>([]);
  const [materials, setMaterials] = useState<ProjectMaterial[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [projectId, setProjectId] = useState(startProjectId ?? '');
  const [neededBy, setNeededBy] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [tax, setTax] = useState('');
  const [shipping, setShipping] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([{ key: newKey(), description: '', quantity: '', unit: 'Each', price: '', materialId: null }]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [receivedOn, setReceivedOn] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    if (!poId) return;
    setLoading(true);
    try {
      const data = await call(`/api/crm/purchase-orders/${poId}`, 'GET');
      const view = data.purchaseOrder as PurchaseOrderView;
      setPo(view);
      setSupplierId(view.supplierId ?? '');
      setProjectId(view.projectId ?? '');
      setNeededBy(view.neededBy ?? '');
      setAddress(view.deliveryAddress ?? '');
      setNotes(view.notes ?? '');
      setTax(view.taxCents ? (view.taxCents / 100).toFixed(2) : '');
      setShipping(view.shippingCents ? (view.shippingCents / 100).toFixed(2) : '');
      setLines(view.lines.length ? view.lines.map(toDraft) : [{ key: newKey(), description: '', quantity: '', unit: 'Each', price: '', materialId: null }]);
      setSendEmail(view.supplierEmail ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load');
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on open / reset when the input clears
    void load();
  }, [load]);

  useEffect(() => {
    void fetch('/api/crm/customers?pageSize=500&role=supplier', { credentials: 'include' })
      .then((r) => r.json())
      .then((body: { customers?: { id: string }[] }) =>
        setSuppliers((body.customers ?? []).map((c) => ({ id: c.id, label: contactDisplayName(c as never) })))
      )
      .catch(() => setSuppliers([]));
    void fetch('/api/crm/projects?pageSize=100', { credentials: 'include' })
      .then((r) => r.json())
      .then((body: { projects?: { id: string; name: string }[] }) => setProjects((body.projects ?? []).map((p) => ({ id: p.id, label: p.name }))))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load on open / reset when the input clears
      setMaterials([]);
      return;
    }
    void fetch(`/api/crm/projects/${projectId}/materials`, { credentials: 'include' })
      .then((r) => r.json())
      .then((body: { materials?: ProjectMaterial[] }) => setMaterials(body.materials ?? []))
      .catch(() => setMaterials([]));
  }, [projectId]);

  const status: PoStatus = po?.status ?? 'draft';
  const editable = canEditLines(status);
  const cents = (value: string) => Math.max(0, Math.round((Number(value.replace(',', '.')) || 0) * 100));
  const filled = lines.filter((line) => line.description.trim() && Number(line.quantity.replace(',', '.')) > 0);
  const subtotal = filled.reduce((sum, line) => sum + Math.round(Number(line.quantity.replace(',', '.')) * cents(line.price)), 0);
  const total = subtotal + cents(tax) + cents(shipping);

  const payload = () => ({
    supplierId: supplierId || null,
    projectId: projectId || null,
    neededBy: neededBy || null,
    deliveryAddress: address,
    notes,
    taxCents: cents(tax),
    shippingCents: cents(shipping),
    lines: filled.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unitPriceCents: cents(line.price),
      materialId: line.materialId,
    })),
  });

  /** Save, creating the PO the first time. Returns its id. */
  const save = async (): Promise<string | null> => {
    setError(null);
    if (!filled.length) {
      setError('Add at least one item with a quantity.');
      return null;
    }
    setBusy('save');
    try {
      if (po) {
        const body = payload();
        if (!editable) {
          const { lines: _lines, taxCents: _t, shippingCents: _s, ...rest } = body;
          void _lines; void _t; void _s;
          await call(`/api/crm/purchase-orders/${po.id}`, 'PATCH', rest);
        } else {
          await call(`/api/crm/purchase-orders/${po.id}`, 'PATCH', body);
        }
        onChanged();
        return po.id;
      }
      const created = await call('/api/crm/purchase-orders', 'POST', payload());
      const data = await call(`/api/crm/purchase-orders/${created.id}`, 'GET');
      setPo(data.purchaseOrder);
      onChanged();
      return created.id as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const refresh = async (id: string) => {
    const data = await call(`/api/crm/purchase-orders/${id}`, 'GET');
    setPo(data.purchaseOrder);
    onChanged();
  };

  const send = async (emailIt: boolean) => {
    const id = await save();
    if (!id) return;
    setBusy('send');
    setError(null);
    try {
      const data = await call(`/api/crm/purchase-orders/${id}/send`, 'POST', { email: sendEmail, message: sendMessage, emailIt });
      setLink(data.url);
      setSendOpen(false);
      await refresh(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send');
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (next: PoStatus) => {
    if (!po) return;
    setBusy(next);
    setError(null);
    try {
      await call(`/api/crm/purchase-orders/${po.id}`, 'PATCH', { status: next });
      await refresh(po.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(null);
    }
  };

  const receive = async () => {
    if (!po) return;
    setBusy('receive');
    setError(null);
    try {
      await call(`/api/crm/purchase-orders/${po.id}/receive`, 'POST', {
        receivedOn,
        lines: Object.entries(receiveQty).map(([lineId, qty]) => ({ lineId, quantity: Number(qty.replace(',', '.')) || 0 })),
      });
      setReceiveOpen(false);
      setReceiveQty({});
      await refresh(po.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not receive');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!po || !window.confirm(`Delete ${po.poNumber}?`)) return;
    setBusy('delete');
    try {
      await call(`/api/crm/purchase-orders/${po.id}`, 'DELETE');
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
      setBusy(null);
    }
  };

  const addFromMaterial = (material: ProjectMaterial) => {
    setLines((current) => [
      ...current.filter((line) => line.description.trim()),
      {
        key: newKey(),
        description: material.name,
        quantity: material.remainingQty > 0 ? String(material.remainingQty) : '',
        unit: material.unit,
        price: '',
        materialId: material.id,
      },
    ]);
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const textareaClass = 'w-full rounded-lg border-2 border-black p-2 text-sm';
  const unusedMaterials = materials.filter((m) => !lines.some((line) => line.materialId === m.id));

  return (
    <Modal
      isOpen
      onClose={onClose}
      maxWidth="2xl"
      title={
        <span className="flex items-center gap-2">
          {po ? po.poNumber : 'New purchase order'}
          {po ? <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${PO_STATUS_CLASS[status]}`}>{PO_STATUS_LABEL[status]}</span> : null}
        </span>
      }
    >
      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="space-y-4 p-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Supplier">
              <PickerSelect
                value={supplierId}
                onChange={(value) => {
                setSupplierId(value);
                if (!po) setSendEmail('');
              }}
                placeholder={"Pick a supplier"}
                options={suppliers.map((s) => ({ value: String(s.id), label: String(s.label) }))}
              />
            </FormField>
            <FormField label="Project">
              <PickerSelect
                value={projectId}
                onChange={(value) => setProjectId(value)}
                noneLabel={"No project"}
                options={projects.map((p) => ({ value: String(p.id), label: String(p.label) }))}
              />
            </FormField>
            <FormField label="Needed by">
              <Input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </FormField>
            <FormField label="Deliver to">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Job address" maxLength={500} />
            </FormField>
          </div>
          {suppliers.length === 0 ? (
            <p className="text-xs text-gray-500">No suppliers yet: add a contact with the Supplier role in Contacts.</p>
          ) : null}

          {editable && unusedMaterials.length ? (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-2 text-xs font-semibold text-gray-600">Add from this project’s materials</p>
              <div className="flex flex-wrap gap-2">
                {unusedMaterials.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => addFromMaterial(m)}
                    className="rounded-lg border-2 border-black bg-white px-2 py-1 text-xs font-medium hover:bg-gray-100"
                  >
                    + {m.name}{m.remainingQty > 0 ? ` (${m.remainingQty} ${m.unit} to send)` : ''}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Items</p>
            {lines.map((line) => {
              const saved = po?.lines.find((l) => l.id === line.key);
              return (
                <div key={line.key} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-12 sm:col-span-5">
                    <Input
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                      placeholder="Item"
                      disabled={!editable}
                      maxLength={300}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input inputMode="decimal" value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} placeholder="Qty" disabled={!editable} />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input value={line.unit} onChange={(e) => updateLine(line.key, { unit: e.target.value })} placeholder="Unit" disabled={!editable} maxLength={40} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input inputMode="decimal" value={line.price} onChange={(e) => updateLine(line.key, { price: e.target.value })} placeholder="$ each" disabled={!editable} />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => setLines((current) => (current.length > 1 ? current.filter((l) => l.key !== line.key) : current))}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : saved ? (
                      <span className="text-xs text-gray-600">{saved.receivedQty}/{saved.quantity}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {editable ? (
              <Button
                variant="outline"
                onClick={() => setLines((current) => [...current, { key: newKey(), description: '', quantity: '', unit: 'Each', price: '', materialId: null }])}
              >
                <Plus className="mr-1 h-4 w-4" /> Add item
              </Button>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tax ($)">
                <Input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} disabled={!editable} />
              </FormField>
              <FormField label="Delivery ($)">
                <Input inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} disabled={!editable} />
              </FormField>
            </div>
            <div className="space-y-1 self-end text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{money(subtotal)}</span></div>
              <div className="flex justify-between border-t-2 border-black pt-1 font-bold"><span>Total</span><span>{money(total)}</span></div>
              {po && po.committedCents > 0 ? (
                <div className="flex justify-between text-xs text-amber-700"><span>Still to arrive</span><span>{money(po.committedCents)}</span></div>
              ) : null}
            </div>
          </div>

          <FormField label="Notes for the supplier">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} className={textareaClass} />
          </FormField>

          {link ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
              <Check className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{link}</span>
              <button type="button" onClick={() => void navigator.clipboard?.writeText(link)} className="rounded-lg p-1 hover:bg-green-100" aria-label="Copy link">
                <Copy className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {sendOpen ? (
            <div className="space-y-3 rounded-lg border-2 border-black p-3">
              <FormField label="Supplier email">
                <Input type="email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} placeholder="orders@supplier.com" />
              </FormField>
              <FormField label="Message (optional)">
                <textarea value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} rows={2} maxLength={1000} className={textareaClass} placeholder="Please confirm this order and the delivery date." />
              </FormField>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
                <Button variant="outline" onClick={() => void send(false)} disabled={busy !== null}>Ordered by phone</Button>
                <Button onClick={() => void send(true)} disabled={busy !== null}>
                  {busy === 'send' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />} Email PO
                </Button>
              </div>
            </div>
          ) : null}

          {receiveOpen && po ? (
            <div className="space-y-3 rounded-lg border-2 border-black p-3">
              <p className="text-sm font-semibold">What arrived?</p>
              {po.lines.map((line) => {
                const left = Math.max(0, line.quantity - line.receivedQty);
                return (
                  <div key={line.id} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{line.description}</span>
                    <span className="shrink-0 text-xs text-gray-500">{left} {line.unit} left</span>
                    <Input
                      className="w-24"
                      inputMode="decimal"
                      value={receiveQty[line.id] ?? ''}
                      onChange={(e) => setReceiveQty((current) => ({ ...current, [line.id]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                );
              })}
              <div className="flex flex-wrap items-end justify-between gap-2">
                <FormField label="Received on">
                  <Input type="date" value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
                </FormField>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setReceiveQty(Object.fromEntries(po.lines.map((l) => [l.id, String(Math.max(0, l.quantity - l.receivedQty))])))
                    }
                  >
                    Everything
                  </Button>
                  <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
                  <Button onClick={() => void receive()} disabled={busy !== null}>
                    {busy === 'receive' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <PackageCheck className="mr-1 h-4 w-4" />} Save delivery
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-500">Saving adds the delivery to the project’s materials and records a Materials expense for it.</p>
            </div>
          ) : null}

          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

          <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 pt-3">
            <div className="flex flex-wrap gap-2">
              {po && (status === 'draft' || status === 'cancelled') ? (
                <Button variant="outline" onClick={() => void remove()} disabled={busy !== null}>Delete</Button>
              ) : null}
              {po && ['draft', 'sent', 'confirmed'].includes(status) ? (
                <Button variant="outline" onClick={() => void setStatus('cancelled')} disabled={busy !== null}>Cancel PO</Button>
              ) : null}
              {po && (status === 'partial' || status === 'received') ? (
                <Button variant="outline" onClick={() => void setStatus('closed')} disabled={busy !== null}>Close</Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void save()} disabled={busy !== null}>
                {busy === 'save' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save
              </Button>
              {status === 'sent' ? (
                <Button variant="outline" onClick={() => void setStatus('confirmed')} disabled={busy !== null}>Mark confirmed</Button>
              ) : null}
              {status === 'draft' || status === 'sent' ? (
                <Button variant={status === 'draft' ? 'primary' : 'outline'} onClick={() => setSendOpen(true)} disabled={busy !== null}>
                  <Send className="mr-1 h-4 w-4" /> {status === 'draft' ? 'Send' : 'Send again'}
                </Button>
              ) : null}
              {po && canReceive(status) ? (
                <Button onClick={() => setReceiveOpen(true)} disabled={busy !== null}>
                  <PackageCheck className="mr-1 h-4 w-4" /> Received
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
