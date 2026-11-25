'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { BellRing, Check, Clock, FileText, FolderKanban, FolderPlus, Hammer, Loader2, Phone, Receipt, Send, Wallet, X } from 'lucide-react';
import ChatDocCard from '@/components/chat/ChatDocCard';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { InvoiceReminderDialog } from '@/components/crm/InvoiceReminderDialog';
import { ProjectFromEstimateDialog } from '@/components/crm/ProjectFromEstimateDialog';
import type { ChatProbotFollowup } from '@/lib/types/chat';

type Lang = 'en' | 'es' | 'pt';
type Outcome = NonNullable<ChatProbotFollowup['outcome']>;

const INTL: Record<Lang, string> = { en: 'en-US', es: 'es-US', pt: 'pt-BR' };

const WORDS = {
  en: {
    invoiceLate: 'Invoice late', invoiceUnpaid: 'Invoice unpaid', estimateWaiting: 'Estimate waiting', estimateAccepted: 'Estimate accepted',
    finishing: 'Job finishing', starting: 'Job starting', invoice: 'Invoice', estimate: 'Estimate',
    late: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} late.`,
    waiting: (before: boolean, days: number, invoice: boolean) => `${before ? 'Last follow-up' : 'Sent'} ${days} days ago, no ${invoice ? 'payment' : 'answer'} yet.`,
    accepted: 'They said yes. Turn it into a project to schedule the work.',
    ends: (date: string) => `Ends ${date}. Bill the rest with a final invoice.`,
    starts: (date: string) => `Starts ${date}. Check materials, crew and access.`,
    sendReminder: 'Send reminder', sendFollowup: 'Send follow-up', createProject: 'Create project', finalInvoice: 'Create final invoice', openProject: 'Open project',
    call: 'Call', open: 'Open', markPaid: 'Mark paid', snooze: '3 days', dismiss: 'Dismiss',
    reminderSent: 'Reminder sent', followupSent: 'Follow-up sent', snoozedUntil: 'Snoozed until', dismissed: 'Dismissed',
    paid: 'Marked paid', projectCreated: 'Project created', invoiceStarted: 'Final invoice started', opened: 'Opened',
    waitingForPro: 'Waiting for the pro.', saveFailed: 'Could not save',
    payTitle: 'Mark paid', amount: 'Amount ($)', method: 'Paid by', date: 'Date', save: 'Save', cancel: 'Cancel',
    methods: { cash: 'Cash', check: 'Check', card: 'Card', transfer: 'Bank transfer / Zelle', other: 'Other' },
    followTitle: 'Follow up', followHint: (name: string) => `${name} gets this note by email with a link to the estimate.`,
    followMessage: (name: string, number: string) => `Hi ${name}, just checking in on estimate ${number}. Do you have any questions, or would you like to go ahead? Happy to walk you through it.`,
    send: 'Send', sendFailed: 'Could not send the follow-up', payFailed: 'Could not record the payment',
  },
  es: {
    invoiceLate: 'Factura vencida', invoiceUnpaid: 'Factura sin pagar', estimateWaiting: 'Estimado sin respuesta', estimateAccepted: 'Estimado aceptado',
    finishing: 'Trabajo por terminar', starting: 'Trabajo por empezar', invoice: 'Factura', estimate: 'Estimado',
    late: (n: number) => `${n} ${n === 1 ? 'día' : 'días'} de atraso.`,
    waiting: (before: boolean, days: number, invoice: boolean) => `${before ? 'Último seguimiento' : 'Enviado'} hace ${days} días, sin ${invoice ? 'pago' : 'respuesta'} todavía.`,
    accepted: 'Dijo que sí. Conviértelo en proyecto para agendar el trabajo.',
    ends: (date: string) => `Termina ${date}. Cobra el resto con la factura final.`,
    starts: (date: string) => `Empieza ${date}. Revisa materiales, equipo y acceso.`,
    sendReminder: 'Enviar recordatorio', sendFollowup: 'Enviar seguimiento', createProject: 'Crear proyecto', finalInvoice: 'Crear factura final', openProject: 'Abrir proyecto',
    call: 'Llamar', open: 'Abrir', markPaid: 'Marcar pagada', snooze: '3 días', dismiss: 'Descartar',
    reminderSent: 'Recordatorio enviado', followupSent: 'Seguimiento enviado', snoozedUntil: 'Pospuesto hasta', dismissed: 'Descartado',
    paid: 'Marcada pagada', projectCreated: 'Proyecto creado', invoiceStarted: 'Factura final iniciada', opened: 'Abierto',
    waitingForPro: 'Esperando al pro.', saveFailed: 'No se pudo guardar',
    payTitle: 'Marcar pagada', amount: 'Monto ($)', method: 'Pagó con', date: 'Fecha', save: 'Guardar', cancel: 'Cancelar',
    methods: { cash: 'Efectivo', check: 'Cheque', card: 'Tarjeta', transfer: 'Transferencia / Zelle', other: 'Otro' },
    followTitle: 'Seguimiento', followHint: (name: string) => `${name} recibe esta nota por email con el enlace al estimado.`,
    followMessage: (name: string, number: string) => `Hola ${name}, solo quería saber del estimado ${number}. ¿Tienes alguna pregunta o quieres seguir adelante? Con gusto te lo explico.`,
    send: 'Enviar', sendFailed: 'No se pudo enviar el seguimiento', payFailed: 'No se pudo registrar el pago',
  },
  pt: {
    invoiceLate: 'Fatura atrasada', invoiceUnpaid: 'Fatura em aberto', estimateWaiting: 'Orçamento sem resposta', estimateAccepted: 'Orçamento aprovado',
    finishing: 'Obra terminando', starting: 'Obra começando', invoice: 'Fatura', estimate: 'Orçamento',
    late: (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'} de atraso.`,
    waiting: (before: boolean, days: number, invoice: boolean) => `${before ? 'Último contato' : 'Enviado'} há ${days} dias, sem ${invoice ? 'pagamento' : 'resposta'} ainda.`,
    accepted: 'O cliente aprovou. Crie o projeto para agendar a obra.',
    ends: (date: string) => `Termina ${date}. Cobre o restante com a fatura final.`,
    starts: (date: string) => `Começa ${date}. Confira materiais, equipe e acesso.`,
    sendReminder: 'Enviar lembrete', sendFollowup: 'Enviar contato', createProject: 'Criar projeto', finalInvoice: 'Criar fatura final', openProject: 'Abrir projeto',
    call: 'Ligar', open: 'Abrir', markPaid: 'Marcar paga', snooze: '3 dias', dismiss: 'Dispensar',
    reminderSent: 'Lembrete enviado', followupSent: 'Contato enviado', snoozedUntil: 'Adiado até', dismissed: 'Dispensado',
    paid: 'Marcada como paga', projectCreated: 'Projeto criado', invoiceStarted: 'Fatura final iniciada', opened: 'Aberto',
    waitingForPro: 'Aguardando o pro.', saveFailed: 'Não foi possível salvar',
    payTitle: 'Marcar paga', amount: 'Valor ($)', method: 'Pago com', date: 'Data', save: 'Salvar', cancel: 'Cancelar',
    methods: { cash: 'Dinheiro', check: 'Cheque', card: 'Cartão', transfer: 'Transferência / Zelle', other: 'Outro' },
    followTitle: 'Contato', followHint: (name: string) => `${name} recebe esta mensagem por email com o link do orçamento.`,
    followMessage: (name: string, number: string) => `Olá ${name}, passando para saber do orçamento ${number}. Ficou alguma dúvida ou podemos seguir? Fico à disposição para explicar.`,
    send: 'Enviar', sendFailed: 'Não foi possível enviar', payFailed: 'Não foi possível registrar o pagamento',
  },
} as const;

type Words = (typeof WORDS)[Lang];

const smallButton =
  'inline-flex items-center justify-center gap-1 rounded-lg border-2 border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-800 hover:border-gray-500 disabled:opacity-60';
const bigButton =
  'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-60';

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * ProBot morning card: an unpaid invoice, an estimate with no answer, an accepted estimate,
 * or a job finishing or starting. Anything that reaches a customer opens a preview first;
 * nothing is sent until the pro taps Send there. Read-only when an admin looks at the thread.
 */
export function ProbotFollowupCard({ card, canAnswer }: { card: ChatProbotFollowup; canAnswer: boolean }) {
  const pageLocale = useLocale();
  const lang: Lang = card.locale ?? (pageLocale === 'es' || pageLocale === 'pt' ? pageLocale : 'en');
  const w = WORDS[lang];
  const [state, setState] = useState(card);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | 'reminder' | 'followup' | 'paid' | 'project'>(null);

  const money = (cents: number) => new Intl.NumberFormat(INTL[lang], { style: 'currency', currency: 'USD' }).format(cents / 100);
  const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(INTL[lang], { weekday: 'long', month: 'short', day: 'numeric' });
  const stamp = (iso: string) => new Date(iso).toLocaleString(INTL[lang], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  const record = async (action: 'sent' | 'snooze' | 'done', outcome?: Outcome) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/probot/followups/${state.followupId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(outcome ? { outcome } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: ChatProbotFollowup['status']; snoozedUntil?: string | null; actedAt?: string | null; outcome?: Outcome | null; error?: string };
      if (!res.ok || !data.status) throw new Error(data.error || w.saveFailed);
      setState((current) => ({
        ...current,
        status: data.status!,
        snoozedUntil: data.snoozedUntil ?? undefined,
        actedAt: data.actedAt ?? undefined,
        outcome: data.outcome ?? undefined,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : w.saveFailed);
    } finally {
      setBusy(false);
    }
  };

  const kind = state.kind;
  const isInvoice = kind === 'invoice_unpaid';
  const isProject = kind === 'project_finishing' || kind === 'project_starting';
  const late = isInvoice && state.daysLate ? state.daysLate : 0;
  const base = `/${pageLocale}/crm`;
  const docHref = isInvoice
    ? `${base}/invoices/${state.documentId}`
    : isProject
      ? `${base}/projects/${state.documentId}`
      : `${base}/estimates?id=${state.documentId}`;
  const finalInvoiceHref = `${base}/invoices/new?${new URLSearchParams({ ...(state.customerId ? { customerId: state.customerId } : {}), projectId: state.documentId })}`;

  const eyebrow = {
    invoice_unpaid: late ? w.invoiceLate : w.invoiceUnpaid,
    estimate_waiting: w.estimateWaiting,
    estimate_accepted: w.estimateAccepted,
    project_finishing: w.finishing,
    project_starting: w.starting,
  }[kind];
  const icon = isInvoice ? <Receipt className="h-5 w-5" aria-hidden /> : isProject ? (kind === 'project_finishing' ? <FolderKanban className="h-5 w-5" aria-hidden /> : <Hammer className="h-5 w-5" aria-hidden />) : <FileText className="h-5 w-5" aria-hidden />;
  const subtitle = isProject
    ? state.projectName ?? state.documentNumber
    : `${isInvoice ? w.invoice : w.estimate} ${state.documentNumber} · ${money(state.amountCents)}`;
  const detail =
    kind === 'estimate_accepted' ? w.accepted
      : kind === 'project_finishing' ? w.ends(day(state.date ?? todayIso()))
        : kind === 'project_starting' ? w.starts(day(state.date ?? todayIso()))
          : w.waiting(state.followedUpBefore, state.waitingDays, isInvoice);

  const doneLine = (() => {
    if (state.status === 'sent') return `${isInvoice ? w.reminderSent : w.followupSent}${state.actedAt ? ` ${stamp(state.actedAt)}` : ''}`;
    if (state.status === 'snoozed') return `${w.snoozedUntil} ${state.snoozedUntil ? new Date(`${state.snoozedUntil}T12:00:00`).toLocaleDateString(INTL[lang], { month: 'short', day: 'numeric' }) : ''}`;
    if (state.status === 'done') {
      const label = { paid: w.paid, dismissed: w.dismissed, project_created: w.projectCreated, invoice_started: w.invoiceStarted, opened: w.opened }[state.outcome ?? 'dismissed'];
      return `${label}${state.actedAt ? ` ${stamp(state.actedAt)}` : ''}`;
    }
    return null;
  })();

  const callOrOpen = state.customerPhone ? (
    <a href={`tel:${state.customerPhone.replace(/[^\d+]/g, '')}`} className={smallButton}>
      <Phone className="h-3.5 w-3.5" />
      {w.call}
    </a>
  ) : (
    <Link href={docHref} className={smallButton}>{w.open}</Link>
  );
  const snooze = (
    <button type="button" disabled={busy} onClick={() => void record('snooze')} className={smallButton}>
      <Clock className="h-3.5 w-3.5" />
      {w.snooze}
    </button>
  );
  const dismiss = (
    <button type="button" disabled={busy} onClick={() => void record('done', 'dismissed')} className={smallButton}>
      <X className="h-3.5 w-3.5" />
      {w.dismiss}
    </button>
  );

  const actions = (() => {
    switch (kind) {
      case 'invoice_unpaid':
        return (
          <>
            <button type="button" disabled={busy} onClick={() => setDialog('reminder')} className={bigButton}>
              <BellRing className="h-4 w-4 text-red-500" />
              {w.sendReminder}
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              {callOrOpen}
              <button type="button" disabled={busy} onClick={() => setDialog('paid')} className={smallButton}>
                <Wallet className="h-3.5 w-3.5" />
                {w.markPaid}
              </button>
              {snooze}
              {dismiss}
            </div>
          </>
        );
      case 'estimate_waiting':
        return (
          <>
            <button type="button" disabled={busy} onClick={() => setDialog('followup')} className={bigButton}>
              <Send className="h-4 w-4 text-red-500" />
              {w.sendFollowup}
            </button>
            <div className="grid grid-cols-3 gap-1.5">
              {callOrOpen}
              {snooze}
              {dismiss}
            </div>
          </>
        );
      case 'estimate_accepted':
        return (
          <>
            <button type="button" disabled={busy} onClick={() => setDialog('project')} className={bigButton}>
              <FolderPlus className="h-4 w-4 text-red-500" />
              {w.createProject}
            </button>
            <div className="grid grid-cols-3 gap-1.5">
              <Link href={docHref} className={smallButton}>{w.open}</Link>
              {snooze}
              {dismiss}
            </div>
          </>
        );
      case 'project_finishing':
        return (
          <>
            <Link href={finalInvoiceHref} onClick={() => void record('done', 'invoice_started')} className={bigButton}>
              <Receipt className="h-4 w-4 text-red-500" />
              {w.finalInvoice}
            </Link>
            <div className="grid grid-cols-3 gap-1.5">
              <Link href={docHref} className={smallButton}>{w.open}</Link>
              {snooze}
              {dismiss}
            </div>
          </>
        );
      case 'project_starting':
        return (
          <>
            <Link href={docHref} onClick={() => void record('done', 'opened')} className={bigButton}>
              <FolderKanban className="h-4 w-4 text-red-500" />
              {w.openProject}
            </Link>
            <div className="grid grid-cols-2 gap-1.5">
              {callOrOpen}
              {dismiss}
            </div>
          </>
        );
    }
  })();

  return (
    <ChatDocCard tone={isInvoice ? 'invoice' : isProject ? 'calendar' : 'estimate'} icon={icon} eyebrow={eyebrow} title={state.customerName} subtitle={subtitle}>
      <div className="space-y-2.5 bg-gray-50 px-3 py-3 text-sm">
        <p className="text-gray-800">
          {late ? <span className="font-semibold text-red-700">{w.late(late)} </span> : null}
          {detail}
        </p>

        {doneLine ? (
          <p className={`inline-flex items-center gap-1 text-xs font-medium ${state.status === 'snoozed' || state.outcome === 'dismissed' ? 'text-gray-600' : 'text-green-700'}`}>
            {state.status === 'snoozed' ? <Clock className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
            {doneLine}
          </p>
        ) : canAnswer ? (
          <div className="space-y-1.5">{actions}</div>
        ) : (
          <p className="text-xs text-gray-500">{w.waitingForPro}</p>
        )}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>

      {dialog === 'reminder' ? (
        <InvoiceReminderDialog
          invoiceId={state.documentId}
          invoiceNumber={state.documentNumber}
          onClose={() => setDialog(null)}
          onSent={() => {
            setDialog(null);
            void record('sent');
          }}
        />
      ) : null}
      {dialog === 'followup' ? (
        <EstimateFollowupDialog
          w={w}
          estimateId={state.documentId}
          estimateNumber={state.documentNumber}
          customerName={state.customerName}
          onClose={() => setDialog(null)}
          onSent={() => {
            setDialog(null);
            void record('sent');
          }}
        />
      ) : null}
      {dialog === 'paid' ? (
        <MarkPaidDialog
          w={w}
          invoiceId={state.documentId}
          invoiceNumber={state.documentNumber}
          balanceCents={state.amountCents}
          onClose={() => setDialog(null)}
          onPaid={() => {
            setDialog(null);
            void record('done', 'paid');
          }}
        />
      ) : null}
      {dialog === 'project' ? (
        <ProjectFromEstimateDialog
          estimateId={state.documentId}
          customerName={state.customerName}
          onClose={() => setDialog(null)}
          onCreated={() => {
            setDialog(null);
            void record('done', 'project_created');
          }}
        />
      ) : null}
    </ChatDocCard>
  );
}

/** Re-send the estimate link with a short note. The pro can edit the note before sending. */
function EstimateFollowupDialog({
  w,
  estimateId,
  estimateNumber,
  customerName,
  onClose,
  onSent,
}: {
  w: Words;
  estimateId: string;
  estimateNumber: string;
  customerName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const firstName = customerName.split(' ')[0] || customerName;
  const [message, setMessage] = useState<string>(w.followMessage(firstName, estimateNumber));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/estimates/${estimateId}/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || w.sendFailed);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : w.sendFailed);
      setSending(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !sending && onClose()} title={`${w.followTitle} · ${w.estimate} ${estimateNumber}`} maxWidth="md">
      <div className="space-y-3 p-4">
        <p className="text-sm text-gray-600">{w.followHint(customerName)}</p>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          maxLength={2000}
          className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm focus:outline-none"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>{w.cancel}</Button>
          <Button onClick={() => void send()} disabled={sending || !message.trim()}>
            {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
            {w.send}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Record a payment the customer made outside the app (cash, check, Zelle). */
function MarkPaidDialog({
  w,
  invoiceId,
  invoiceNumber,
  balanceCents,
  onClose,
  onPaid,
}: {
  w: Words;
  invoiceId: string;
  invoiceNumber: string;
  balanceCents: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const [method, setMethod] = useState<keyof Words['methods']>('cash');
  const [date, setDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const amountCents = Math.round((Number(amount) || 0) * 100);
    if (amountCents <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/invoices/${invoiceId}/payments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents, method, paymentDate: date }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || w.payFailed);
      onPaid();
    } catch (err) {
      setError(err instanceof Error ? err.message : w.payFailed);
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !saving && onClose()} title={`${w.payTitle} · ${w.invoice} ${invoiceNumber}`} maxWidth="sm">
      <div className="space-y-3 p-4">
        <FormField label={w.amount}>
          <Input type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </FormField>
        <FormField label={w.method}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as keyof Words['methods'])}>
            {(Object.keys(w.methods) as (keyof Words['methods'])[]).map((key) => (
              <option key={key} value={key}>{w.methods[key]}</option>
            ))}
          </Select>
        </FormField>
        <FormField label={w.date}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </FormField>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>{w.cancel}</Button>
          <Button onClick={() => void save()} disabled={saving || !(Number(amount) > 0)}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
            {w.save}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
