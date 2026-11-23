'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Pencil, Printer, Download, Send, FileText, Image, Loader2, Link2, Tablet, Building2 } from 'lucide-react';
import { BsGrid3X3Gap } from 'react-icons/bs';
import { MobileGridActionsModal } from '@/components/crm/MobileGridActionsModal';
import { invoiceTakesPayLink, payLinkQrDataUrl } from '@/lib/invoices/payLink';
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
  const [presenting, setPresenting] = useState(false);
  const [actionsGridOpen, setActionsGridOpen] = useState(false);
  const [payLink, setPayLink] = useState<{ url: string; qr: string | null } | null>(null);
  /** Came from "Send payment link" on a new contact: show the payment link panel first. */
  const searchParams = useSearchParams();
  const [payDismissed, setPayDismissed] = useState(false);
  const payPanel = searchParams.get('pay') === '1' && !payDismissed;
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

  const openSendDialog = () => {
    setSendDialogStep('preview');
    setSendError(null);
    setSendOpen(true);
  };

  const collectCardOnDevice = () => {
    setPresenting(true);
    setLinkNote(null);
    void createPaymentLinkUrl()
      .then((url) => {
        window.open(`${url}${url.includes('?') ? '&' : '?'}present=1`, '_blank', 'noopener,noreferrer');
        setLinkNote('Opened pay screen — hand the device to the customer for card payment.');
      })
      .catch((err: unknown) => {
        setLinkNote(err instanceof Error ? err.message : 'Could not open payment');
      })
      .finally(() => setPresenting(false));
  };

  // Pay link + QR for the printed copy. Drafts get none: asking for a link marks a draft as sent.
  const payStatus = data?.invoice.status;
  const payBalance = data ? data.invoice.amount_cents - (data.invoice.payment_applied_cents ?? 0) : 0;
  const wantsPayLink = Boolean(payStatus && invoiceTakesPayLink(payStatus, payBalance, 0));
  useEffect(() => {
    if (!wantsPayLink) return;
    let cancelled = false;
    void createPaymentLinkUrl()
      .then(async (url) => {
        const qr = await payLinkQrDataUrl(url).catch(() => null);
        if (!cancelled) setPayLink({ url, qr });
      })
      .catch(() => {
        if (!cancelled) setPayLink(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the invoice or its payability changes
  }, [id, wantsPayLink]);

  const handlePrint = () => {
    // The tab title becomes the "Save as PDF" file name.
    const previousTitle = document.title;
    const number = data?.invoice.invoice_number;
    if (number) document.title = `Invoice ${number}`;
    window.print();
    document.title = previousTitle;
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

  async function createPaymentLinkUrl(): Promise<string> {
    if (!id) throw new Error('Invoice required');
    const res = await fetch(`/api/crm/invoices/${id}/payment-link`, {
      method: 'POST',
      credentials: 'include',
    });
    const payload = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !payload.url) throw new Error(payload.error || 'Could not create a payment link');
    return payload.url;
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

  function copyPaymentLink() {
    setLinking(true);
    setLinkNote(null);
    void createPaymentLinkUrl()
      .then(async (url) => {
        await navigator.clipboard.writeText(url);
        setLinkNote('Payment link copied — text or email it, or open it later.');
      })
      .catch((err: unknown) => {
        setLinkNote(err instanceof Error ? err.message : 'Could not create a payment link');
      })
      .finally(() => setLinking(false));
  }

  const balanceDue = invoice.status !== 'cancelled' && invoice.amount_cents - (invoice.payment_applied_cents ?? 0) > 0;

  return (
    <div className="w-full">
      {payPanel && balanceDue ? (
        <div className="no-print mb-4 rounded-lg border-2 border-black bg-white p-4">
          <p className="font-semibold text-gray-900">Invoice saved. Send the payment link</p>
          <p className="mt-1 text-sm text-gray-600">
            Copy the link and text or email it. The customer opens it, sees the invoice and pays by card. Or use Send invoice to email it with the link.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" disabled={linking} className="flex items-center gap-2" onClick={copyPaymentLink}>
              <Link2 className="w-4 h-4" />
              {linking ? 'Creating link…' : 'Copy payment link'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPayDismissed(true)}>
              Done
            </Button>
          </div>
          {linkNote ? <p className="mt-2 text-sm text-gray-700">{linkNote}</p> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4 py-2 mb-6 no-print">
        <Link
          href={`/${locale}/crm/invoices`}
          className="flex items-center gap-2 text-gray-700 hover:text-black font-medium"
        >
          <ArrowLeft className="w-5 h-5 shrink-0" />
          Back to Invoices
        </Link>
        {/* Phone: one row that scrolls sideways, edge to edge. Desktop: normal row. */}
        <div className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 overflow-x-auto px-2 pb-1 md:mx-0 md:w-auto md:overflow-visible md:px-0 md:pb-0 [&_button]:shrink-0 [&_button]:whitespace-nowrap [&_svg]:shrink-0 [&>a]:shrink-0">
          {invoice.status !== 'cancelled' && (
            <Button
              variant="primary"
              size="sm"
              onClick={openSendDialog}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send invoice
            </Button>
          )}
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
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={presenting}
                className="flex items-center gap-2"
                onClick={collectCardOnDevice}
              >
                <Tablet className="w-4 h-4" />
                {presenting ? 'Opening…' : 'Collect card on device'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={linking}
                className="flex items-center gap-2"
                onClick={copyPaymentLink}
              >
                <Link2 className="w-4 h-4" />
                {linking ? 'Creating link…' : 'Copy payment link'}
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDownloadPDF} className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download PDF
          </Button>
          {/* Nine-dot menu: pinned to the right end so it stays reachable while the row scrolls. */}
          <div className="sticky right-0 ml-auto shrink-0 md:hidden">
            <button
              type="button"
              onClick={() => setActionsGridOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-black border-2 border-black text-white cursor-pointer hover:bg-gray-800 transition-all"
              aria-label="Invoice actions menu"
              title="Invoice actions menu"
            >
              <BsGrid3X3Gap className="w-5 h-5" />
            </button>
          </div>
        </div>
        {linkNote ? <p className="mt-2 text-sm text-gray-700">{linkNote}</p> : null}
      </div>

      <MobileGridActionsModal
        isOpen={actionsGridOpen}
        onClose={() => setActionsGridOpen(false)}
        title="Invoice actions"
        items={[
          ...(invoice.status !== 'cancelled'
            ? [{ id: 'send', label: 'Send invoice', icon: Send, onClick: () => { setActionsGridOpen(false); openSendDialog(); } }]
            : []),
          ...(invoice.status === 'draft'
            ? [
                { id: 'edit', label: 'Edit invoice', icon: Pencil, href: `/${locale}/crm/invoices/${id}/edit` },
                { id: 'company', label: 'Edit company info', icon: Building2, onClick: () => { setActionsGridOpen(false); setCompanyEditorOpen(true); } },
              ]
            : []),
          ...(invoice.status !== 'cancelled' && invoice.amount_cents - (invoice.payment_applied_cents ?? 0) > 0
            ? [
                { id: 'collect', label: 'Collect card on device', icon: Tablet, onClick: () => { setActionsGridOpen(false); collectCardOnDevice(); } },
                { id: 'link', label: 'Copy payment link', icon: Link2, onClick: () => { setActionsGridOpen(false); void copyPaymentLink(); } },
              ]
            : []),
          { id: 'print', label: 'Print', icon: Printer, onClick: () => { setActionsGridOpen(false); handlePrint(); } },
          { id: 'pdf', label: 'Download PDF', icon: Download, onClick: () => { setActionsGridOpen(false); void handleDownloadPDF(); } },
          { id: 'back', label: 'All invoices', icon: FileText, href: `/${locale}/crm/invoices` },
        ]}
      />

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
          payUrl={wantsPayLink ? payLink?.url : null}
          payQrDataUrl={wantsPayLink ? payLink?.qr : null}
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
