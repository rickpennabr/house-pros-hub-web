'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Repeat, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DAY_KEYS, formatHm, weekdayLabel } from '@/lib/booking/businessHours';
import type { RecurringBlock } from '@/lib/booking/recurringBlocks';

const EVERY_OPTIONS = [1, 2, 3, 4] as const;

/**
 * Repeating busy times under the weekly hours: e.g. every Monday and Tuesday 2:30–4:30 PM,
 * or every other Friday. Booking slots that overlap one are not offered to customers.
 */
export function RecurringBusyTimes({
  blocks,
  onChanged,
  loaded = true,
}: {
  loaded?: boolean;
  blocks: RecurringBlock[];
  /** Called after an add or remove so the calendar reloads. */
  onChanged: () => void;
}) {
  const t = useTranslations('proCalendar');
  const locale = useLocale();
  const [adding, setAdding] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState('14:30');
  const [end, setEnd] = useState('16:30');
  const [every, setEvery] = useState(1);
  const [startsOn, setStartsOn] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number) =>
    setDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort()));

  const everyLabel = (n: number) => (n === 1 ? t('repeatWeekly') : n === 2 ? t('repeatBiweekly') : t('repeatEveryN', { n }));

  const save = async () => {
    if (days.length === 0) {
      setError(t('repeatPickDay'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/recurring-blocks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekdays: days, startTime: start, endTime: end, everyWeeks: every, startsOn, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('saveFailed'));
      setAdding(false);
      setDays([]);
      setNote('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/crm/recurring-blocks/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t('saveFailed'));
      return;
    }
    onChanged();
  };

  return (
    <div className="space-y-2 border-t-2 border-gray-200 pt-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <Repeat className="h-4 w-4 text-red-500" />
        {t('repeatTitle')}
      </p>
      <p className="text-sm text-gray-600">{t('repeatHelp')}</p>

      {!loaded ? (
        <div className="h-10 animate-pulse rounded-lg bg-gray-100" aria-busy="true" />
      ) : blocks.length === 0 ? (
        <p className="text-sm text-gray-500">{t('repeatEmpty')}</p>
      ) : (
        <ul className="space-y-2">
          {blocks.map((block) => (
            <li key={block.id} className="flex items-center justify-between gap-3 rounded-lg border-2 border-black px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {block.weekdays.map((day) => weekdayLabel(DAY_KEYS[day], locale)).join(', ')} · {formatHm(block.start_time, locale)}–
                  {formatHm(block.end_time, locale)}
                </p>
                <p className="text-xs text-gray-600">
                  {everyLabel(block.every_weeks)} · {t('repeatStartsOn')} {block.starts_on}
                  {block.note ? ` · ${block.note}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(block.id)}
                className="flex h-9 shrink-0 items-center gap-1 rounded-lg border-2 border-black px-2 text-xs font-medium hover:bg-gray-50 cursor-pointer"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
                {t('repeatRemove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className="space-y-3 rounded-lg border-2 border-black p-3">
          <div>
            <p className="mb-1 text-sm font-medium">{t('repeatDays')}</p>
            <div className="flex flex-wrap gap-2">
              {DAY_KEYS.map((key, index) => {
                const on = days.includes(index);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(index)}
                    className={`h-9 rounded-lg border-2 border-black px-3 text-sm font-medium cursor-pointer ${on ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'}`}
                  >
                    {weekdayLabel(key, locale).slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label={t('repeatFrom')}>
              <Input type="time" value={start} onChange={(event) => setStart(event.target.value)} />
            </FormField>
            <FormField label={t('repeatTo')}>
              <Input type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
            </FormField>
            <FormField label={t('repeatEvery')}>
              <Select value={String(every)} onChange={(event) => setEvery(Number(event.target.value))}>
                {EVERY_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {everyLabel(n)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label={t('repeatStartsOn')}>
              <Input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
            </FormField>
          </div>
          <FormField label={t('repeatNote')}>
            <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? t('saving') : t('repeatSave')}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(false)}>
              {t('repeatCancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={() => setAdding(true)} className="inline-flex items-center gap-1">
          <Plus className="h-4 w-4" />
          {t('repeatAdd')}
        </Button>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

async function fetchRecurringBlocks(): Promise<RecurringBlock[]> {
  const res = await fetch('/api/crm/recurring-blocks', { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  return res.ok && Array.isArray(data.blocks) ? data.blocks : [];
}

/** Loads the pro's repeating busy times. */
export function useRecurringBlocks() {
  const [blocks, setBlocks] = useState<RecurringBlock[]>([]);
  /** False until the first load, so the list does not say "none" before it knows. */
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    setBlocks(await fetchRecurringBlocks());
  }, []);
  useEffect(() => {
    let cancelled = false;
    void fetchRecurringBlocks().then((rows) => {
      if (!cancelled) {
        setBlocks(rows);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { blocks, reload, loaded };
}
