'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Trash2, AlertTriangle, Plus, Link2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import AddTaskModal from '@/components/crm/AddTaskModal';
import { getStandardSlotsForDay } from '@/lib/constants/bookingSlots';

interface AvailabilityEvent {
  id: string;
  type: 'available' | 'unavailable' | 'appointment';
  start_at: string;
  end_at: string;
  note: string | null;
}

const TYPE_OPTIONS = ['available', 'unavailable', 'appointment'] as const;

const TYPE_STYLES: Record<AvailabilityEvent['type'], string> = {
  available: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  unavailable: 'bg-amber-100 text-amber-800 border-amber-300',
  appointment: 'bg-sky-100 text-sky-800 border-sky-300',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** True if the given date (year, month, day) falls within [event.start_at, event.end_at]. */
function eventCoversDay(ev: AvailabilityEvent, y: number, m: number, day: number): boolean {
  const dayStart = new Date(y, m, day, 0, 0, 0);
  const dayEnd = new Date(y, m, day, 23, 59, 59);
  const start = new Date(ev.start_at);
  const end = new Date(ev.end_at);
  return start <= dayEnd && end >= dayStart;
}

/** Events that touch the given day, for display in the cell. */
function eventsForDay(events: AvailabilityEvent[], y: number, m: number, day: number): AvailabilityEvent[] {
  return events.filter((ev) => eventCoversDay(ev, y, m, day));
}

/** Find an unavailable event that fully covers this slot (exact or contains). */
function findUnavailableEventForSlot(
  events: AvailabilityEvent[],
  slotStart: Date,
  slotEnd: Date
): AvailabilityEvent | undefined {
  const startMs = slotStart.getTime();
  const endMs = slotEnd.getTime();
  return events.find(
    (ev) =>
      ev.type === 'unavailable' &&
      new Date(ev.start_at).getTime() <= startMs &&
      new Date(ev.end_at).getTime() >= endMs
  );
}

function formatSlotLabel(slotStart: Date, slotEnd: Date): string {
  return `${slotStart.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })} – ${slotEnd.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

export interface CalendarTask {
  id: string;
  task_type: string;
  other_label?: string | null;
  meeting_with?: string | null;
  start_at: string;
  end_at: string;
  note?: string | null;
  pro_crm_customers?: { first_name?: string; last_name?: string; display_name?: string | null } | null;
}

function taskCoversDay(task: CalendarTask, y: number, m: number, day: number): boolean {
  const dayStart = new Date(y, m, day, 0, 0, 0);
  const dayEnd = new Date(y, m, day, 23, 59, 59);
  const start = new Date(task.start_at);
  const end = new Date(task.end_at);
  return start <= dayEnd && end >= dayStart;
}

function tasksForDay(tasks: CalendarTask[], y: number, m: number, day: number): CalendarTask[] {
  return tasks.filter((t) => taskCoversDay(t, y, m, day));
}

const TASK_TYPE_SHORT: Record<string, string> = {
  estimate_appointment: 'Estimate',
  business_meeting: 'Meeting',
  follow_up: 'Follow up',
  other: 'Task',
};

export default function CRMCalendarPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [events, setEvents] = useState<AvailabilityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formType, setFormType] = useState<'available' | 'unavailable' | 'appointment'>('available');
  const [formStartDate, setFormStartDate] = useState('');
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndDate, setFormEndDate] = useState('');
  const [formEndTime, setFormEndTime] = useState('17:00');
  const [formNote, setFormNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** Day slots modal: when set, show modal with all standard slots for that day and OFF toggles */
  const [daySlotsModal, setDaySlotsModal] = useState<{ year: number; month: number; day: number } | null>(null);
  const [slotToggling, setSlotToggling] = useState<string | null>(null);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  /** ProCard calendar: business id, slug, and show-on-ProCard toggle */
  const [calendarBusiness, setCalendarBusiness] = useState<{ id: string; slug: string; showCalendarOnProCard: boolean } | null>(null);
  const [calendarSettingSaving, setCalendarSettingSaving] = useState(false);
  const [calendarLinkCopied, setCalendarLinkCopied] = useState(false);
  const locale = useLocale();
  const t = useTranslations('probot');

  const fetchCalendarBusiness = useCallback(async () => {
    try {
      const res = await fetch('/api/me/businesses/list', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.businesses) || data.businesses.length === 0) {
        setCalendarBusiness(null);
        return;
      }
      const first = data.businesses[0] as { id: string; slug?: string; showCalendarOnProCard?: boolean };
      const slug = (first.slug ?? first.id).toString();
      setCalendarBusiness({
        id: first.id,
        slug,
        showCalendarOnProCard: first.showCalendarOnProCard ?? false,
      });
    } catch {
      setCalendarBusiness(null);
    }
  }, []);

  useEffect(() => { fetchCalendarBusiness(); }, [fetchCalendarBusiness]);

  const handleShowOnProCardToggle = async (checked: boolean) => {
    if (!calendarBusiness) return;
    setCalendarSettingSaving(true);
    setError(null);
    try {
      const csrfRes = await fetch('/api/csrf-token', { method: 'GET', credentials: 'include' });
      if (!csrfRes.ok) throw new Error('Failed to get CSRF token');
      const { csrfToken } = await csrfRes.json();
      const res = await fetch(`/api/businesses/${calendarBusiness.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ showCalendarOnProCard: checked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setCalendarBusiness((prev) => (prev ? { ...prev, showCalendarOnProCard: checked } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update setting');
    } finally {
      setCalendarSettingSaving(false);
    }
  };

  const getCalendarShareUrl = () => {
    if (typeof window === 'undefined' || !calendarBusiness?.slug) return '';
    return `${window.location.origin}/${locale}/book/${calendarBusiness.slug}`;
  };

  const handleCopyCalendarLink = async () => {
    const url = getCalendarShareUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCalendarLinkCopied(true);
      setTimeout(() => setCalendarLinkCopied(false), 2000);
    } catch {
      setError('Could not copy link');
    }
  };

  const fetchEvents = useCallback(async () => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/crm/availability?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setEvents(data.availability ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  const fetchTasks = useCallback(async () => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    try {
      const res = await fetch(
        `/api/crm/tasks?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`,
        { credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) setTasks(data.tasks ?? []);
      else setTasks([]);
    } catch {
      setTasks([]);
    }
  }, [year, month]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    const d = new Date();
    setFormStartDate(d.toISOString().slice(0, 10));
    setFormEndDate(d.toISOString().slice(0, 10));
  }, [showAddForm]);

  const openAddForDay = (y: number, m: number, day: number) => {
    const d = new Date(y, m, day);
    const dateStr = d.toISOString().slice(0, 10);
    setFormStartDate(dateStr);
    setFormEndDate(dateStr);
    setShowAddForm(true);
  };

  const openDaySlotsModal = (y: number, m: number, day: number) => {
    setDaySlotsModal({ year: y, month: m, day });
  };

  const handleSlotOffToggle = async (slotStart: Date, slotEnd: Date, currentlyOff: boolean) => {
    const key = `${slotStart.toISOString()}`;
    setSlotToggling(key);
    try {
      if (currentlyOff) {
        const ev = findUnavailableEventForSlot(events, slotStart, slotEnd);
        if (ev) {
          const res = await fetch(`/api/crm/availability/${ev.id}`, { method: 'DELETE', credentials: 'include' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Failed to turn slot on');
          fetchEvents();
        }
      } else {
        const res = await fetch('/api/crm/availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type: 'unavailable',
            startAt: slotStart.toISOString(),
            endAt: slotEnd.toISOString(),
            note: null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to turn slot off');
        fetchEvents();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSlotToggling(null);
    }
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const startAt = `${formStartDate}T${formStartTime}:00`;
    const endAt = `${formEndDate}T${formEndTime}:00`;
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      setFormError('End must be after start.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: formType,
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          note: formNote.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add');
      setShowAddForm(false);
      setFormNote('');
      fetchEvents();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/availability/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setDeleteConfirm(null);
      fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const monthLabel = new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  return (
    <div className="w-full pb-20 md:pb-0">
      <div className="flex flex-row items-center justify-between gap-4 pt-2 pb-4 md:pt-0 md:pb-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mark when you&apos;re available or off. ProBot can use this for scheduling.</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="hidden md:flex items-center gap-2 shrink-0"
          onClick={() => setShowAddTaskModal(true)}
        >
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      {/* Show on ProCard toggle + share calendar link */}
      {calendarBusiness && (
        <div className="mb-4 p-4 border-2 border-black rounded-lg bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={calendarBusiness.showCalendarOnProCard}
                disabled={calendarSettingSaving}
                onChange={(e) => handleShowOnProCardToggle(e.target.checked)}
                className="w-4 h-4 rounded border-2 border-black text-black focus:ring-black"
                aria-label={t('showOnProCard')}
              />
              <span className="font-medium text-gray-900">{t('showOnProCard')}</span>
            </label>
            {calendarBusiness.showCalendarOnProCard && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{t('calendarShareLink')}:</span>
                <button
                  type="button"
                  onClick={handleCopyCalendarLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-black bg-white text-sm font-medium hover:bg-gray-100 cursor-pointer"
                  aria-label={t('calendarLinkCopy')}
                >
                  {calendarLinkCopied ? (
                    <span className="text-green-700">{t('calendarLinkCopied')}</span>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {t('calendarLinkCopy')}
                    </>
                  )}
                </button>
                <a
                  href={getCalendarShareUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg border-2 border-black bg-white text-black hover:bg-gray-100"
                  aria-label="Open calendar link"
                >
                  <Link2 className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
          {calendarBusiness.showCalendarOnProCard && (
            <p className="mt-2 text-xs text-gray-500">
              Customers see a calendar icon on your ProCard and can book an appointment at {getCalendarShareUrl()}
            </p>
          )}
        </div>
      )}

      {/* Mobile: Add Task FAB */}
      <button
        type="button"
        onClick={() => setShowAddTaskModal(true)}
        className="md:hidden fixed bottom-6 right-6 z-30 flex items-center justify-center w-14 h-14 rounded-full bg-black text-white border-2 border-black shadow-lg hover:bg-gray-800 cursor-pointer"
        aria-label="Add Task"
      >
        <Plus className="w-6 h-6" />
      </button>

      {error && <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {/* Custom month calendar */}
      <div className="border-2 border-black rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="flex items-center justify-between p-2 md:px-4 md:py-3 border-b-2 border-black bg-gray-50">
          <button
            type="button"
            onClick={prevMonth}
            className="p-2 rounded-lg border-2 border-black hover:bg-gray-100 cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-gray-900">{monthLabel}</h2>
          <button
            type="button"
            onClick={nextMonth}
            className="p-2 rounded-lg border-2 border-black hover:bg-gray-100 cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b-2 border-black bg-gray-100">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="font-semibold text-gray-700 py-2 text-center text-sm border-r border-gray-300 last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 auto-rows-fr min-h-[480px] [&>div:nth-child(7n)]:border-r-0">
          {blanks.map((_, i) => (
            <div key={`blank-${i}`} className="min-h-[100px] bg-gray-50 border-b border-r border-gray-200" />
          ))}
          {days.map((d) => {
            const dayEvents = eventsForDay(events, year, month, d);
            const dayTasks = tasksForDay(tasks, year, month, d);
            const isToday = isCurrentMonth && d === today.getDate();
            return (
              <div
                key={d}
                role="button"
                tabIndex={0}
                onClick={() => openDaySlotsModal(year, month, d)}
                onKeyDown={(e) => e.key === 'Enter' && openDaySlotsModal(year, month, d)}
                className={`min-h-[100px] flex flex-col border-b border-r border-gray-200 bg-white hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-black ${isToday ? 'ring-2 ring-black ring-inset bg-amber-50/50' : ''}`}
              >
                <div className={`shrink-0 px-2 py-1 text-sm font-medium ${isToday ? 'text-black' : 'text-gray-700'}`}>
                  {d}
                </div>
                <div className="flex-1 overflow-hidden px-1 pb-1 flex flex-col gap-0.5">
                  {isLoading ? (
                    <div className="text-xs text-gray-400">…</div>
                  ) : (
                    <>
                      {dayTasks.slice(0, 2).map((task) => (
                        <span
                          key={task.id}
                          className="text-left text-xs truncate px-1.5 py-0.5 rounded border bg-sky-100 text-sky-800 border-sky-300"
                          title={`${TASK_TYPE_SHORT[task.task_type] ?? task.task_type}: ${formatTime(task.start_at)}${task.meeting_with ? ` — ${task.meeting_with}` : ''}${task.pro_crm_customers ? ` — ${[task.pro_crm_customers.first_name, task.pro_crm_customers.last_name].filter(Boolean).join(' ')}` : ''}`}
                        >
                          {TASK_TYPE_SHORT[task.task_type] ?? task.task_type} {formatTime(task.start_at)}
                        </span>
                      ))}
                      {dayEvents.slice(0, 3 - dayTasks.length).map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm({ id: ev.id });
                          }}
                          className={`text-left text-xs truncate px-1.5 py-0.5 rounded border ${TYPE_STYLES[ev.type]} hover:opacity-90 cursor-pointer`}
                          title={`${ev.type}: ${formatTime(ev.start_at)} – ${formatTime(ev.end_at)}${ev.note ? ` — ${ev.note}` : ''}`}
                        >
                          {formatTime(ev.start_at)}
                        </button>
                      ))}
                      {(dayEvents.length + dayTasks.length > 3) && (
                        <span className="text-xs text-gray-500 px-1">+{dayEvents.length + dayTasks.length - 3}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add block modal */}
      {showAddForm && (
        <Modal isOpen onClose={() => !saving && setShowAddForm(false)} title="Add block" showHeader showCloseButton maxWidth="sm" preventCloseOnOverlayClick={saving}>
          <form onSubmit={handleSubmitAdd} className="space-y-4">
            {formError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{formError}</div>}
            <FormField label="Type">
              <Select value={formType} onChange={(e) => setFormType(e.target.value as typeof formType)}>
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Start date">
                <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} required />
              </FormField>
              <FormField label="Start time">
                <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} required />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="End date">
                <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} required />
              </FormField>
              <FormField label="End time">
                <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} required />
              </FormField>
            </div>
            <FormField label="Note">
              <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Optional" />
            </FormField>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddForm(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={saving}>{saving ? 'Adding…' : 'Add block'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal isOpen onClose={() => !deleting && setDeleteConfirm(null)} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
          <div className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8 text-amber-600" /></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Delete this block?</h2>
            <p className="text-gray-600 mb-6">This cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete(deleteConfirm.id)} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Day slots modal: all standard slots for the day, OFF = unavailable */}
      {daySlotsModal && (() => {
        const dayStart = new Date(daySlotsModal.year, daySlotsModal.month, daySlotsModal.day);
        const slots = getStandardSlotsForDay(dayStart);
        const modalTitle = dayStart.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        return (
          <Modal
            isOpen
            onClose={() => setDaySlotsModal(null)}
            title={modalTitle}
            showHeader
            showCloseButton
            maxWidth="md"
          >
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600 mb-4">All slots are available by default. Check OFF for slots when you&apos;re not free.</p>
              <div className="border-2 border-black rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-black">
                    <th className="py-2.5 px-3 font-semibold text-gray-900">Time slot</th>
                    <th className="py-2.5 px-3 font-semibold text-gray-900 text-right w-24">OFF</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map(({ start, end }) => {
                    const ev = findUnavailableEventForSlot(events, start, end);
                    const isOff = !!ev;
                    const key = start.toISOString();
                    const toggling = slotToggling === key;
                    return (
                      <tr key={key} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-2.5 px-3 text-gray-900">{formatSlotLabel(start, end)}</td>
                        <td className="py-2.5 px-3 text-right">
                          <label className="inline-flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isOff}
                              disabled={toggling}
                              onChange={() => handleSlotOffToggle(start, end, isOff)}
                              className="w-4 h-4 rounded border-2 border-black text-amber-600 focus:ring-black"
                              aria-label={isOff ? `Mark ${formatSlotLabel(start, end)} as available` : `Mark ${formatSlotLabel(start, end)} as OFF`}
                            />
                            <span className="text-sm text-gray-600">{isOff ? 'OFF' : '—'}</span>
                          </label>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <div className="mt-5 flex justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={() => setDaySlotsModal(null)}>
                  Done
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onSuccess={() => { fetchEvents(); fetchTasks(); }}
      />
    </div>
  );
}
