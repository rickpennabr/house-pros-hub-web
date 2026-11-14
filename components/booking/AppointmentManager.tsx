'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import AddToCalendar from '@/components/booking/AddToCalendar';
import { visitCalendarDescription, visitCalendarTitle } from '@/lib/booking/calendarLinks';

interface AppointmentCard {
  businessName: string;
  businessEmail: string | null;
  businessPhone: string | null;
  serviceName: string | null;
  visitAddress: string | null;
  visitNote: string | null;
  startAt: string;
  endAt: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  timezone: string;
  canChange: boolean;
}

interface SlotChoice {
  start: string;
  end: string;
}

export default function AppointmentManager({ token }: { token: string }) {
  const t = useTranslations('appointments');
  const locale = useLocale();
  const { isAuthenticated } = useAuth();
  const [appointment, setAppointment] = useState<AppointmentCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(() => new Date());
  const [slots, setSlots] = useState<SlotChoice[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const [slotZone, setSlotZone] = useState('America/Los_Angeles');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/appointments/${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setMissing(true);
        setLoading(false);
        return;
      }
      setAppointment(data.appointment as AppointmentCard);
      setSlotZone(data.appointment?.timezone || 'America/Los_Angeles');
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const when = appointment
    ? new Date(appointment.startAt).toLocaleString(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: appointment.timezone,
      })
    : '';

  const statusLabel =
    appointment?.status === 'cancelled' ? t('cancelled') : appointment?.status === 'completed' ? t('completed') : t('confirmed');

  const save = async (body: Record<string, string>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('saveFailed'));
      setAppointment(data.appointment as AppointmentCard);
      setConfirmCancel(false);
      setRescheduling(false);
      setPickedDay(null);
      setNotice(body.action === 'cancel' ? t('cancelDone', { name: appointment?.businessName ?? '' }) : t('rescheduleDone', { name: appointment?.businessName ?? '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const loadDay = async (dateKey: string) => {
    setPickedDay(dateKey);
    setSlotsLoading(true);
    setError(null);
    const res = await fetch(`/api/appointments/${encodeURIComponent(token)}/slots?date=${dateKey}`);
    const data = await res.json().catch(() => ({}));
    setSlotsLoading(false);
    if (!res.ok) {
      setSlots([]);
      setError(data.error || t('saveFailed'));
      return;
    }
    if (data.timezone) setSlotZone(data.timezone);
    setSlots(data.slots ?? []);
  };

  if (loading) return <p className="p-4 text-sm text-gray-600">{t('loading')}</p>;
  if (missing || !appointment) return <p className="p-4 text-sm text-gray-700">{t('notFound')}</p>;

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 p-4">
      {isAuthenticated && (
        <Link href={`/${locale}/appointments`} className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-black">
          <ChevronLeft className="h-4 w-4" /> {t('back')}
        </Link>
      )}
      <section className="rounded-lg border-2 border-black bg-white p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{t('with')}</p>
        <h2 className="text-xl font-bold text-black">{appointment.businessName}</h2>
        {appointment.serviceName && (
          <p className="mt-2 text-sm text-gray-700">
            <span className="font-medium">{t('service')}:</span> {appointment.serviceName}
          </p>
        )}
        {appointment.visitAddress && (
          <p className="mt-1 text-sm text-gray-700">
            <span className="font-medium">{t('address')}:</span> {appointment.visitAddress}
          </p>
        )}
        {appointment.visitNote && (
          <p className="mt-1 text-sm text-gray-700">
            <span className="font-medium">{t('note')}:</span> {appointment.visitNote}
          </p>
        )}
        <p className="mt-1 text-sm text-gray-700">
          <span className="font-medium">{t('when')}:</span> {when}
        </p>
        <p className="mt-1 text-sm text-gray-700">
          <span className="font-medium">{t('status')}:</span> {statusLabel}
        </p>
        {appointment.status === 'confirmed' && (
          <div className="mt-4">
            <AddToCalendar
              icsHref={`/api/appointments/${encodeURIComponent(token)}/ics`}
              event={{
                title: visitCalendarTitle(appointment.businessName, appointment.serviceName),
                description: visitCalendarDescription([
                  appointment.businessName,
                  appointment.visitNote,
                  typeof window !== 'undefined' ? window.location.href : null,
                ]),
                location: appointment.visitAddress ?? '',
                startAt: appointment.startAt,
                endAt: appointment.endAt,
              }}
            />
          </div>
        )}
      </section>

      {notice && <p className="rounded-lg border-2 border-black bg-gray-50 p-3 text-sm text-gray-800">{notice}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

      {appointment.status === 'cancelled' && <p className="text-sm text-gray-700">{t('cancelledNote')}</p>}
      {appointment.status === 'completed' && <p className="text-sm text-gray-700">{t('completedNote')}</p>}

      {appointment.status === 'confirmed' && !appointment.canChange && (
        <div className="rounded-lg border-2 border-black p-4 text-sm text-gray-800">
          <p>{t('locked')}</p>
          <p className="mt-2">{t('contactPro', { name: appointment.businessName })}</p>
          {appointment.businessPhone && (
            <a className="mt-2 block font-medium underline" href={`tel:${appointment.businessPhone}`}>
              {appointment.businessPhone}
            </a>
          )}
          {appointment.businessEmail && (
            <a className="mt-1 block font-medium underline" href={`mailto:${appointment.businessEmail}`}>
              {appointment.businessEmail}
            </a>
          )}
        </div>
      )}

      {appointment.canChange && !rescheduling && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">{t('policy')}</p>
          {confirmCancel ? (
            <div className="space-y-2 rounded-lg border-2 border-black p-4">
              <p className="text-sm text-gray-800">{t('confirmCancel')}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => void save({ action: 'cancel' })}>
                  {busy ? t('saving') : t('cancel')}
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setConfirmCancel(false)}>
                  {t('keep')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="primary" onClick={() => { setRescheduling(true); setNotice(null); }}>
                {t('reschedule')}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => { setConfirmCancel(true); setNotice(null); }}>
                {t('cancel')}
              </Button>
            </div>
          )}
        </div>
      )}

      {appointment.canChange && rescheduling && (
        <ReschedulePicker
          cursor={cursor}
          locale={locale}
          pickedDay={pickedDay}
          slotZone={slotZone}
          slots={slots}
          slotsLoading={slotsLoading}
          busy={busy}
          onMonth={(delta) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))}
          onDay={(dateKey) => void loadDay(dateKey)}
          onSlot={(slot) => void save({ action: 'reschedule', slotStartAt: slot.start, slotEndAt: slot.end })}
          onClose={() => setRescheduling(false)}
        />
      )}
    </div>
  );
}

function ReschedulePicker({
  cursor,
  locale,
  pickedDay,
  slotZone,
  slots,
  slotsLoading,
  busy,
  onMonth,
  onDay,
  onSlot,
  onClose,
}: {
  cursor: Date;
  locale: string;
  pickedDay: string | null;
  slotZone: string;
  slots: SlotChoice[];
  slotsLoading: boolean;
  busy: boolean;
  onMonth: (delta: number) => void;
  onDay: (dateKey: string) => void;
  onSlot: (slot: SlotChoice) => void;
  onClose: () => void;
}) {
  const t = useTranslations('appointments');
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const first = new Date(year, month, 1);
  const blanks = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const monthLabel = first.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const weekdayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + index)))
      ),
    [locale]
  );

  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: slotZone });

  return (
    <div className="space-y-3">
      <p className="text-base font-medium text-gray-900">{t('pickDay')}</p>
      <div className="overflow-hidden rounded-lg border-2 border-black bg-white">
        <div className="flex items-center justify-between border-b-2 border-black bg-gray-50 px-3 py-2">
          <button type="button" className="rounded-lg border-2 border-black p-2" onClick={() => onMonth(-1)} aria-label={t('previous')}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="font-bold text-gray-900">{monthLabel}</p>
          <button type="button" className="rounded-lg border-2 border-black p-2" onClick={() => onMonth(1)} aria-label={t('next')}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 bg-gray-100">
          {weekdayLabels.map((label) => (
            <div key={label} className="py-2 text-center text-xs font-semibold text-gray-700">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: blanks }, (_, index) => (
            <div key={`blank-${index}`} className="min-h-11 bg-gray-50" />
          ))}
          {Array.from({ length: days }, (_, index) => {
            const day = index + 1;
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const past = dateKey < todayKey;
            const selected = dateKey === pickedDay;
            return (
              <button
                key={dateKey}
                type="button"
                disabled={past}
                onClick={() => onDay(dateKey)}
                className={`min-h-11 border-t border-gray-200 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${selected ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
      {pickedDay && (
        <div>
          <p className="mb-2 text-base font-medium text-gray-900">{t('pickTime')}</p>
          {slotsLoading ? (
            <p className="text-sm text-gray-500">{t('loading')}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-500">{t('noSlots')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  disabled={busy}
                  onClick={() => onSlot(slot)}
                  className="rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {clock(slot.start)} – {clock(slot.end)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <Button type="button" size="sm" variant="secondary" onClick={onClose}>
        {t('keep')}
      </Button>
    </div>
  );
}
