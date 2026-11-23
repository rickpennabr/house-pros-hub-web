'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Camera } from 'lucide-react';
import { JobFinancials } from '@/components/crm/JobFinancials';

/** A project's financial report: revenue, every cost by type, overhead, and profit. */
export default function ProjectFinancialsPage() {
  const locale = useLocale();
  const params = useParams<{ id: string }>();
  const id = params.id;

  return (
    <div className="w-full space-y-4 px-4 py-4 md:px-6">
      <div className="no-print flex items-center justify-between gap-3">
        <Link href={`/${locale}/crm/projects`} className="flex items-center gap-2 font-medium text-gray-700 hover:text-black">
          <ArrowLeft className="h-5 w-5" /> Projects
        </Link>
        <Link
          href={`/${locale}/crm/projects/${id}/photos`}
          className="flex items-center gap-2 rounded-lg border-2 border-black px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
        >
          <Camera className="h-4 w-4" /> Photos
        </Link>
      </div>
      <JobFinancials kind="project" id={id} />
    </div>
  );
}
