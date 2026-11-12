import { formatAmount } from '@/lib/invoices/format';
import {
  ESTIMATE_STATUSES,
  type EstimateStatusKey,
  type EstimateStatusSummary,
} from '@/lib/crm/estimate-books';

interface EstimateStatusCardsProps {
  summary: EstimateStatusSummary;
  active: string;
  onSelect: (status: string) => void;
}

function statusLabel(status: EstimateStatusKey): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'estimate' : 'estimates'}`;
}

export function EstimateStatusCards({ summary, active, onSelect }: EstimateStatusCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:pb-3">
      {ESTIMATE_STATUSES.map((status) => {
        const bucket = summary[status];
        const selected = active === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelect(selected ? '' : status)}
            className={`rounded-lg border-2 border-black px-3 py-2 text-left cursor-pointer ${selected ? 'bg-black text-white' : 'bg-white text-black'}`}
          >
            <p className={`text-xs ${selected ? 'text-white' : 'text-gray-500'}`}>{statusLabel(status)}</p>
            <p className="text-base font-semibold">{formatAmount(bucket.cents)}</p>
            <p className={`text-xs ${selected ? 'text-white' : 'text-gray-500'}`}>{countLabel(bucket.count)}</p>
          </button>
        );
      })}
    </div>
  );
}
