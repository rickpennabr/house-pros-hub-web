'use client';

import { useTranslations } from 'next-intl';
import { DAY_KEYS, formatHm, weekdayLabel, type WeekSchedule } from '@/lib/booking/businessHours';

interface BusinessHoursListProps {
  schedule: WeekSchedule;
  timezone: string;
  locale: string;
  heading: string;
  closedLabel: string;
}

function timeZoneName(timeZone: string, locale: string): string {
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'longGeneric' })
      .formatToParts(new Date())
      .find((item) => item.type === 'timeZoneName');
    return part?.value || timeZone;
  } catch {
    return timeZone.replace(/_/g, ' ');
  }
}

export default function BusinessHoursList({ schedule, timezone, locale, heading, closedLabel }: BusinessHoursListProps) {
  const t = useTranslations('businessHours');
  const zone = timeZoneName(timezone, locale);
  return (
    <section className="mb-4 rounded-lg border-2 border-black p-3">
      <h2 className="text-lg font-bold text-black">{heading}</h2>
      <p className="mb-2 text-xs text-gray-500">{t('timesIn', { zone })}</p>
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
