'use client';

import { CalendarDays, FileText, MapPin } from 'lucide-react';
import { CrmRowActionsButton } from '@/components/crm/CrmRowActionsMenu';
import { invoiceStatusLabel } from '@/lib/crm/invoice-books';

/** Status chip colors. Square chips per the shape rule (no pills). */
const STATUS_CHIP: Record<string, string> = {
  draft: 'border-gray-400 bg-gray-50 text-gray-700',
  sent: 'border-blue-600 bg-blue-50 text-blue-700',
  partial: 'border-amber-500 bg-amber-50 text-amber-800',
  paid: 'border-green-600 bg-green-50 text-green-700',
  overdue: 'border-red-600 bg-red-50 text-red-700',
  cancelled: 'border-gray-300 bg-gray-100 text-gray-500',
};

interface InvoiceCardProps {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: string;
  status: string;
  due: string;
  invoiceDate: string;
  address?: string | null;
  onOpen: (id: string) => void;
  actionsOpenId: string | null;
  onToggleActions: (id: string, anchor: HTMLButtonElement) => void;
  /** List view: only the top part (customer, number, amount, status), like the directory list. */
  compact?: boolean;
}

export function InvoiceCard({
  id,
  invoiceNumber,
  customerName,
  amount,
  status,
  due,
  invoiceDate,
  address,
  onOpen,
  actionsOpenId,
  onToggleActions,
  compact = false,
}: InvoiceCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(id);
        }
      }}
      className="border-2 border-black rounded-lg bg-white hover:shadow-lg transition-shadow cursor-pointer text-left w-full h-full flex flex-col p-3 md:p-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-gray-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 truncate">{customerName || 'No customer'}</h3>
          <p className="mt-0.5 text-xs text-gray-500 truncate">#{invoiceNumber}</p>
        </div>
        <div className="shrink-0">
          <CrmRowActionsButton rowId={id} openId={actionsOpenId} onToggle={onToggleActions} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-lg font-semibold text-black">{amount}</span>
        <span
          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[status] ?? STATUS_CHIP.draft}`}
        >
          {invoiceStatusLabel(status)}
        </span>
      </div>

      {!compact && (
      <div className="mt-2 space-y-1 text-sm text-gray-600">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500">Due</span>
          <span className={`truncate ${status === 'overdue' ? 'font-medium text-red-700' : ''}`}>{due}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5 shrink-0 text-gray-500" />
          <span className="truncate">Issued {invoiceDate}</span>
        </div>
        {address ? (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-500" />
            <span className="truncate">{address}</span>
          </div>
        ) : null}
      </div>
      )}
    </div>
  );
}
