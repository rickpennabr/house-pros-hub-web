'use client';

import { useTranslations } from 'next-intl';
import { googleCalendarUrl, outlookCalendarUrl, type CalendarEventLinkInput } from '@/lib/booking/calendarLinks';

interface AddToCalendarProps {
  event: CalendarEventLinkInput;
  icsHref?: string | null;
  align?: 'center' | 'start';
}

const linkClass =
  'inline-flex items-center justify-center rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-50';

/** One tap into Google Calendar, Outlook, or a file every other calendar can import. */
export default function AddToCalendar({ event, icsHref, align = 'start' }: AddToCalendarProps) {
  const t = useTranslations('appointments');
  const google = googleCalendarUrl(event);
  const outlook = outlookCalendarUrl(event);
  if (!google && !outlook && !icsHref) return null;

  return (
    <div className={align === 'center' ? 'text-center' : 'text-left'}>
      <p className="text-sm font-medium text-gray-900">{t('addToCalendar')}</p>
      <div className={`mt-2 flex flex-wrap gap-2 ${align === 'center' ? 'justify-center' : ''}`}>
        {google && (
          <a href={google} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t('googleCalendar')}
          </a>
        )}
        {outlook && (
          <a href={outlook} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t('outlookCalendar')}
          </a>
        )}
        {icsHref && (
          <a href={icsHref} className={linkClass}>
            {t('otherCalendar')}
          </a>
        )}
      </div>
    </div>
  );
}
