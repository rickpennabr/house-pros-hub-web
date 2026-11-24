'use client';

import { Eye, Pencil } from 'lucide-react';

/** Edit plus what the customer sees on the estimate link. Same bar as the invoice views. */
export const ESTIMATE_VIEWS = [
  { id: 'edit', label: 'Edit estimate', icon: Pencil },
  { id: 'customer', label: 'Customer view', icon: Eye },
] as const;
export type EstimateView = (typeof ESTIMATE_VIEWS)[number]['id'];

export function EstimateViewTabs({ view, onChange }: { view: EstimateView; onChange: (view: EstimateView) => void }) {
  return (
    <div className="no-print mb-3 overflow-x-auto" role="tablist" aria-label="Estimate views">
      <div className="flex h-10 w-max items-center gap-2">
        {ESTIMATE_VIEWS.map((item) => {
          const selected = view === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(item.id)}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg border-2 px-3 text-sm font-medium transition-colors ${
                selected ? 'border-black bg-black text-white' : 'border-transparent text-black hover:border-gray-400'
              }`}
            >
              <Icon className="h-[1.125rem] w-[1.125rem] text-red-500" aria-hidden />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
