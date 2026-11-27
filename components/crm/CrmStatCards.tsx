export interface CrmStatCard {
  /** The list filter this card turns on (the same value the filter buttons use). */
  key: string;
  label: string;
  /** Big line: an amount or a count. */
  value: string;
  /** Small line under it, e.g. "3 invoices". */
  sub: string;
  /** Red text for things that need attention (overdue). */
  alert?: boolean;
}

/**
 * Indicator cards at the top of a CRM list (estimates, invoices, projects…). Tap one to filter the
 * list to it; tap again to clear. Same look as the estimates cards.
 */
export function CrmStatCards({ cards, active = '', onSelect }: { cards: CrmStatCard[]; active?: string; onSelect?: (key: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:pb-3">
      {cards.map((card) => {
        const selected = active === card.key;
        const muted = selected ? 'text-white' : 'text-gray-500';
        // Display-only cards (no filter on that page) are plain boxes, not buttons.
        const Tag = onSelect ? 'button' : 'div';
        return (
          <Tag
            key={card.key}
            {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(selected ? '' : card.key), 'aria-pressed': selected } : {})}
            className={`rounded-lg border-2 border-black px-3 py-2 text-left ${onSelect ? 'cursor-pointer' : ''} ${selected ? 'bg-black text-white' : 'bg-white text-black'}`}
          >
            <p className={`text-xs ${card.alert && !selected ? 'text-red-600 font-medium' : muted}`}>{card.label}</p>
            <p className={`text-base font-semibold ${card.alert && !selected ? 'text-red-600' : ''}`}>{card.value}</p>
            <p className={`text-xs ${muted}`}>{card.sub}</p>
          </Tag>
        );
      })}
    </div>
  );
}
