import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { loadInvoiceEmailBranding } from '@/lib/invoices/reminder';
import { brandedEmail, emailMoneyText, escapeEmail } from '@/lib/email/branded-layout';
import { getResendClient, getResendFromEmail } from '@/lib/utils/resend';
import { getPublicSiteUrlForEmail } from '@/lib/utils/publicSiteUrl';
import { loadPoLines, loadPoNames, PO_COLUMNS, type PoRow } from '@/lib/crm/purchase-orders-db';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/crm/purchase-orders/[id]/send { email?, message?, emailIt? }
 * Makes the supplier link and marks the PO sent. Emails the supplier unless emailIt is false
 * (ordered by phone: the pro just marks it sent).
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    if (scope.isCrew) return NextResponse.json({ error: 'Owners only' }, { status: 403 });
    const db = scope.supabase;
    const { data } = await db.from('pro_crm_purchase_orders').select(PO_COLUMNS).eq('owner_id', scope.ownerId).eq('id', (await params).id).maybeSingle();
    const po = data as PoRow | null;
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    if (po.status === 'cancelled' || po.status === 'closed') return NextResponse.json({ error: 'This purchase order is closed' }, { status: 400 });

    const lines = (await loadPoLines(db, scope.ownerId, [po.id])).get(po.id) ?? [];
    if (!lines.length) return NextResponse.json({ error: 'Add at least one item before sending' }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as { email?: string; message?: string; emailIt?: boolean };
    const names = await loadPoNames(db, scope.ownerId, [po]);
    const supplier = po.supplier_id ? names.supplier.get(po.supplier_id) : undefined;
    const emailIt = body.emailIt !== false;
    const to = (body.email || supplier?.email || '').trim();
    if (emailIt && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ error: 'Add the supplier’s email, or mark it as ordered by phone' }, { status: 400 });
    }

    const token = po.share_token || randomBytes(24).toString('base64url');
    const nextStatus = po.status === 'draft' ? 'sent' : po.status;
    const { error: updErr } = await db
      .from('pro_crm_purchase_orders')
      .update({ share_token: token, status: nextStatus, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('owner_id', scope.ownerId)
      .eq('id', po.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    const url = `${getPublicSiteUrlForEmail(request)}/en/po/${token}`;
    if (emailIt) {
      const brand = await loadInvoiceEmailBranding(db as never, scope.ownerId, scope.businessId, null);
      const rows = lines
        .map(
          (line) =>
            `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${escapeEmail(line.description)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">${line.quantity} ${escapeEmail(line.unit)}</td></tr>`
        )
        .join('');
      const html = brandedEmail({
        brand,
        heading: `Purchase order ${po.po_number}`,
        subheading: `From ${brand.businessName}`,
        highlight: po.total_cents > 0 ? { label: 'Order total', value: emailMoneyText(Number(po.total_cents)) } : null,
        paragraphs: [body.message?.trim() || 'Please confirm this order and the delivery date.'],
        bodyHtml: `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>`,
        details: [
          ...(po.needed_by ? [{ label: 'Needed by', value: po.needed_by }] : []),
          ...(po.delivery_address ? [{ label: 'Deliver to', value: po.delivery_address }] : []),
        ],
        button: { label: 'View and confirm', url },
        preheader: `Purchase order ${po.po_number} from ${brand.businessName}`,
      });
      const { error: sendErr } = await getResendClient().emails.send({
        from: getResendFromEmail(),
        to,
        replyTo: brand.businessEmail || undefined,
        subject: `Purchase order ${po.po_number} from ${brand.businessName}`,
        html,
      });
      if (sendErr) return NextResponse.json({ error: sendErr.message, url }, { status: 502 });
    }
    return NextResponse.json({ ok: true, url, status: nextStatus, emailed: emailIt });
  } catch (err) {
    console.error('POST /api/crm/purchase-orders/[id]/send', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
