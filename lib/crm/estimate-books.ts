import type { MoneyBucket } from '@/lib/crm/contact-books';

export const ESTIMATE_STATUSES = ['draft', 'sent', 'accepted', 'declined'] as const;

export type EstimateStatusKey = (typeof ESTIMATE_STATUSES)[number];

export type EstimateStatusSummary = Record<EstimateStatusKey, MoneyBucket>;

export function emptyEstimateStatusSummary(): EstimateStatusSummary {
  return {
    draft: { count: 0, cents: 0 },
    sent: { count: 0, cents: 0 },
    accepted: { count: 0, cents: 0 },
    declined: { count: 0, cents: 0 },
  };
}

export function summarizeEstimateStatuses(
  rows: Array<{ status: string; amountCents: number }>
): EstimateStatusSummary {
  const summary = emptyEstimateStatusSummary();
  for (const row of rows) {
    if (!ESTIMATE_STATUSES.includes(row.status as EstimateStatusKey)) continue;
    const bucket = summary[row.status as EstimateStatusKey];
    bucket.count += 1;
    bucket.cents += Math.round(row.amountCents) || 0;
  }
  return summary;
}

export function estimateStatusTotal(summary: EstimateStatusSummary): MoneyBucket {
  return ESTIMATE_STATUSES.reduce(
    (total, status) => ({
      count: total.count + summary[status].count,
      cents: total.cents + summary[status].cents,
    }),
    { count: 0, cents: 0 }
  );
}
