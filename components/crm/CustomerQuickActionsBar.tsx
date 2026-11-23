'use client';

import { useState } from 'react';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { BsGrid3X3Gap } from 'react-icons/bs';
import { Button } from '@/components/ui/Button';
import { MobileGridActionsModal, type MobileGridActionItem } from '@/components/crm/MobileGridActionsModal';
import { CONTACT_ACTION_META } from '@/components/crm/ContactActionMenuItems';
import type { ContactActionId } from '@/lib/crm/contact-actions';

interface CustomerQuickActionsBarProps {
  customerName: string;
  customerDisplayId: string | null;
  phoneHref: string | null;
  onBack: () => void;
  /** Only the actions that fit this contact's roles (see contactActionsFor). */
  actions: ContactActionId[];
  onAction: (action: ContactActionId) => void;
  /** Statement of account; only for contacts you bill. */
  onStatement?: () => void;
}

export default function CustomerQuickActionsBar({
  customerName,
  customerDisplayId,
  phoneHref,
  onBack,
  actions,
  onAction,
  onStatement,
}: CustomerQuickActionsBarProps) {
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const buttons = [
    ...actions.map((id) => ({ id: id as string, label: CONTACT_ACTION_META[id].label, icon: CONTACT_ACTION_META[id].icon, onClick: () => onAction(id) })),
    ...(onStatement ? [{ id: 'statement', label: 'Statement', icon: Mail, onClick: onStatement }] : []),
  ];
  const quickActionItems: MobileGridActionItem[] = buttons;

  return (
    <div className="relative left-1/2 right-1/2 mb-2 w-screen -translate-x-1/2 border-y border-black bg-black p-1.5 md:static md:mb-3 md:w-auto md:translate-x-0 md:rounded-lg md:border md:p-2">
      <div className="flex flex-col gap-1.5 md:gap-0">
        <div className="flex items-start justify-between gap-3 md:items-center">
          <div className="min-w-0 flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white bg-black text-white transition-colors hover:bg-gray-800"
              aria-label="Back to customers"
              title="Back to customers"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">{customerName}</p>
              <p className="truncate text-sm text-gray-200">{customerDisplayId || 'Pending ID'}</p>
            </div>
          </div>
          {phoneHref && (
            <a
              href={phoneHref}
              className="md:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-black"
              aria-label="Call customer"
              title="Call customer"
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
          <div className="hidden md:flex md:flex-wrap md:items-center md:justify-end md:gap-2">
            {buttons.map(({ id, label, icon: Icon, onClick }) => (
              <Button key={id} type="button" size="sm" variant="secondary" onClick={onClick} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="md:hidden relative">
          <div className="overflow-x-auto pr-12">
            <div className="flex w-max items-center gap-2 pb-1">
              {buttons.map(({ id, label, icon: Icon, onClick }) => (
                <Button key={id} type="button" size="sm" variant="secondary" onClick={onClick} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsQuickActionsOpen(true)}
            className="absolute right-[-1px] top-0 h-9 w-9 rounded-lg bg-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all"
            aria-label="Quick actions menu"
            title="Quick actions menu"
          >
            <BsGrid3X3Gap className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <MobileGridActionsModal
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
        title="Quick Actions"
        items={quickActionItems}
      />
    </div>
  );
}
