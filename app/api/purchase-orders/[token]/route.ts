import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { loadInvoiceEmailBranding } from '@/lib/invoices/reminder';
import { loadPoLines, PO_COLUMNS, type PoRow } from '@/lib/crm/purchase-orders-db';

type Params = { params: Promise<{ token: string }> };

async function loadByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = createServiceRoleClient();
  const { data } = await db.from('pro_crm_purchase_orders' as never).select(`owner_id, ${PO_COLUMNS}`).eq('share_token', token).maybeSingle();
  return { db, po: data as (PoRow & { owner_id: string }) | null };
}

/** GET /api/purchase-orders/[token] — what the supplier sees (no prices are hidden: it is their order). */
export async function GET(request: NextRequest, { params }: Params) {
  const limited = await checkRateLimit(request, 'chat');
  if (limited) return limited;
  const found = await loadByToken((await params).token);
  if (!found?.po || found.po.status === 'cancelled') return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
  const { db, po } = found;
  const lines = (await loadPoLines(db as never, po.owner_id, [po.id])).get(po.id) ?? [];
  const brand = await loadInvoiceEmailBranding(db as never, po.owner_id, null, null).catch(() => null);
  return NextResponse.json({
    poNumber: po.po_number,
    status: po.status,
    orderDate: po.order_date,
    neededBy: po.needed_by,
    deliveryAddress: po.delivery_address,
    notes: po.notes,
    subtotalCents: Number(po.subtotal_cents),
    taxCents: Number(po.tax_cents),
    shippingCents: Number(po.shipping_cents),
    totalCents: Number(po.total_cents),
    confirmedAt: po.confirmed_at,
    business: brand
      ? { name: brand.businessName, logoUrl: brand.logoUrl, phone: brand.businessPhone, email: brand.businessEmail, address: brand.businessAddress }
      : null,
    lines: lines.map((line) => ({ description: line.description, quantity: line.quantity, unit: line.unit, unitPriceCents: line.unitPriceCents })),
  });
}

/** POST /api/purchase-orders/[token] — the supplier confirms the order. */
export async function POST(request: NextRequest, { params }: Params) {
  const limited = await checkRateLimit(request, 'chat');
  if (limited) return limited;
  const found = await loadByToken((await params).token);
  if (!found?.po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
  const { db, po } = found;
  if (po.status !== 'sent') return NextResponse.json({ ok: true, status: po.status });
  const now = new Date().toISOString();
  const { error } = await db
    .from('pro_crm_purchase_orders' as never)
    .update({ status: 'confirmed', confirmed_at: now, updated_at: now } as never)
    .eq('id', po.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status: 'confirmed' });
}
