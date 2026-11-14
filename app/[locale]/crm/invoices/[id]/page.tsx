'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Pencil, Printer, Download, Send, FileText, Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { InvoiceTemplate } from '@/components/invoices/InvoiceTemplate';
import { InvoiceCompanyEditor } from '@/components/invoices/InvoiceCompanyEditor';
import { InvoiceLedger, type LedgerEvent, type LedgerPayment } from '@/components/crm/InvoiceLedger';
import type { ProInvoiceStatus } from '@/lib/crm/invoice-books';
import type { InvoiceTemplateInvoice, InvoiceTemplateCustomer, InvoiceTemplateBusiness } from '@/components/invoices/InvoiceTemplate';
import type { CompanyDisplayOverride } from '@/lib/invoices/companyDisplay';

export default function CRMInvoiceDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const id = params?.id as string | undefined;
  const printRef = useRef<HTMLDivElement>(null);

  const [sendOpen, setSendOpen] = useState(false);
  const [sendDialogStep, setSendDialogStep] = useState<'preview' | 'compose' | 'confirm'>('preview');
  const [sendMessage, setSendMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [companyEditorOpen, setCompanyEditorOpen] = useState(false);
  const [companySaving, setCompanySaving] = useState(false);
  const [data, setData] = useState<{
    invoice: InvoiceTemplateInvoice;
    customer: InvoiceTemplateCustomer | null;
    business: InvoiceTemplateBusiness | null;
    themeColorHex: string;
    customerEmail: string | null;
    attachments: { id: string; fileName: string; url: string; fileSizeBytes: number; contentType: string }[];
    payments: LedgerPayment[];
    events: LedgerEvent[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const openSendFromQuery = useRef(false);
  useEffect(() => {
    if (!id) return;
    const url = typeof window !== 'undefined' ? window.location.search : '';
    openSendFromQuery.current = url.includes('send=1');
    fetch(`/api/crm/invoices/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        const themeColor = res.themeColorHex ?? '#000000';
        setData({
          invoice: {
            invoice_number: res.invoiceNumber,
            amount_cents: res.amountCents,
            payment_applied_cents: res.paymentAppliedCents,
            line_items: res.lineItems,
            status: res.status as ProInvoiceStatus,
            invoice_date: res.invoiceDate,
            due_date: res.dueDate,
            payment_terms: res.paymentTerms,
            note: res.note,
          },
          customer: res.customer,
          business: res.business,
          themeColorHex: themeColor,
          customerEmail: typeof res.customerEmail === 'string' ? res.customerEmail : null,
          attachments: res.attachments ?? [],
          payments: res.payments ?? [],
          events: res.events ?? [],
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!data || !openSendFromQuery.current) return;
    setSendOpen(true);
    openSendFromQuery.current = false;
    if (typeof window !== 'undefined' && window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }
  }, [data]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    window.open(`/api/crm/invoices/${id}/pdf`, '_blank', 'noopener');
  };

  const refetchInvoice = async () => {
    if (!id || !data) return;
    const resData = await fetch(`/api/crm/invoices/${id}`, { credentials: 'include' }).then((r) => r.json());
    if (resData.error) throw new Error(resData.error);
    setData({
      ...data,
      business: resData.business ?? data.business,
      invoice: {
        ...data.invoice,
        status: (resData.status as ProInvoiceStatus) ?? data.invoice.status,
        payment_applied_cents: resData.paymentAppliedCents ?? data.invoice.payment_applied_cents,
        amount_cents: resData.amountCents ?? data.invoice.amount_cents,
      },
      customerEmail: typeof resData.customerEmail === 'string' ? resData.customerEmail : data.customerEmail,
      attachments: resData.attachments ?? data.attachments,
      payments: resData.payments ?? data.payments,
      events: resData.events ?? data.events,
    });
  };

  const handleSaveCompany = async (values: CompanyDisplayOverride) => {
    if (!id) return;
    setCompanySaving(true);
    try {
      const res = await fetch(`/api/crm/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ companyDisplay: values }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update');
      }
      await refetchInvoice();
      setCompanyEditorOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCompanySaving(false);
    }
  };

  const handleResetCompany = async () => {
    if (!id) return;
    setCompanySaving(true);
    try {
      const res = await fetch(`/api/crm/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ companyDisplay: null }),
      });
      if (!res.ok) throw new Error('Failed to reset');
      await refetchInvoice();
      setCompanyEditorOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setCompanySaving(false);
    }
  };

  const handleSendInvoice = async () => {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/crm/invoices/${id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: sendMessage.trim() || undefined }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Failed to send');
      setSendOpen(false);
      setSendMessage('');
      setSendDialogStep('preview');
      if (data && data.invoice.status === 'draft') {
        setData({ ...data, invoice: { ...data.invoice, status: 'sent' } });
      }
      await refetchInvoice();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  if (!id) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>Invoice ID missing.</p>
        <Link href={`/${locale}/crm/invoices`} className="text-black underline mt-2 inline-block">Back to Invoices</Link>
      </div>
    );
  }

  if (loading) {
    return <div className="p-12 text-center text-gray-500 text-sm">Loading invoice…</div>;
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error ?? 'Invoice not found.'}</p>
        <Link href={`/${locale}/crm/invoices`} className="text-black underline mt-2 inline-block">Back to Invoices</Link>
      </div>
    );
  }

  const { invoice, customer, business, themeColorHex, attachments, customerEmail, payments, events } = data;
  const displayCustomer: InvoiceTemplateCustomer = customer ?? {
    first_name: '',
    last_name: '',
    billing_address: null,
  };
  const displayBusiness: InvoiceTemplateBusiness = business ?? {
    business_name: 'My Business',
    address: null,
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 py-2 mb-6 no-print">
        <Link
          href={`/${locale}/crm/invoices`}
          className="flex items-center gap-2 text-gray-700 hover:text-black font-medium"
        >
          <ArrowLeft className="w-5 h-5 shrink-0" />
          Back to Invoices
        </Link>
        <div className="flex items-center gap-2">
          {invoice.status === 'draft' && (
            <>
              <Link href={`/${locale}/crm/invoices/${id}/edit`}>
                <Button variant="secondary" size="sm" className="flex items-center gap-2">
                  <Pencil className="w-4 h-4" />
                  Edit invoice
                </Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={() => setCompanyEditorOpen(true)} className="flex items-center gap-2">
                Edit company information
              </Button>
            </>
          )}
          {invoice.status !== 'cancelled' && invoice.amount_cents - (invoice.payment_applied_cents ?? 0) > 0 && (
            <Button
              variant="secondary"
              size="sm"
              disabled={linking}
              onClick={() => {
                setLinking(true);
                setLinkNote(null);
                void fetch(`/api/crm/invoices/${id}/payment-link`, { method: 'POST', credentials: 'include' })
                  .then(async (res) => {
                    const payload = (await res.json()) as { url?: string; error?: string };
                    if (!res.ok || !payload.url) throw new Error(payload.error || 'Could not create a payment link');
                    await navigator.clipboard.writeText(payload.url);
                    setLinkNote('Payment link copied');
                  })
                  .catch((err: unknown) => {
                    setLinkNote(err instanceof Error ? err.message : 'Could not create a payment link');
                  })
                  .finally(() => setLinking(false));
              }}
            >
              {linking ? 'Creating link…' : 'Payment link'}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadPDF} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
          {invoice.status !== 'cancelled' && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSendDialogStep('preview');
              setSendError(null);
              setSendOpen(true);
            }}
            className="flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send invoice
          </Button>
          )}
        </div>
        {linkNote ? <p className="mt-2 text-sm text-gray-700">{linkNote}</p> : null}
      </div>

      <Modal
        isOpen={sendOpen}
        onClose={() => {
          if (sending) return;
          setSendOpen(false);
          setSendDialogStep('preview');
          setSendError(null);
        }}
        showHeader={false}
        showCloseButton
        maxWidth={sendDialogStep === 'preview' ? 'full' : 'sm'}
        overlayClassName={sendDialogStep === 'preview' ? 'md:!p-2 lg:!p-4' : ''}
        className={
          sendDialogStep === 'preview' ? '!max-w-[min(100vw-1rem,96rem)] w-full' : ''
        }
        preventCloseOnOverlayClick={sending}
        contentClassName={sendDialogStep === 'preview' ? 'p-4 md:p-6 overflow-y-auto max-h-[calc(90vh-2rem)]' : 'p-6'}
      >
        <div className="relative">
          {sending && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 rounded-lg min-h-[100px]">
              <Loader2 className="w-10 h-10 text-gray-900 animate-spin" aria-hidden />
              <p className="text-sm font-medium text-gray-900">Sending email…</p>
            </div>
          )}
          {sendDialogStep === 'preview' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Review & Send</h2>
              <p className="text-sm text-gray-600 mb-4">
                This matches what your customer sees on the public invoice link. Continue to add an optional message and send the email.
              </p>
              <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <strong>Customer preview</strong> — Same layout as the link they receive by email.
              </div>
              <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden bg-white">
                <InvoiceTemplate
                  invoice={invoice}
                  customer={displayCustomer}
                  business={displayBusiness}
                  themeColor={themeColorHex}
                  forPrint={false}
                />
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSendOpen(false)} disabled={sending}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={() => setSendDialogStep('compose')} disabled={sending}>
                  Continue to email
                </Button>
              </div>
            </>
          )}
          {sendDialogStep === 'compose' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Email to customer</h2>
              <p className="text-sm text-gray-600 mb-4">Optional note included in the email with the view link.</p>
              <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <span className="text-gray-500">To </span>
                <span className="font-medium text-gray-900 break-all">{customerEmail || '—'}</span>
              </div>
              {!customerEmail && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
                  Add an email address on this customer before sending.
                </p>
              )}
              <label className="block text-sm font-medium text-gray-700 mb-1">Optional message</label>
              <Input
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                placeholder="Add a short message to the email..."
                className="mb-4"
                disabled={sending}
              />
              {sendError && <p className="text-red-600 text-sm mb-4">{sendError}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSendDialogStep('preview')} disabled={sending}>
                  Back to preview
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSendOpen(false)} disabled={sending}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSendDialogStep('confirm')}
                  disabled={sending || !customerEmail}
                >
                  Continue
                </Button>
              </div>
            </>
          )}
          {sendDialogStep === 'confirm' && (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Send invoice</h2>
              <p className="text-sm text-gray-700 mb-4">
                Send this invoice now to <strong className="break-all">{customerEmail}</strong>? The customer will receive an email with a link that matches the preview you saw.
              </p>
              {sendError && <p className="text-red-600 text-sm mb-4">{sendError}</p>}
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSendDialogStep('compose')} disabled={sending}>
                  Back
                </Button>
                <Button variant="primary" size="sm" onClick={handleSendInvoice} disabled={sending || !customerEmail}>
                  {sending ? 'Sending…' : 'Send email'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <div ref={printRef} className="max-w-4xl mx-auto">
        <InvoiceTemplate
          invoice={invoice}
          customer={displayCustomer}
          business={displayBusiness}
          themeColor={themeColorHex}
          forPrint={false}
        />
        <InvoiceLedger
          invoiceId={id}
          status={invoice.status}
          amountCents={invoice.amount_cents}
          payments={payments}
          events={events}
          onChanged={refetchInvoice}
        />
        {attachments.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-200 no-print">
            <p className="text-xs font-semibold uppercase text-gray-600 mb-2">Attachments</p>
            <ul className="space-y-2">
              {attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-gray-800 hover:underline"
                  >
                    {a.contentType === 'application/pdf' ? (
                      <FileText className="w-4 h-4 shrink-0 text-red-600" />
                    ) : (
                      <Image className="w-4 h-4 shrink-0 text-gray-500" />
                    )}
                    {a.fileName}
                    <span className="text-gray-400 text-xs">
                      ({(a.fileSizeBytes / 1024).toFixed(1)} KB)
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {invoice.status === 'draft' && (
        <InvoiceCompanyEditor
          isOpen={companyEditorOpen}
          onClose={() => setCompanyEditorOpen(false)}
          initialValues={displayBusiness}
          onSave={handleSaveCompany}
          onResetToDefault={handleResetCompany}
          saving={companySaving}
        />
      )}
    </div>
  );
}
