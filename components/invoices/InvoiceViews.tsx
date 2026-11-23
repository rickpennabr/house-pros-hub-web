'use client';

import { useEffect, useState } from 'react';
import { BellRing, Eye, FileText, Mail, Pencil, UserRound } from 'lucide-react';
import {
  InvoiceTemplate,
  type InvoiceTemplateBusiness,
  type InvoiceTemplateCustomer,
  type InvoiceTemplateInvoice,
} from '@/components/invoices/InvoiceTemplate';
import { resolveInvoiceDueDate } from '@/lib/invoices/invoiceDueOnReceipt';
import { invoiceDueState } from '@/lib/invoices/dueState';

/** Edit plus the three ways the customer meets the invoice (like QuickBooks). */
export const INVOICE_VIEWS = [
  { id: 'edit', label: 'Edit invoice', icon: Pencil },
  { id: 'email', label: 'Email view', icon: Mail },
  { id: 'reminder', label: 'Reminder email', icon: BellRing },
  { id: 'payor', label: 'Payor view', icon: UserRound },
  { id: 'pdf', label: 'PDF view', icon: FileText },
] as const;
export type InvoiceView = (typeof INVOICE_VIEWS)[number]['id'];

const money = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);

function longDate(iso: string | null) {
  if (!iso) return '—';
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Tab bar under the invoice title. Same black active tab as My Places and the customer portal. */
export function InvoiceViewTabs({
  view,
  onChange,
  firstLabel,
}: {
  view: InvoiceView;
  onChange: (view: InvoiceView) => void;
  /** Name of the first tab. "Edit" in the editor; the saved invoice page calls it "Invoice". */
  firstLabel?: string;
}) {
  return (
    <div className="no-print mb-3 overflow-x-auto" role="tablist" aria-label="Invoice views">
      <div className="flex h-10 w-max items-center gap-2">
        {INVOICE_VIEWS.map((item) => {
          const selected = view === item.id;
          const Icon = item.icon;
          const label = item.id === 'edit' && firstLabel ? firstLabel : item.label;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(item.id)}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg border-2 px-3 text-sm font-medium transition-colors ${
                selected ? 'border-black bg-black text-white' : 'border-transparent text-black hover:border-gray-400'
              }`}
            >
              <Icon className="h-[1.125rem] w-[1.125rem] text-red-500" aria-hidden />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PreviewProps {
  view: Exclude<InvoiceView, 'edit'>;
  invoice: InvoiceTemplateInvoice;
  customer: InvoiceTemplateCustomer;
  business: InvoiceTemplateBusiness;
  themeColor: string;
  locale: string;
}

/** What the customer gets, built from the invoice as it is on screen now (saved or not). */
export function InvoiceViewPreview(props: PreviewProps) {
  const { view } = props;
  const note =
    view === 'email'
      ? 'The email the customer gets when you send this invoice.'
      : view === 'reminder'
        ? 'The payment reminder the customer gets once this invoice is due (Send reminder).'
      : view === 'payor'
        ? 'The page the customer opens from the email link to view and pay.'
        : 'The PDF the customer downloads or you print.';
  return (
    <div className="space-y-2" role="tabpanel">
      <p className="flex items-center gap-1.5 text-xs text-gray-600">
        <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {note} Preview only: nothing is sent from here.
      </p>
      {view === 'email' ? <EmailView {...props} /> : view === 'reminder' ? <ReminderView {...props} /> : view === 'payor' ? <PayorView {...props} /> : <PdfView {...props} />}
    </div>
  );
}

function EmailView({ invoice, business, themeColor, locale }: PreviewProps) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The real email template, loaded only when this tab opens.
    import('@/lib/utils/emailTemplates').then(({ generateInvoiceEmail }) => {
      if (cancelled) return;
      const viewUrl = `${window.location.origin}/${locale}/invoices/view?token=…`;
      const page = generateInvoiceEmail({
        businessName: business.business_name || 'Your business',
        invoiceNumber: invoice.invoice_number,
        amountCents: invoice.amount_cents,
        balanceCents: invoice.amount_cents - (invoice.payment_applied_cents ?? 0),
        viewUrl,
        message: 'The message you write when you send will go here.',
        logoUrl: business.business_logo ?? null,
        themeColor,
        businessAddress: business.address ?? null,
        businessEmail: business.email ?? null,
        businessPhone: business.phone ?? null,
        businessWebsite: business.website ?? null,
        footerText: business.invoice_footer ?? null,
      });
      // Links in the preview do nothing.
      setHtml(page.replace('<head>', '<head><base target="_blank"><style>a{pointer-events:none}</style>'));
    });
    return () => {
      cancelled = true;
    };
  }, [business, themeColor, invoice.amount_cents, invoice.payment_applied_cents, invoice.invoice_number, locale]);

  return (
    <div className="overflow-hidden rounded-lg border-2 border-black bg-gray-100">
      <div className="border-b border-gray-300 bg-white px-4 py-2 text-sm">
        <p>
          <span className="text-gray-500">Subject: </span>
          <span className="font-medium">
            Invoice #{invoice.invoice_number} from {business.business_name || 'Your business'}
          </span>
        </p>
      </div>
      {html ? (
        <iframe title="Invoice email" srcDoc={html} sandbox="" className="block h-[560px] w-full bg-white" />
      ) : (
        <p className="p-6 text-sm text-gray-500">Loading…</p>
      )}
    </div>
  );
}

function ReminderView({ invoice, customer, business, themeColor, locale }: PreviewProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const balance = Math.max(0, invoice.amount_cents - (invoice.payment_applied_cents ?? 0));
  const state = invoiceDueState(invoice);
  // Show it as late even before it is, so the pro sees the real wording.
  const daysOverdue = state.kind === "overdue" ? state.daysOverdue : 1;
  const dueDate = state.dueDate ?? invoice.invoice_date;
  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || null;

  useEffect(() => {
    let cancelled = false;
    import("@/lib/utils/emailTemplates").then(({ generateInvoiceReminderEmail, invoiceReminderSubject }) => {
      if (cancelled) return;
      const data = {
        businessName: business.business_name || "Your business",
        logoUrl: business.business_logo ?? null,
        themeColor,
        businessPhone: business.phone ?? null,
        businessEmail: business.email ?? null,
        businessAddress: business.address ?? null,
        businessWebsite: business.website ?? null,
        footerText: business.invoice_footer ?? null,
        customerName,
        invoiceNumber: invoice.invoice_number,
        balanceCents: balance,
        dueDateLabel: longDate(dueDate),
        daysOverdue,
        viewUrl: `${window.location.origin}/${locale}/invoices/view?token=…`,
        paymentInstructions: "Your “Other ways to pay” from invoice settings go here (e.g. Zelle).",
        message: "Your reminder note goes here.",
      };
      setSubject(invoiceReminderSubject(data));
      setHtml(generateInvoiceReminderEmail(data).replace("<head>", "<head><style>a{pointer-events:none}</style>"));
    });
    return () => {
      cancelled = true;
    };
  }, [business, themeColor, customerName, invoice.invoice_number, balance, dueDate, daysOverdue, locale]);

  return (
    <div className="overflow-hidden rounded-lg border-2 border-black bg-gray-100">
      <div className="border-b border-gray-300 bg-white px-4 py-2 text-sm">
        <span className="text-gray-500">Subject: </span>
        <span className="font-medium">{subject}</span>
      </div>
      {html ? (
        <iframe title="Reminder email" srcDoc={html} sandbox="" className="block h-[640px] w-full bg-white" />
      ) : (
        <p className="p-6 text-sm text-gray-500">Loading…</p>
      )}
    </div>
  );
}

function PayorView({ invoice, customer, business, themeColor }: PreviewProps) {
  const balance = Math.max(0, invoice.amount_cents - (invoice.payment_applied_cents ?? 0));
  const due = resolveInvoiceDueDate(invoice.invoice_date, invoice.due_date, invoice.payment_terms);
  return (
    <div className="rounded-lg border-2 border-black bg-gray-100 p-3 md:p-6">
      <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
        <div className="flex flex-col items-center justify-center rounded-lg bg-white p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-gray-500">Balance due</p>
          <p className="text-3xl font-semibold">{money(balance)}</p>
          <button
            type="button"
            disabled
            title="The customer pays here"
            className="mt-4 rounded-lg bg-black px-4 py-2 font-medium text-white opacity-80"
          >
            Pay {money(balance)}
          </button>
        </div>
        <div className="space-y-1 rounded-lg bg-white p-4 text-sm">
          <p className="font-semibold">{business.business_name || 'Your business'}</p>
          {[
            ['Invoice', invoice.invoice_number],
            ['Due date', longDate(due)],
            ['Invoice amount', money(invoice.amount_cents)],
          ].map(([name, value]) => (
            <p key={name} className="flex justify-between gap-3">
              <span className="text-gray-600">{name}</span>
              <span>{value}</span>
            </p>
          ))}
          {business.email ? <p className="pt-2 text-xs text-gray-600">Email: {business.email}</p> : null}
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-white p-2 md:p-4">
        <InvoiceTemplate invoice={invoice} customer={customer} business={business} themeColor={themeColor} forPrint={false} />
      </div>
    </div>
  );
}

function PdfView({ invoice, customer, business, themeColor }: PreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Redraw only when the content changes (callers may pass new objects on every render).
  const docKey = JSON.stringify({ invoice, customer, business, themeColor });

  useEffect(() => {
    let cancelled = false;
    let made: string | null = null;
    const doc = JSON.parse(docKey) as Pick<PreviewProps, 'invoice' | 'customer' | 'business' | 'themeColor'>;
    // Same PDF document the server sends, drawn in the browser from what is on screen.
    Promise.all([import('@react-pdf/renderer'), import('@/components/invoices/InvoicePdfDocument')])
      .then(async ([{ pdf }, { InvoicePdfDocument }]) => {
        const blob = await pdf(
          <InvoicePdfDocument invoice={doc.invoice} customer={doc.customer} business={doc.business} themeColor={doc.themeColor} />
        ).toBlob();
        if (cancelled) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [docKey]);

  if (failed) {
    return (
      <div className="rounded-lg border-2 border-black bg-white p-2 md:p-4">
        <p className="mb-2 text-xs text-gray-600">The PDF could not be drawn here, so this is the printable invoice.</p>
        <InvoiceTemplate invoice={invoice} customer={customer} business={business} themeColor={themeColor} forPrint />
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border-2 border-black bg-gray-100">
      {url ? (
        <iframe title="Invoice PDF" src={url} className="block h-[80vh] min-h-[560px] w-full" />
      ) : (
        <p className="p-6 text-sm text-gray-500">Making the PDF…</p>
      )}
    </div>
  );
}
