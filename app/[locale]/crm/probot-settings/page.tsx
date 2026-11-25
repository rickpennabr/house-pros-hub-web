'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ArrowLeft, Check, Loader2, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { DEFAULT_PROBOT_SETTINGS, PRO_TIME_ZONES, type ProbotSettings } from '@/lib/probot/settings-shared';

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint ? <span className="block text-xs text-gray-600">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-black' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

const hourLabel = (hour: number) => `${hour}:30 AM`;

/** ProBot morning brief settings: on/off, time, time zone, and how long each card waits. */
export default function ProbotSettingsPage() {
  const locale = useLocale();
  const [settings, setSettings] = useState<ProbotSettings>(DEFAULT_PROBOT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState(false);
  const [briefNote, setBriefNote] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/crm/probot/settings', { credentials: 'include' })
      .then((res) => res.json())
      .then((body: { settings?: ProbotSettings }) => {
        if (body.settings) setSettings(body.settings);
      })
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof ProbotSettings>(key: K, value: ProbotSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/probot/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || 'Could not save');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const briefNow = async () => {
    setBriefing(true);
    setBriefNote(null);
    try {
      const res = await fetch('/api/crm/probot/morning', { method: 'POST', credentials: 'include' });
      const body = (await res.json().catch(() => ({}))) as { sent?: boolean; cards?: number; reason?: string; error?: string };
      if (!res.ok) throw new Error(body.error || 'Could not build the brief');
      setBriefNote(body.sent ? `Sent to your ProBot chat with ${body.cards ?? 0} cards.` : 'Nothing to report today, so ProBot stayed quiet.');
    } catch (err) {
      setBriefNote(err instanceof Error ? err.message : 'Could not build the brief');
    } finally {
      setBriefing(false);
    }
  };

  const days = (max: number) => Array.from({ length: max }, (_, index) => index + 1);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <Link href={`/${locale}/probot`} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-black">
        <ArrowLeft className="h-4 w-4" />
        ProBot
      </Link>
      <div className="flex items-center gap-2">
        <Sun className="h-6 w-6 text-red-600" />
        <h1 className="text-xl font-bold">Morning brief</h1>
      </div>
      <p className="text-sm text-gray-600">
        Every morning ProBot sends your day and the things that need you: unpaid invoices, estimates with no answer,
        jobs starting and finishing. Nothing goes to a customer until you tap Send.
      </p>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </p>
      ) : (
        <>
          <section className="space-y-3 rounded-lg border-2 border-black bg-white p-4">
            <Toggle checked={settings.briefEnabled} onChange={(value) => set('briefEnabled', value)} label="Send me the morning brief" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Time">
                <Select value={settings.briefHour} onChange={(e) => set('briefHour', Number(e.target.value))} disabled={!settings.briefEnabled}>
                  {[4, 5, 6, 7, 8, 9, 10, 11].map((hour) => (
                    <option key={hour} value={hour}>{hourLabel(hour)}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Time zone">
                <Select value={settings.timeZone} onChange={(e) => set('timeZone', e.target.value)} disabled={!settings.briefEnabled}>
                  {PRO_TIME_ZONES.some((zone) => zone.value === settings.timeZone) ? null : (
                    <option value={settings.timeZone}>{settings.timeZone}</option>
                  )}
                  {PRO_TIME_ZONES.map((zone) => (
                    <option key={zone.value} value={zone.value}>{zone.label}</option>
                  ))}
                </Select>
              </FormField>
            </div>
            <Toggle checked={settings.pushEnabled} onChange={(value) => set('pushEnabled', value)} label="Phone notification" hint="A push when the brief is ready." />
          </section>

          <section className="space-y-3 rounded-lg border-2 border-black bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">Follow-up cards</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField label="Unpaid invoice after">
                <Select value={settings.invoiceDays} onChange={(e) => set('invoiceDays', Number(e.target.value))}>
                  {days(30).map((day) => <option key={day} value={day}>{day} {day === 1 ? 'day' : 'days'}</option>)}
                </Select>
              </FormField>
              <FormField label="Estimate with no answer after">
                <Select value={settings.estimateDays} onChange={(e) => set('estimateDays', Number(e.target.value))}>
                  {days(30).map((day) => <option key={day} value={day}>{day} {day === 1 ? 'day' : 'days'}</option>)}
                </Select>
              </FormField>
              <FormField label="Job starting in">
                <Select value={settings.projectStartDays} onChange={(e) => set('projectStartDays', Number(e.target.value))} disabled={!settings.projectCards}>
                  {days(14).map((day) => <option key={day} value={day}>{day} {day === 1 ? 'day' : 'days'}</option>)}
                </Select>
              </FormField>
            </div>
            <Toggle
              checked={settings.projectCards}
              onChange={(value) => set('projectCards', value)}
              label="Project cards"
              hint="Accepted estimates with no project, jobs finishing (final invoice) and jobs starting."
            />
            <p className="text-xs text-gray-500">After you send a reminder or follow-up, the next card for it waits 7 days. At most 5 cards a morning.</p>
          </section>

          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={() => void briefNow()} disabled={briefing}>
              {briefing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sun className="mr-1 h-4 w-4" />}
              Send me a brief now
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : saved ? <Check className="mr-1 h-4 w-4" /> : null}
              {saved ? 'Saved' : 'Save'}
            </Button>
          </div>
          {briefNote ? <p className="text-sm text-gray-700">{briefNote}</p> : null}
        </>
      )}
    </div>
  );
}
