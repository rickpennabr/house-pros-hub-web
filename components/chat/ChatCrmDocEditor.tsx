'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FolderOpen, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { EstimateDocumentForm } from '@/components/estimates/EstimateDocumentForm';
import { InvoiceEditor } from '@/components/invoices/InvoiceEditor';
import { uploadPendingAttachments } from '@/components/invoices/InvoiceAttachments';
import { AddProductServicePanel, type ProCrmItem } from '@/components/invoices/AddProductServicePanel';
import type { AgreementKind, MaintenanceFrequency } from '@/lib/crm/estimate-agreement';
import {
  applyCatalogItemToLine,
  blankEstimateLine,
  estimateDeposit,
  estimateFormError,
  estimateLinesPayload,
  estimateTotalCents,
  syncEstimateLinesToReusableItems,
  type EstimateFormLine,
} from '@/lib/crm/estimate-form';
import {
  EMPTY_INVOICE_BUSINESS,
  emptyInvoiceLine,
  invoiceLineItemsPayload,
  invoiceTotalCents,
  type InvoiceBusinessShape,
  type InvoiceCustomerOption,
  type InvoiceEditorDraft,
} from '@/lib/invoices/draft';
import { todayISO } from '@/lib/invoices/format';

export type ChatCrmDocKind = 'estimate' | 'invoice';

interface ChatCrmDocEditorProps {
  kind: ChatCrmDocKind;
  customerName?: string;
  /** The chat customer's CRM contact, adding them to the CRM first when needed. */
  ensureCustomerId: () => Promise<string>;
  /** The house the customer shared in this chat; the document starts on it. */
  sharedPlaceId?: string | null;
  /** Called with the saved document; the chat posts it as a card. */
  onCreated: (doc: { kind: ChatCrmDocKind; id: string }) => Promise<void>;
  /** Send one that already exists instead. */
  onPickSaved: () => void;
  onClose: () => void;
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

interface Loaded {
  customerId: string;
  customer: InvoiceCustomerOption | null;
  invoice: { number: string; themeColorHex: string; business: InvoiceBusinessShape } | null;
}

/**
 * The CRM's own estimate and invoice forms in a large window over the chat: the same fields as
 * the CRM, the customer fixed to the chat customer, and the house they shared picked. Saving
 * posts the document in the chat as a card.
 */
export default function ChatCrmDocEditor({
  kind,
  customerName,
  ensureCustomerId,
  sharedPlaceId,
  onCreated,
  onPickSaved,
  onClose,
}: ChatCrmDocEditorProps) {
  const t = useTranslations('probot');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Estimate form state (same fields as the CRM estimates page).
  const [placeId, setPlaceId] = useState('');
  const [lines, setLines] = useState<EstimateFormLine[]>(() => [blankEstimateLine()]);
  const [validUntil, setValidUntil] = useState(() => inDays(30));
  const [status, setStatus] = useState('draft');
  const [note, setNote] = useState('');
  const [deposit, setDeposit] = useState('');
  const [jobArea, setJobArea] = useState('');
  const [agreementKind, setAgreementKind] = useState<AgreementKind>('project');
  const [maintenanceFrequency, setMaintenanceFrequency] = useState<MaintenanceFrequency | ''>('');
  const [items, setItems] = useState<ProCrmItem[]>([]);
  const [itemPanelRow, setItemPanelRow] = useState<number | null>(null);
  const [itemPanelOpen, setItemPanelOpen] = useState(false);

  useEffect(() => {
    // Once per window: adding the chat customer to the CRM must not run twice.
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const customerId = await ensureCustomerId();
        const [customers, extra] = await Promise.all([
          fetch('/api/crm/customers?pageSize=500&billable=1', { credentials: 'include' }).then((res) => res.json()),
          kind === 'estimate'
            ? fetch('/api/crm/items', { credentials: 'include' }).then((res) => res.json())
            : fetch('/api/crm/invoices/new-context', { credentials: 'include' }).then((res) => res.json()),
        ]);
        const list: InvoiceCustomerOption[] = Array.isArray(customers?.customers) ? customers.customers : [];
        const customer = list.find((row) => row.id === customerId) ?? null;
        const catalog: ProCrmItem[] = kind === 'estimate' && Array.isArray(extra?.items) ? extra.items : [];
        setItems(catalog);
        setLoaded({
          customerId,
          customer,
          invoice:
            kind === 'invoice'
              ? {
                  number: typeof extra?.nextInvoiceNumber === 'string' ? extra.nextInvoiceNumber : 'INV-0001',
                  themeColorHex: typeof extra?.themeColorHex === 'string' ? extra.themeColorHex : '#000000',
                  business: extra?.business ?? EMPTY_INVOICE_BUSINESS,
                }
              : null,
        });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : t('crmComposerFailed'));
      }
    })();
  }, [ensureCustomerId, kind, t]);

  /** Start on the house shared in this chat when it is one of the contact's houses. */
  const pickSharedHouse = (properties: { id: string }[]) =>
    sharedPlaceId && properties.some((property) => property.id === sharedPlaceId) ? sharedPlaceId : undefined;

  const finish = async (id: string) => {
    await onCreated({ kind, id });
    onClose();
  };

  const submitEstimate = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!loaded) return;
    const problem = estimateFormError({
      customerId: loaded.customerId,
      lines,
      deposit,
      agreementKind,
      maintenanceFrequency,
    });
    if (problem) {
      setError(problem);
      return;
    }
    const payload = estimateLinesPayload(lines);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: loaded.customerId,
          placeId: placeId || null,
          amountCents: estimateTotalCents(lines),
          lineItems: payload.length > 0 ? payload : null,
          status,
          dueDate: validUntil || null,
          note: note.trim() || null,
          depositCents: estimateDeposit(deposit, estimateTotalCents(lines)).cents,
          jobArea: jobArea.trim() || null,
          agreementKind,
          maintenanceFrequency: agreementKind === 'maintenance' ? maintenanceFrequency || null : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.id !== 'string') {
        throw new Error(typeof data.error === 'string' ? data.error : t('crmComposerFailed'));
      }
      await syncEstimateLinesToReusableItems(payload).catch(() => undefined);
      await finish(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('crmComposerFailed'));
    } finally {
      setSaving(false);
    }
  };

  const submitInvoice = async (form: InvoiceEditorDraft) => {
    setSaving(true);
    setError(null);
    try {
      const lineItems = invoiceLineItemsPayload(form.lineItems);
      if (lineItems.length === 0) throw new Error(t('crmComposerNeedItem'));
      const res = await fetch('/api/crm/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerId: form.customerId,
          placeId: form.placeId || null,
          amountCents: invoiceTotalCents(lineItems),
          lineItems,
          invoiceDate: form.invoiceDate || todayISO(),
          dueDate: form.dueDate.trim() || form.invoiceDate || todayISO(),
          paymentTerms: form.paymentTerms.trim() || null,
          note: form.note.trim() || null,
          companyDisplay: form.companyOverride ?? undefined,
          paidNow: form.paidNow,
          paidNowMethod: form.paidNowMethod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.id !== 'string') {
        throw new Error(typeof data.error === 'string' ? data.error : t('crmComposerFailed'));
      }
      await uploadPendingAttachments(data.id, form.pendingAttachments);
      await finish(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('crmComposerFailed'));
    } finally {
      setSaving(false);
    }
  };

  const title = kind === 'estimate' ? t('crmComposerEstimateTitle') : t('crmComposerInvoiceTitle');

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={customerName ? `${title} · ${customerName}` : title}
      maxWidth="6xl"
      showHeader
      preventCloseOnOverlayClick
      contentClassName="p-0"
    >
      <div className="flex flex-col">
        <div className="flex justify-end border-b border-gray-200 px-4 py-2">
          <button
            type="button"
            onClick={onPickSaved}
            disabled={saving}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-black disabled:opacity-60"
          >
            <FolderOpen className="h-4 w-4" aria-hidden />
            {t('crmComposerPickSaved')}
          </button>
        </div>
        <div className="p-2 md:p-4">
          {loadError ? (
            <p className="p-6 text-center text-sm text-red-600" role="alert">
              {loadError}
            </p>
          ) : !loaded ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            </div>
          ) : kind === 'estimate' ? (
            <EstimateDocumentForm
              mode="create"
              customers={loaded.customer ? [loaded.customer] : []}
              customerId={loaded.customerId}
              onCustomerIdChange={() => undefined}
              lockCustomer
              placeId={placeId}
              onPlaceIdChange={setPlaceId}
              onPropertiesLoaded={pickSharedHouse}
              lineItems={lines}
              onLineItemsChange={setLines}
              validUntilDate={validUntil}
              onValidUntilDateChange={setValidUntil}
              status={status}
              onStatusChange={setStatus}
              note={note}
              onNoteChange={setNote}
              deposit={deposit}
              onDepositChange={setDeposit}
              jobArea={jobArea}
              onJobAreaChange={setJobArea}
              agreementKind={agreementKind}
              onAgreementKindChange={setAgreementKind}
              maintenanceFrequency={maintenanceFrequency}
              onMaintenanceFrequencyChange={setMaintenanceFrequency}
              saving={saving}
              error={error}
              onSubmit={submitEstimate}
              onCancel={onClose}
              submitLabel={t('crmComposerSendEstimate')}
              reusableItems={items}
              onOpenAddReusableItem={(rowIndex) => {
                setItemPanelRow(typeof rowIndex === 'number' ? rowIndex : null);
                setItemPanelOpen(true);
              }}
            />
          ) : (
            <InvoiceEditor
              title={title}
              backHref="#"
              invoiceNumber={loaded.invoice?.number ?? 'INV-0001'}
              themeColorHex={loaded.invoice?.themeColorHex ?? '#000000'}
              business={loaded.invoice?.business ?? EMPTY_INVOICE_BUSINESS}
              customers={loaded.customer ? [loaded.customer] : []}
              invoiceId={null}
              initialDraft={{
                customerId: loaded.customerId,
                placeId: '',
                lineItems: [emptyInvoiceLine()],
                invoiceDate: todayISO(),
                dueDate: todayISO(),
                paymentTerms: 'Due on receipt',
                note: '',
                companyOverride: null,
                pendingAttachments: [],
                paidNow: false,
                paidNowMethod: 'cash',
              }}
              error={error}
              saving={saving}
              onSaveAndClose={submitInvoice}
              onReviewAndSend={submitInvoice}
              embedded={{
                onCancel: onClose,
                submitLabel: t('crmComposerSendInvoice'),
                onPropertiesLoaded: pickSharedHouse,
              }}
            />
          )}
        </div>
      </div>

      {kind === 'estimate' ? (
        <AddProductServicePanel
          isOpen={itemPanelOpen}
          onClose={() => {
            setItemPanelOpen(false);
            setItemPanelRow(null);
          }}
          existingItems={items}
          onSaved={(item, action) => {
            setItems((current) => {
              const index = current.findIndex((row) => row.id === item.id);
              if (index === -1) return [...current, item];
              const next = [...current];
              next[index] = item;
              return next;
            });
            if (itemPanelRow !== null) {
              setLines((current) =>
                current.map((line, index) => (index === itemPanelRow ? applyCatalogItemToLine(line, item) : line))
              );
            }
            setItemPanelRow(null);
            if (action === 'close') setItemPanelOpen(false);
          }}
        />
      ) : null}
    </Modal>
  );
}
