'use client';

import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MakeAppointmentCardProps {
  href: string;
}

/** Compact action at the bottom right of Contact, Hours, Links, and About. */
export default function MakeAppointmentCard({ href }: MakeAppointmentCardProps) {
  const t = useTranslations('businessServices');

  return (
    <Link
      href={href}
      className="inline-flex h-10 items-center gap-2 rounded-lg border-2 border-black bg-black px-3 text-sm font-semibold text-white transition-colors hover:bg-gray-900"
    >
      <Calendar className="h-4 w-4" />
      {t('makeAppointment')}
    </Link>
  );
}
