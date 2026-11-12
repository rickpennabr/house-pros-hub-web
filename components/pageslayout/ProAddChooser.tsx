'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CalendarDays,
  Camera,
  FileCheck,
  FileText,
  FolderKanban,
  Package,
  Receipt,
  Users,
  Shovel,
} from 'lucide-react';
import { MobileGridActionsModal, type MobileGridActionItem } from '@/components/crm/MobileGridActionsModal';

/** Contractor, realtor, and installer accounts. Customers keep the public contact buttons. */
export function isHubPro(roles: readonly string[]): boolean {
  return roles.includes('contractor') || roles.includes('realtor') || roles.includes('installer');
}

interface ProAddModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** One grid of CRM creates and the rest of the CRM sections. */
export function ProAddModal({ isOpen, onClose }: ProAddModalProps) {
  const locale = useLocale();
  const t = useTranslations('bot');

  const items = useMemo((): MobileGridActionItem[] => {
    const crm = `/${locale}/crm`;
    return [
      { id: 'customer', href: `${crm}/customers?new=1`, label: t('proAdd.customer'), icon: Users },
      { id: 'invoice', href: `${crm}/invoices/new`, label: t('proAdd.invoice'), icon: FileCheck },
      { id: 'project', href: `${crm}/projects?new=1`, label: t('proAdd.project'), icon: FolderKanban },
      { id: 'expense', href: `${crm}/expenses?new=1`, label: t('proAdd.expense'), icon: Receipt },
      { id: 'estimate', href: `${crm}/estimates?new=1`, label: t('proAdd.estimate'), icon: FileText },
      { id: 'task', href: `${crm}/calendar?new=task`, label: t('proAdd.task'), icon: CalendarDays },
      { id: 'service', href: `${crm}/services?new=1`, label: t('proAdd.service'), icon: Shovel },
      { id: 'product', href: `${crm}/products?new=1`, label: t('proAdd.product'), icon: Package },
      { id: 'jobsite', href: `${crm}/jobsite`, label: t('crmJobsite'), icon: Camera },
    ];
  }, [locale, t]);

  return (
    <MobileGridActionsModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('proAdd.title')}
      items={items}
    />
  );
}
