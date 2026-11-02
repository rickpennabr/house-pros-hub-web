'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Copy, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import AddTaskModal from '@/components/crm/AddTaskModal';
import {
  BUSINESS_TIMEZONES,
  DAY_KEYS,
  SLOT_MINUTE_OPTIONS,
  cloneSchedule,
  dateKeyInZone,
  dayKeyForDateKey,
  minutesSinceMidnight,
  slotsForDateKey,
  weekdayLabel,
  type SlotMinutes,
  type WeekSchedule,
} from '@/lib/booking/businessHours';

type View = 'month' | 'week' | 'day' | 'agenda';

interface HoursBusiness {
  id: string;
  slug: string;
  businessName: string;
  timezone: string;
  slotMinutes: SlotMinutes;
  bookingEnabled: boolean;
  schedule: WeekSchedule;
  hoursConfigured: boolean;
}

interface Block {
  id: string;
  type: 'available' | 'unavailable' | 'appointment';
  start_at: string;
  end_at: string;
  note: string | null;
}

interface TaskItem {
  id: string;
  task_type: string;
  meeting_with?: string | null;
  start_at: string;
  end_at: string;
  note?: string | null;
  pro_crm_customers?: { first_name?: string; last_name?: string; display_name?: string | null } | null;
}

interface BookingItem {
  id: string;
  name: string;
  serviceName: string | null;
  startAt: string;
  endAt: string;
  status: string;
  phone: string | null;
}

const HOUR_PX = 52;
const TASK_LABEL: Record<string, string> = {
  estimate_appointment: 'Estimate',
  business_meeting: 'Meeting',
  follow_up: 'Follow up',
  other: 'Task',
};

function localKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(key: string, days: number): string {
  const date = fromKey(key);
  date.setDate(date.getDate() + days);
  return localKey(date);
}

function startOfWeek(key: string): string {
  const date = fromKey(key);
  date.setDate(date.getDate() - date.getDay());
  return localKey(date);
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(aEnd).getTime() > new Date(bStart).getTime();
}

function coversDay(startIso: string, endIso: string, key: string): boolean {
  const start = fromKey(key);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return new Date(startIso) <= end && new Date(endIso) >= start;
}

function formatWhen(iso: string, timeZone: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

function formatClock(iso: string, timeZone: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone });
}

function taskName(task: TaskItem): string {
  const customer = task.pro_crm_customers;
  const fromCustomer =
    customer?.display_name?.trim() ||
    [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim();
  return fromCustomer || task.meeting_with || TASK_LABEL[task.task_type] || 'Task';
}

interface ProCalendarProps {
  initialBusinessId?: string;
}

export default function ProCalendar({ initialBusinessId }: ProCalendarProps) {
  const t = useTranslations('proCalendar');
  const locale = useLocale();
  const [cursor, setCursor] = useState(() => localKey(new Date()));
  const [view, setView] = useState<View>('month');
  const [businesses, setBusinesses] = useState<HoursBusiness[]>([]);
  const [businessId, setBusinessId] = useState(initialBusinessId ?? '');
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [slotMinutes, setSlotMinutes] = useState<SlotMinutes>(90);
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showBookings, setShowBookings] = useState(true);
  const [showBlocks, setShowBlocks] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [blockType, setBlockType] = useState<Block['type']>('unavailable');
  const [blockStart, setBlockStart] = useState('09:00');
  const [blockEnd, setBlockEnd] = useState('12:00');
  const [blockNote, setBlockNote] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const business = businesses.find((item) => item.id === businessId) ?? null;

  const loadHours = useCallback(async () => {
    const res = await fetch('/api/crm/hours', { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t('loadFailed'));
    const list = (data.businesses ?? []) as HoursBusiness[];
    setBusinesses(list);
    setBusinessId((current) => current || list[0]?.id || '');
  }, [t]);

  useEffect(() => {
    const current = businesses.find((item) => item.id === businessId);
    if (!current) return;
    setSchedule(cloneSchedule(current.schedule));
    setTimezone(current.timezone);
    setSlotMinutes(current.slotMinutes);
    setBookingEnabled(current.bookingEnabled);
  }, [businessId, businesses]);

  const visibleDays = useMemo(() => {
    if (view === 'week') return Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursor), index));
    if (view === 'day') return [cursor];
    if (view === 'agenda') return Array.from({ length: 21 }, (_, index) => addDays(cursor, index));
    const first = fromKey(cursor);
    const gridStart = new Date(first.getFullYear(), first.getMonth(), 1);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return localKey(day);
    });
  }, [cursor, view]);

  const loadCalendar = useCallback(async () => {
    const from = fromKey(visibleDays[0] ?? cursor);
    const to = fromKey(visibleDays[visibleDays.length - 1] ?? cursor);
    to.setHours(23, 59, 59, 999);
    setLoading(true);
    setError(null);
    try {
      const query = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
      const [availabilityRes, taskRes, bookingRes] = await Promise.all([
        fetch(`/api/crm/availability?${query}`, { credentials: 'include' }),
        fetch(`/api/crm/tasks?${query}`, { credentials: 'include' }),
        fetch(`/api/crm/bookings?${query}`, { credentials: 'include' }),
      ]);
      const availability = await availabilityRes.json().catch(() => ({}));
      const taskData = await taskRes.json().catch(() => ({}));
      const bookingData = await bookingRes.json().catch(() => ({}));
      if (!availabilityRes.ok) throw new Error(availability.error || t('loadFailed'));
      setBlocks(availability.availability ?? []);
      setTasks(taskRes.ok ? taskData.tasks ?? [] : []);
      setBookings(bookingRes.ok ? bookingData.bookings ?? [] : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [cursor, t, visibleDays]);

  useEffect(() => {
    void loadHours().catch((err: unknown) => setError(err instanceof Error ? err.message : t('loadFailed')));
  }, [loadHours, t]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const saveHours = async (enabled = bookingEnabled) => {
    if (!businessId || !schedule) return;
    setSavingHours(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/crm/hours', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          timezone,
          slotMinutes,
          bookingEnabled: enabled,
          schedule,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('saveFailed'));
      setBookingEnabled(enabled);
      setBusinesses((current) =>
        current.map((item) =>
          item.id === businessId
            ? { ...item, timezone, slotMinutes, bookingEnabled: enabled, schedule: cloneSchedule(schedule), hoursConfigured: true }
            : item
        )
      );
      setNotice(typeof data.warning === 'string' ? data.warning : t('saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setSavingHours(false);
    }
  };

  const shift = (direction: -1 | 1) => {
    if (view === 'month') {
      const date = fromKey(cursor);
      date.setMonth(date.getMonth() + direction);
      setCursor(localKey(date));
      return;
    }
    setCursor(addDays(cursor, view === 'day' ? direction : direction * 7));
  };

  const title = useMemo(() => {
    if (view === 'day') {
      return fromKey(cursor).toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    if (view === 'week' || view === 'agenda') {
      const end = visibleDays[visibleDays.length - 1] ?? cursor;
      return `${fromKey(visibleDays[0] ?? cursor).toLocaleDateString(locale, { month: 'short', day: 'numeric' })} – ${fromKey(end).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`;
    }
    return fromKey(cursor).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }, [cursor, locale, view, visibleDays]);

  const gridStart = 7;
  const gridEnd = 19;

  const daySlots = schedule
    ? slotsForDateKey({ dateKey: cursor, schedule, timeZone: timezone, slotMinutes })
    : [];

  const moveChoices = selectedBooking && schedule
    ? slotsForDateKey({
        dateKey: dateKeyInZone(new Date(selectedBooking.startAt), timezone),
        schedule,
        timeZone: timezone,
        slotMinutes,
      }).filter((slot) => {
        const start = slot.start.toISOString();
        const end = slot.end.toISOString();
        const taken = bookings.some(
          (item) =>
            item.id !== selectedBooking.id &&
            item.status === 'confirmed' &&
            overlaps(item.startAt, item.endAt, start, end)
        );
        const off = blocks.some((item) => item.type === 'unavailable' && overlaps(item.start_at, item.end_at, start, end));
        return !taken && !off;
      })
    : [];

  const updateBooking = async (body: Record<string, string>) => {
    if (!selectedBooking) return;
    setError(null);
    const res = await fetch(`/api/crm/bookings/${selectedBooking.id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t('saveFailed'));
    setSelectedBooking(null);
    await loadCalendar();
  };

  const toggleSlot = async (start: Date, end: Date) => {
    const covering = blocks.find(
      (block) =>
        block.type === 'unavailable' &&
        new Date(block.start_at).getTime() <= start.getTime() &&
        new Date(block.end_at).getTime() >= end.getTime()
    );
    setError(null);
    const res = covering
      ? await fetch(`/api/crm/availability/${covering.id}`, { method: 'DELETE', credentials: 'include' })
      : await fetch('/api/crm/availability', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'unavailable', startAt: start.toISOString(), endAt: end.toISOString() }),
        });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || t('saveFailed'));
      return;
    }
    await loadCalendar();
  };

  const saveBlock = async () => {
    const start = new Date(`${cursor}T${blockStart}:00`);
    const end = new Date(`${cursor}T${blockEnd}:00`);
    if (isNaN(start.getTime()) || end <= start) {
      setError(t('saveFailed'));
      return;
    }
    const res = await fetch('/api/crm/availability', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: blockType, startAt: start.toISOString(), endAt: end.toISOString(), note: blockNote.trim() || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || t('saveFailed'));
      return;
    }
    setShowAddBlock(false);
    setBlockNote('');
    await loadCalendar();
  };

  const copyLink = async () => {
    if (!business) return;
    await navigator.clipboard.writeText(`${window.location.origin}/${locale}/book/${business.slug}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const chipsForDay = (key: string) => {
    const items: { id: string; label: string; className: string; onClick: () => void }[] = [];
    if (showBookings) {
      bookings
        .filter((item) => item.status !== 'cancelled' && coversDay(item.startAt, item.endAt, key))
        .forEach((item) =>
          items.push({
            id: item.id,
            label: item.name,
            className: 'bg-emerald-100 text-emerald-900',
            onClick: () => setSelectedBooking(item),
          })
        );
    }
    if (showTasks) {
      tasks
        .filter((item) => coversDay(item.start_at, item.end_at, key))
        .forEach((item) =>
          items.push({
            id: item.id,
            label: taskName(item),
            className: 'bg-sky-100 text-sky-900',
            onClick: () => {
              setCursor(key);
              setView('day');
            },
          })
        );
    }
    if (showBlocks) {
      blocks
        .filter((item) => coversDay(item.start_at, item.end_at, key))
        .forEach((item) =>
          items.push({
            id: item.id,
            label: item.type === 'unavailable' ? t('timeOff') : item.type === 'available' ? t('availableWindow') : t('appointmentBlock'),
            className: item.type === 'unavailable' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-800',
            onClick: () => setSelectedBlock(item),
          })
        );
    }
    return items;
  };

  const renderTimeGrid = (days: string[]) => (
    <div className="overflow-x-auto rounded-lg border-2 border-black">
      <div className="grid" style={{ gridTemplateColumns: `52px repeat(${days.length}, minmax(108px, 1fr))` }}>
        <div />
        {days.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setCursor(key);
              setView('day');
            }}
            className="border-b-2 border-l-2 border-black px-1 py-2 text-left text-xs font-semibold"
          >
            {fromKey(key).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })}
          </button>
        ))}
        <div>
          {Array.from({ length: gridEnd - gridStart }, (_, index) => (
            <div key={index} className="border-t border-gray-200 pr-1 text-right text-[10px] text-gray-500" style={{ height: HOUR_PX }}>
              {new Date(2026, 0, 5, gridStart + index).toLocaleTimeString(locale, { hour: 'numeric' })}
            </div>
          ))}
        </div>
        {days.map((key) => {
          const closed = schedule ? !schedule[dayKeyForDateKey(key, timezone)]?.open : false;
          return (
            <div key={key} className={`relative border-l-2 border-black ${closed ? 'bg-gray-50' : 'bg-white'}`} style={{ height: (gridEnd - gridStart) * HOUR_PX }}>
              {Array.from({ length: gridEnd - gridStart }, (_, index) => (
                <div key={index} className="border-t border-gray-100" style={{ height: HOUR_PX }} />
              ))}
              {showBookings &&
                bookings
                  .filter((item) => item.status === 'confirmed' && dateKeyInZone(new Date(item.startAt), timezone) === key)
                  .map((item) => (
                    <TimedChip
                      key={item.id}
                      start={item.startAt}
                      end={item.endAt}
                      timeZone={timezone}
                      className="bg-emerald-200"
                      onClick={() => setSelectedBooking(item)}
                      label={item.name}
                    />
                  ))}
              {showTasks &&
                tasks
                  .filter((item) => dateKeyInZone(new Date(item.start_at), timezone) === key)
                  .map((item) => (
                    <TimedChip
                      key={item.id}
                      start={item.start_at}
                      end={item.end_at}
                      timeZone={timezone}
                      className="bg-sky-200"
                      onClick={() => undefined}
                      label={taskName(item)}
                    />
                  ))}
              {showBlocks &&
                blocks
                  .filter((item) => item.type === 'unavailable' && dateKeyInZone(new Date(item.start_at), timezone) === key)
                  .map((item) => (
                    <TimedChip
                      key={item.id}
                      start={item.start_at}
                      end={item.end_at}
                      timeZone={timezone}
                      className="bg-amber-200"
                      onClick={() => setSelectedBlock(item)}
                      label={t('timeOff')}
                    />
                  ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-3 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-black">{t('title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setShowAddBlock(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('addBlock')}
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={() => setShowAddTask(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('addTask')}
          </Button>
        </div>
      </div>

      {error && <p className="rounded-lg border-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg border-2 border-black bg-emerald-50 px-3 py-2 text-sm">{notice}</p>}

      <section className="rounded-lg border-2 border-black p-3">
        <button type="button" className="text-sm font-bold" onClick={() => setSettingsOpen((open) => !open)}>
          {t('settings')}
        </button>
        {settingsOpen && (
          <div className="mt-3 space-y-3">
            {businesses.length === 0 ? (
              <p className="text-sm text-gray-600">{t('noBusiness')}</p>
            ) : (
              <>
                {businesses.length > 1 && (
                  <FormField label={t('business')}>
                    <Select value={businessId} onChange={(event) => setBusinessId(event.target.value)}>
                      {businesses.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.businessName}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                )}
                <p className="text-sm text-gray-600">{t('acceptHint')}</p>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={bookingEnabled}
                    disabled={savingHours || !schedule}
                    onChange={(event) => void saveHours(event.target.checked)}
                  />
                  {t('acceptAppointments')}
                </label>
                <p className="text-xs text-gray-500">{t('freeEstimate')}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={t('timezone')}>
                    <Select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                      {BUSINESS_TIMEZONES.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone.replace(/_/g, ' ').replace('America/', '').replace('Pacific/', '')}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label={t('slotLength')}>
                    <Select
                      value={String(slotMinutes)}
                      onChange={(event) => setSlotMinutes(Number(event.target.value) as SlotMinutes)}
                    >
                      {SLOT_MINUTE_OPTIONS.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {t('minutes', { count: minutes })}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
                <p className="text-sm text-gray-600">{t('hoursHint')}</p>
                {schedule && (
                  <div className="space-y-2">
                    {DAY_KEYS.map((day) => (
                      <div key={day} className="grid grid-cols-[1.2fr_auto_1fr_1fr] items-center gap-2">
                        <span className="text-sm font-medium">{weekdayLabel(day, locale)}</span>
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={schedule[day].open}
                            onChange={(event) =>
                              setSchedule((current) =>
                                current
                                  ? { ...current, [day]: { ...current[day], open: event.target.checked } }
                                  : current
                              )
                            }
                          />
                          {schedule[day].open ? t('open') : t('closed')}
                        </label>
                        <Input
                          type="time"
                          value={schedule[day].start}
                          onChange={(event) =>
                            setSchedule((current) =>
                              current ? { ...current, [day]: { ...current[day], start: event.target.value } } : current
                            )
                          }
                        />
                        <Input
                          type="time"
                          value={schedule[day].end}
                          onChange={(event) =>
                            setSchedule((current) =>
                              current ? { ...current, [day]: { ...current[day], end: event.target.value } } : current
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="primary" disabled={savingHours} onClick={() => void saveHours()}>
                    {savingHours ? t('saving') : t('saveHours')}
                  </Button>
                  {bookingEnabled && business && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => void copyLink()}>
                      <Copy className="mr-1 h-4 w-4" />
                      {linkCopied ? t('linkCopied') : t('copyLink')}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="secondary" onClick={() => shift(-1)} aria-label={t('back')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => setCursor(localKey(new Date()))}>
            {t('today')}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => shift(1)} aria-label={t('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-semibold">{title}</span>
        </div>
        <div className="flex gap-1">
          {(['month', 'week', 'day', 'agenda'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`rounded-lg border-2 px-2 py-1 text-xs font-medium ${view === item ? 'border-black bg-black text-white' : 'border-black bg-white'}`}
            >
              {item === 'month' ? t('month') : item === 'week' ? t('week') : item === 'day' ? t('day') : t('agenda')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <FilterChip checked={showBookings} onChange={setShowBookings} label={t('legendBooking')} swatch="bg-emerald-200" />
        <FilterChip checked={showTasks} onChange={setShowTasks} label={t('legendTask')} swatch="bg-sky-200" />
        <FilterChip checked={showBlocks} onChange={setShowBlocks} label={t('legendOff')} swatch="bg-amber-200" />
        {loading && <span className="text-gray-500">{t('loading')}</span>}
      </div>

      {view === 'month' && (
        <div className="grid grid-cols-7 overflow-hidden rounded-lg border-2 border-black">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="border-b-2 border-black bg-gray-50 px-1 py-1 text-center text-[11px] font-semibold">
              {fromKey(addDays(startOfWeek(cursor), index)).toLocaleDateString(locale, { weekday: 'short' })}
            </div>
          ))}
          {visibleDays.map((key) => {
            const date = fromKey(key);
            const inMonth = date.getMonth() === fromKey(cursor).getMonth();
            const closed = schedule ? !schedule[dayKeyForDateKey(key, timezone)]?.open : false;
            const chips = chipsForDay(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCursor(key);
                  setView('day');
                }}
                className={`min-h-24 border-t border-l border-gray-200 p-1 text-left ${inMonth ? '' : 'opacity-40'} ${closed ? 'bg-gray-50' : 'bg-white'}`}
              >
                <span className="text-xs font-semibold">{date.getDate()}</span>
                <div className="mt-1 space-y-0.5">
                  {chips.slice(0, 3).map((chip) => (
                    <span key={chip.id} className={`block truncate rounded px-1 text-[10px] ${chip.className}`}>
                      {chip.label}
                    </span>
                  ))}
                  {chips.length > 3 && <span className="text-[10px] text-gray-500">+{chips.length - 3}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {(view === 'week' || view === 'day') && renderTimeGrid(view === 'day' ? [cursor] : visibleDays)}

      {view === 'day' && (
        <div className="rounded-lg border-2 border-black p-3">
          <h2 className="mb-2 text-sm font-bold">{t('slotOn')}</h2>
          {daySlots.length === 0 ? (
            <p className="text-sm text-gray-600">{t('closed')}</p>
          ) : (
            <ul className="space-y-2">
              {daySlots.map((slot) => {
                const off = blocks.some(
                  (block) =>
                    block.type === 'unavailable' &&
                    new Date(block.start_at).getTime() <= slot.start.getTime() &&
                    new Date(block.end_at).getTime() >= slot.end.getTime()
                );
                return (
                  <li key={slot.start.toISOString()} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {formatClock(slot.start.toISOString(), timezone, locale)} – {formatClock(slot.end.toISOString(), timezone, locale)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void toggleSlot(slot.start, slot.end)}
                      className={`rounded-lg border-2 px-2 py-1 text-xs font-medium ${off ? 'border-amber-600 text-amber-800' : 'border-black'}`}
                    >
                      {off ? t('slotOff') : t('slotOn')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {view === 'agenda' && (
        <ul className="space-y-2">
          {[
            ...bookings
              .filter((item) => showBookings)
              .map((item) => ({
                id: item.id,
                at: item.startAt,
                label: `${item.name}${item.serviceName ? ` · ${item.serviceName}` : ''} · ${item.status}`,
                className: 'border-emerald-600',
                onClick: () => setSelectedBooking(item),
              })),
            ...tasks
              .filter(() => showTasks)
              .map((item) => ({
                id: item.id,
                at: item.start_at,
                label: taskName(item),
                className: 'border-sky-600',
                onClick: () => undefined,
              })),
            ...blocks
              .filter(() => showBlocks)
              .map((item) => ({
                id: item.id,
                at: item.start_at,
                label: item.note || (item.type === 'unavailable' ? t('timeOff') : t('availableWindow')),
                className: 'border-amber-600',
                onClick: () => setSelectedBlock(item),
              })),
          ]
            .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
            .map((item) => (
              <li key={item.id}>
                <button type="button" onClick={item.onClick} className={`w-full rounded-lg border-2 px-3 py-2 text-left text-sm ${item.className}`}>
                  <span className="block text-xs text-gray-500">{formatWhen(item.at, timezone, locale)}</span>
                  {item.label}
                </button>
              </li>
            ))}
          {bookings.length + tasks.length + blocks.length === 0 && <li className="text-sm text-gray-600">{t('noAgenda')}</li>}
        </ul>
      )}

      <AddTaskModal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        onSuccess={() => void loadCalendar()}
        businessHours={
          business
            ? { schedule: business.schedule, timezone: business.timezone, slotMinutes: business.slotMinutes }
            : null
        }
      />

      <Modal isOpen={showAddBlock} onClose={() => setShowAddBlock(false)} title={t('addBlock')} showHeader showCloseButton>
        <div className="space-y-3 p-4">
          <FormField label={t('blocks')}>
            <Select value={blockType} onChange={(event) => setBlockType(event.target.value as Block['type'])}>
              <option value="unavailable">{t('timeOff')}</option>
              <option value="available">{t('availableWindow')}</option>
              <option value="appointment">{t('appointmentBlock')}</option>
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label={t('start')}>
              <Input type="time" value={blockStart} onChange={(event) => setBlockStart(event.target.value)} />
            </FormField>
            <FormField label={t('end')}>
              <Input type="time" value={blockEnd} onChange={(event) => setBlockEnd(event.target.value)} />
            </FormField>
          </div>
          <FormField label={t('note')}>
            <Input value={blockNote} onChange={(event) => setBlockNote(event.target.value)} />
          </FormField>
          <Button type="button" size="sm" variant="primary" onClick={() => void saveBlock()}>
            {t('saveBlock')}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        title={selectedBooking?.name || t('legendBooking')}
        showHeader
        showCloseButton
      >
        {selectedBooking && (
          <div className="space-y-3 p-4 text-sm">
            <p>{formatWhen(selectedBooking.startAt, timezone, locale)}</p>
            {selectedBooking.serviceName && (
              <p>
                {t('service')}: {selectedBooking.serviceName}
              </p>
            )}
            <p>
              {t('status')}: {selectedBooking.status}
            </p>
            {selectedBooking.status === 'confirmed' && (
              <>
                <FormField label={t('moveTo')}>
                  <Select
                    value=""
                    onChange={(event) => {
                      const [start, end] = event.target.value.split('|');
                      if (start && end) void updateBooking({ slotStartAt: start, slotEndAt: end }).catch((err: unknown) => setError(err instanceof Error ? err.message : t('saveFailed')));
                    }}
                  >
                    <option value="">{t('moveTo')}</option>
                    {moveChoices.map((slot) => (
                      <option key={slot.start.toISOString()} value={`${slot.start.toISOString()}|${slot.end.toISOString()}`}>
                        {formatClock(slot.start.toISOString(), timezone, locale)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="primary" onClick={() => void updateBooking({ status: 'completed' }).catch((err: unknown) => setError(err instanceof Error ? err.message : t('saveFailed')))}>
                    {t('markComplete')}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => void updateBooking({ status: 'cancelled' }).catch((err: unknown) => setError(err instanceof Error ? err.message : t('saveFailed')))}>
                    {t('cancelBooking')}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!selectedBlock} onClose={() => setSelectedBlock(null)} title={t('blocks')} showHeader showCloseButton>
        {selectedBlock && (
          <div className="space-y-3 p-4 text-sm">
            <p>
              {formatWhen(selectedBlock.start_at, timezone, locale)} – {formatClock(selectedBlock.end_at, timezone, locale)}
            </p>
            {selectedBlock.note && <p>{selectedBlock.note}</p>}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                void fetch(`/api/crm/availability/${selectedBlock.id}`, { method: 'DELETE', credentials: 'include' }).then(async (res) => {
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    setError(data.error || t('saveFailed'));
                    return;
                  }
                  setSelectedBlock(null);
                  await loadCalendar();
                });
              }}
            >
              {t('deleteBlock')}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function FilterChip({
  checked,
  onChange,
  label,
  swatch,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  swatch: string;
}) {
  return (
    <label className="flex items-center gap-1">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className={`inline-block h-3 w-3 rounded ${swatch}`} />
      {label}
    </label>
  );
}

function TimedChip({
  start,
  end,
  timeZone,
  className,
  label,
  onClick,
}: {
  start: string;
  end: string;
  timeZone: string;
  className: string;
  label: string;
  onClick: () => void;
}) {
  const startMin = minutesSinceMidnight(new Date(start), timeZone);
  const endMin = Math.max(minutesSinceMidnight(new Date(end), timeZone), startMin + 20);
  const top = ((startMin - 7 * 60) / 60) * HOUR_PX;
  const height = Math.max(((endMin - startMin) / 60) * HOUR_PX, 18);
  if (top > 12 * HOUR_PX || top + height < 0) return null;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`absolute left-0.5 right-0.5 overflow-hidden rounded border border-black px-1 text-left text-[10px] font-medium ${className}`}
      style={{ top: Math.max(top, 0), height }}
    >
      {label}
    </button>
  );
}
