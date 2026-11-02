'use client';

import { DAY_KEYS, formatHm, weekdayLabel, type WeekSchedule } from '@/lib/booking/businessHours';

interface BusinessHoursListProps {
  schedule: WeekSchedule;
  timezone: string;
  locale: string;
  heading: string;
  closedLabel: string;
}

export default function BusinessHoursList({ schedule, timezone, locale, heading, closedLabel }: BusinessHoursListProps) {
  const zoneLabel = timezone.replace(/_/g, ' ').replace('America/', '').replace('Pacific/', '');
  return (
    <section className="mb-4 rounded-lg border-2 border-black p-3">
      <h2 className="text-lg font-bold text-black">{heading}</h2>
      <p className="mb-2 text-xs text-gray-500">{zoneLabel}</p>
      <ul className="space-y-1">
        {DAY_KEYS.map((day) => {
          const row = schedule[day];
          const hours = row.open ? `${formatHm(row.start, locale)} – ${formatHm(row.end, locale)}` : closedLabel;
          return (
            <li key={day} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-black">{weekdayLabel(day, locale)}</span>
              <span className="text-gray-800">{hours}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
