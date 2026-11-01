'use client';

import { MapPin, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { jobInitials, type ProJob } from '@/lib/data/proJobs';

interface ProJobCardProps {
  job: ProJob;
  selected: boolean;
  categoryLabel: string;
  employmentLabel: string;
  onSelect: (job: ProJob) => void;
  onShare: (job: ProJob) => void;
}

export default function ProJobCard({
  job,
  selected,
  categoryLabel,
  employmentLabel,
  onSelect,
  onShare,
}: ProJobCardProps) {
  const t = useTranslations('proJobs');
  const pay = job.pay || t('payNotListed');

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(job)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(job);
        }
      }}
      className={`w-full cursor-pointer rounded-lg border-2 border-black transition-shadow hover:shadow-lg ${
        selected ? 'bg-gray-100' : 'bg-white'
      }`}
    >
      <div className="relative flex items-center border-b border-black px-2 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 pr-10">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-black">
            <span className="text-sm font-bold text-white">{jobInitials(job.company)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold leading-tight text-black">{job.company}</h3>
            <p className="truncate text-sm font-semibold text-gray-800">{job.title}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onShare(job);
          }}
          className="absolute right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg bg-transparent hover:bg-gray-50"
          aria-label={t('share')}
        >
          <Share2 className="h-5 w-5 text-black" />
        </button>
      </div>
      <div className="space-y-1 px-2 py-2">
        <p className="flex items-center gap-1 truncate text-xs text-gray-600">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-black" />
          <span className="truncate">
            {job.city}, {job.state}
          </span>
        </p>
        <p className="text-sm font-bold text-black">{pay}</p>
        <div className="flex flex-wrap gap-1 pt-0.5">
          <span className="rounded-lg bg-black px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {t('easyApply')}
          </span>
          <span className="rounded-lg border-2 border-black px-2 py-0.5 text-[10px] font-semibold text-black">
            {employmentLabel}
          </span>
          <span className="rounded-lg border-2 border-black px-2 py-0.5 text-[10px] font-semibold text-black">
            {categoryLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
