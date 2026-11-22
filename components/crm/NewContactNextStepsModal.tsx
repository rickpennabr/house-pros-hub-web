'use client';

import {
  CalendarDays,
  FileCheck,
  FileText,
  FolderOpen,
  Home,
  Link2,
  Mail,
  MessageSquare,
  Phone,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';

export interface NewContactSummary {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface NewContactNextStepsModalProps {
  contact: NewContactSummary | null;
  locale: string;
  onClose: () => void;
  /** Go to a CRM page (estimate, invoice, project…) for this contact. */
  onNavigate: (href: string) => void;
  onScheduleAppointment: () => void;
  onOpenContact: () => void;
}

interface NextAction {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
}

/**
 * Right after a contact is saved: "What's next?" with every job the pro can start for them, so
 * they go straight from a new customer to an estimate, invoice, payment link, project or visit.
 */
export function NewContactNextStepsModal({
  contact,
  locale,
  onClose,
  onNavigate,
  onScheduleAppointment,
  onOpenContact,
}: NewContactNextStepsModalProps) {
  if (!contact) return null;
  const id = encodeURIComponent(contact.id);
  const crm = `/${locale}/crm`;
  const go = (href: string) => () => onNavigate(href);
  const phone = contact.phone?.replace(/[^\d+]/g, '') || '';
  const email = contact.email?.trim() || '';

  const jobActions: NextAction[] = [
    { id: 'estimate', label: 'Create estimate', hint: 'Quote the job', icon: FileCheck, onClick: go(`${crm}/estimates?customerId=${id}`) },
    { id: 'invoice', label: 'Create invoice', hint: 'Bill for work', icon: FileText, onClick: go(`${crm}/invoices/new?customerId=${id}`) },
    { id: 'pay', label: 'Send payment link', hint: 'Invoice, then a card link', icon: Link2, onClick: go(`${crm}/invoices/new?customerId=${id}&pay=1`) },
    { id: 'project', label: 'Start project', hint: 'Track a job', icon: FolderOpen, onClick: go(`${crm}/projects?customerId=${id}`) },
    { id: 'appointment', label: 'Schedule appointment', hint: 'Estimate visit or meeting', icon: CalendarDays, onClick: onScheduleAppointment },
    { id: 'maintenance', label: 'Add maintenance', hint: 'Recurring visits at their house', icon: Home, onClick: go(`${crm}/maintenance/houses/new?customerId=${id}`) },
  ];
  const reachActions: NextAction[] = [
    ...(phone
      ? [
          { id: 'call', label: 'Call', hint: contact.phone ?? '', icon: Phone, href: `tel:${phone}` },
          { id: 'text', label: 'Text', hint: contact.phone ?? '', icon: MessageSquare, href: `sms:${phone}` },
        ]
      : []),
    ...(email ? [{ id: 'email', label: 'Email', hint: email, icon: Mail, href: `mailto:${email}` }] : []),
  ];

  const tile = (action: NextAction, primary = false) => {
    const Icon = action.icon;
    const className = `flex min-h-[4.5rem] items-start gap-3 rounded-lg border-2 border-black p-3 text-left transition-colors ${
      primary ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-black hover:bg-gray-50'
    }`;
    const content = (
      <>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 ${primary ? 'border-white' : 'border-black'}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{action.label}</span>
          <span className={`block truncate text-xs ${primary ? 'text-gray-200' : 'text-gray-600'}`}>{action.hint}</span>
        </span>
      </>
    );
    return action.href ? (
      <a key={action.id} href={action.href} className={className}>
        {content}
      </a>
    ) : (
      <button key={action.id} type="button" onClick={action.onClick} className={className}>
        {content}
      </button>
    );
  };

  return (
    <Modal isOpen onClose={onClose} title="What's next?" maxWidth="xl">
      <div className="space-y-4 p-4 md:p-5">
        <p className="text-sm text-gray-700">
          <span className="font-semibold text-gray-900">{contact.name}</span> was saved. What do you want to do for them?
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {jobActions.map((action, index) => tile(action, index === 0))}
        </div>
        {reachActions.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Reach out</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{reachActions.map((action) => tile(action))}</div>
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-2 border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onOpenContact}
            className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-black bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-50"
          >
            <UserRound className="h-4 w-4" aria-hidden />
            Open contact
          </button>
        </div>
      </div>
    </Modal>
  );
}
