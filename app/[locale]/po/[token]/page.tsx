'use client';

import { use, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Printer } from 'lucide-react';

interface PublicPo {
  poNumber: string;
  status: string;
  orderDate: string;
  neededBy: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  confirmedAt: string | null;
  business: { name: string; logoUrl: string | null; phone: string | null; email: string | null; address: string | null } | null;
  lines: { description: string; quantity: number; unit: string; unitPriceCents: number }[];
}

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The supplier's view of a purchase order: read it, print it, confirm it. No account needed. */
export default function PublicPurchaseOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [po, setPo] = useState<PublicPo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    void fetch(`/api/purchase-orders/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || 'Purchase order not found');
        setPo(body as PublicPo);
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  const confirm = async () => {
    setConfirming(true);
    try {
      const r = await fetch(`/api/purchase-orders/${encodeURIComponent(token)}`, { method: 'POST' });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Could not confirm');
      setPo((current) => (current ? { ...current, status: body.status, confirmedAt: new Date().toISOString() } : current));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm');
    } finally {
      setConfirming(false);
    }
  };

  if (error && !po) return <div className="flex min-h-screen items-center justify-center bg-white p-8 text-gray-600">{error}</div>;
  if (!po) return <div className="flex min-h-screen items-center justify-center bg-white p-8 text-gray-500"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const confirmed = po.status !== 'sent';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="invoice-doc mx-auto max-w-2xl space-y-5 rounded-lg border-2 border-black bg-white p-5">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {po.business?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={po.business.logoUrl} alt="" className="mb-2 h-12 w-12 rounded-lg object-contain" />
            ) : null}
            <p className="font-bold text-gray-900">{po.business?.name}</p>
            {po.business?.address ? <p className="whitespace-pre-line text-xs text-gray-600">{po.business.address}</p> : null}
            <p className="text-xs text-gray-600">{[po.business?.phone, po.business?.email].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Purchase order</p>
            <p className="text-xl font-bold text-gray-900">{po.poNumber}</p>
            <p className="text-xs text-gray-600">Ordered {po.orderDate}</p>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {po.neededBy ? (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Needed by</p>
              <p className="font-semibold text-gray-900">{po.neededBy}</p>
            </div>
          ) : null}
          {po.deliveryAddress ? (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Deliver to</p>
              <p className="whitespace-pre-line font-semibold text-gray-900">{po.deliveryAddress}</p>
            </div>
          ) : null}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left text-xs uppercase text-gray-500">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((line, index) => (
              <tr key={index} className="border-b border-gray-100">
                <td className="py-2 pr-2 text-gray-900">{line.description}</td>
                <td className="whitespace-nowrap py-2 text-right">{line.quantity} {line.unit}</td>
                <td className="whitespace-nowrap py-2 text-right">{line.unitPriceCents ? money(line.unitPriceCents) : '—'}</td>
                <td className="whitespace-nowrap py-2 text-right">{line.unitPriceCents ? money(Math.round(line.quantity * line.unitPriceCents)) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {po.totalCents > 0 ? (
          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{money(po.subtotalCents)}</span></div>
            {po.taxCents ? <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>{money(po.taxCents)}</span></div> : null}
            {po.shippingCents ? <div className="flex justify-between"><span className="text-gray-600">Delivery</span><span>{money(po.shippingCents)}</span></div> : null}
            <div className="flex justify-between border-t-2 border-black pt-1 font-bold"><span>Total</span><span>{money(po.totalCents)}</span></div>
          </div>
        ) : null}

        {po.notes ? <p className="whitespace-pre-line rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{po.notes}</p> : null}

        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          <button type="button" onClick={() => window.print()} className="flex items-center gap-1 rounded-lg border-2 border-black px-4 py-2 text-sm font-semibold">
            <Printer className="h-4 w-4" /> Print
          </button>
          {confirmed ? (
            <span className="flex items-center gap-1 rounded-lg bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
              <CheckCircle2 className="h-4 w-4" /> Order confirmed
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={confirming}
              className="flex items-center gap-1 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm order
            </button>
          )}
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
