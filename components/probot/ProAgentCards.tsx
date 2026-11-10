'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ProAgentPayload } from '@/lib/types/chat';

interface ProAgentCardsProps {
  payload: ProAgentPayload;
  canConfirm: boolean;
  confirming: boolean;
  onConfirm?: (stepId: string) => void;
  onEdit?: () => void;
}

function optionLabel(has: (key: string) => boolean, text: (key: string) => string, key: string): string {
  return key && has(key) ? text(key) : key;
}

export default function ProAgentCards({ payload, canConfirm, confirming, onConfirm, onEdit }: ProAgentCardsProps) {
  const t = useTranslations('probot');
  const projectType = useTranslations('estimate.options.projectType');
  const budget = useTranslations('estimate.options.budgetRange');
  const timeline = useTranslations('estimate.options.timeline');
  const summary = payload.confirm?.summary;

  return (
    <div className="mt-2 space-y-2">
      {payload.pros && payload.pros.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-gray-500">{t('prosHeading')}</p>
          {payload.pros.map((pro) => (
            <Link
              key={pro.id}
              href={pro.profileUrl}
              className="block rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 hover:bg-gray-100"
            >
              <span className="block text-sm font-medium text-gray-900">{pro.name}</span>
              <span className="block text-xs text-gray-500">
                {[pro.category, [pro.city, pro.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
              </span>
            </Link>
          ))}
        </div>
      )}
      {summary && payload.confirm && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-sm font-medium text-gray-900">{t('confirmEstimate')}</p>
          <p className="mt-1 text-sm text-gray-700">
            {summary.firstName} {summary.lastName}
          </p>
          <p className="text-sm text-gray-700">
            {summary.streetAddress}, {summary.city} {summary.state}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {[
              (Array.isArray(summary.trades) ? summary.trades : []).join(', '),
              optionLabel(projectType.has, projectType, summary.projectType),
              optionLabel(budget.has, budget, summary.budgetRange),
              optionLabel(timeline.has, timeline, summary.timeline),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {payload.confirmed ? (
            <p className="mt-2 text-xs font-medium text-gray-600">{t('estimateSent')}</p>
          ) : canConfirm ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={confirming}
                onClick={() => onConfirm?.(payload.confirm!.stepId)}
                className="rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {confirming ? t('confirmingEstimate') : t('confirmEstimateButton')}
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full border-2 border-black px-3 py-1.5 text-xs font-medium text-gray-900"
              >
                {t('editEstimate')}
              </button>
            </div>
          ) : null}
        </div>
      )}
      {payload.confirmed && !summary && (
        <p className="text-xs font-medium text-gray-500">{t('estimateSent')}</p>
      )}
    </div>
  );
}
