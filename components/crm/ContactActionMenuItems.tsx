'use client';

import { FileCheck, FileText, FolderOpen, HardHat, Home, PlusCircle, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ContactActionId } from '@/lib/crm/contact-actions';

export const CONTACT_ACTION_META: Record<ContactActionId, { label: string; icon: LucideIcon }> = {
  portal: { label: 'Go to portal', icon: Home },
  estimate: { label: 'Create estimate', icon: FileCheck },
  invoice: { label: 'Create invoice', icon: FileText },
  project: { label: 'Create project', icon: FolderOpen },
  addToJob: { label: 'Add to a job', icon: HardHat },
  expense: { label: 'Add expense', icon: Receipt },
  task: { label: 'Schedule task', icon: PlusCircle },
};

/** The role-based part of a contact's actions menu (card and table views share it). */
export function ContactActionMenuItems({
  actions,
  onAction,
}: {
  actions: ContactActionId[];
  onAction: (action: ContactActionId) => void;
}) {
  return (
    <>
      {actions.map((id) => {
        const { label, icon: Icon } = CONTACT_ACTION_META[id];
        return (
          <button
            key={id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAction(id);
            }}
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
          >
            <Icon className="w-3.5 h-3.5 shrink-0 text-red-500" />
            {label}
          </button>
        );
      })}
    </>
  );
}
