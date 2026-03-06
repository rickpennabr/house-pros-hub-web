'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';

interface AvailabilityEvent {
  id: string;
  type: 'available' | 'unavailable' | 'appointment';
  start_at: string;
  end_at: string;
  note: string | null;
}

const TYPE_OPTIONS = ['available', 'unavailable', 'appointment'] as const;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

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

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    const d = new Date();
    setFormStartDate(d.toISOString().slice(0, 10));
    setFormEndDate(d.toISOString().slice(0, 10));
  }, [showAddForm]);

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

  return (
    <div className="w-full">
      <div className="flex flex-row items-center justify-between gap-4 pt-2 pb-4 md:pt-0 md:pb-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mark when you&apos;re available or off. ProBot can use this for scheduling.</p>
        </div>
        <Button variant="primary" size="sm" className="flex items-center gap-2 shrink-0" onClick={() => setShowAddForm(true)}>
          <Plus className="w-4 h-4" />
          Add block
        </Button>
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      {/* Month navigation + grid */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={prevMonth} className="p-2 rounded-lg border-2 border-black hover:bg-gray-50 cursor-pointer" aria-label="Previous month">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-gray-900">{monthLabel}</h2>
          <button type="button" onClick={nextMonth} className="p-2 rounded-lg border-2 border-black hover:bg-gray-50 cursor-pointer" aria-label="Next month">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="font-semibold text-gray-600 py-1">
              {d}
            </div>
          ))}
          {blanks.map((_, i) => (
            <div key={`b-${i}`} className="p-2 min-h-[40px] bg-gray-50 rounded" />
          ))}
          {days.map((d) => {
            const hasEvent = events.some((e) => {
              const start = new Date(e.start_at);
              const end = new Date(e.end_at);
              const day = new Date(year, month, d);
              return start <= day && end >= day;
            });
            const isToday =
              d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            return (
              <div
                key={d}
                className={`p-2 min-h-[40px] rounded border ${isToday ? 'border-black bg-gray-100 font-semibold' : 'border-transparent'} ${hasEvent ? 'bg-green-50' : ''}`}
              >
                {d}
              </div>
            );
          })}
        </div>
      </div>

      {/* List of events for the month */}
      <div className="mt-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Blocks this month</h3>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-gray-500">No blocks. Click &quot;Add block&quot; to mark available or unavailable times.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex items-center justify-between gap-2 p-3 rounded-lg border-2 border-gray-200 bg-white"
              >
                <div className="min-w-0">
                  <span className={`font-medium ${ev.type === 'available' ? 'text-green-700' : ev.type === 'unavailable' ? 'text-amber-700' : 'text-blue-700'}`}>
                    {ev.type}
                  </span>
                  <span className="text-gray-600 text-sm ml-2">
                    {formatDate(ev.start_at)} {formatTime(ev.start_at)} – {formatTime(ev.end_at)}
                  </span>
                  {ev.note && <p className="text-sm text-gray-500 mt-0.5 truncate">{ev.note}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm({ id: ev.id })}
                  className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
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
    </div>
  );
}
