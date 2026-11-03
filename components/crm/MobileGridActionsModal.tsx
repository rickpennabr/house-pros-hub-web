'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';

export interface MobileGridActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  external?: boolean;
}

interface MobileGridActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: MobileGridActionItem[];
}

export function MobileGridActionsModal({
  isOpen,
  onClose,
  title,
  items,
}: MobileGridActionsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      showHeader
      maxWidth="md"
      contentClassName="p-0 md:p-6"
    >
      <div className="grid grid-cols-3 gap-3 p-2 md:p-4">
        {items.map((item) => {
          const Icon = item.icon;
          const className = `
            flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-black transition-all font-medium cursor-pointer hover:scale-[1.02]
            ${item.isActive ? 'bg-black text-white' : 'bg-white text-black'}
          `;

          if (item.href) {
            if (item.external) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className={className}
                >
                  <Icon className={`w-6 h-6 ${item.isActive ? 'text-white' : 'text-red-600'}`} />
                  <span className="text-sm text-center">{item.label}</span>
                </a>
              );
            }

            return (
              <Link key={item.id} href={item.href} onClick={onClose} className={className}>
                <Icon className={`w-6 h-6 ${item.isActive ? 'text-white' : 'text-red-600'}`} />
                <span className="text-sm text-center">{item.label}</span>
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onClose();
                item.onClick?.();
              }}
              className={className}
            >
              <Icon className={`w-6 h-6 ${item.isActive ? 'text-white' : 'text-red-600'}`} />
              <span className="text-sm text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
