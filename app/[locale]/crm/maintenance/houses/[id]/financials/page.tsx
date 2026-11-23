'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { JobFinancials } from '@/components/crm/JobFinancials';

/** A maintenance house's financial report: plan revenue, visit crew time, expenses, overhead, profit. */
export default function MaintenanceFinancialsPage() {
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params.id;

  return (
    <div className="w-full space-y-4 px-4 py-4 md:px-6">
      <div className="no-print">
        <Link
          href={`/${locale}/crm/maintenance/houses/${id}`}
          className="flex items-center gap-2 font-medium text-gray-700 hover:text-black"
        >
          <ArrowLeft className="h-5 w-5" /> House
        </Link>
      </div>
      <JobFinancials kind="plan" id={id} />
    </div>
  );
}
