'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { PickerSelect } from '@/components/ui/PickerSelect';

interface Contact {
  id: string;
  name: string;
  rateCents: number | null;
  /** Employee, sub, installer or project manager: listed first. */
  crew: boolean;
}

const CREW_SLUGS = ['employee', 'subcontractor', 'installer', 'project_manager'];

interface TimeEntry {
  id: string;
  work_date: string;
  hours: number | string;
  rate_cents_per_hour: number;
  person_name: string | null;
  note: string | null;
}

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * Log hours worked on a project or maintenance plan. Cost = hours × the person's labor cost
 * (set on the contact), or the default crew cost from the financial settings.
 */
export function LogHoursModal({
  job,
  onClose,
  onChanged,
}: {
  job: { projectId?: string; maintenancePlanId?: string; name: string };
  onClose: () => void;
  onChanged: () => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [entriesLoaded, setEntriesLoaded] = useState(false);
  const [personId, setPersonId] = useState('');
  const [personName, setPersonName] = useState('');
  const [workDate, setWorkDate] = useState(todayKey);
  const [hours, setHours] = useState('8');
  const [rate, setRate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = job.projectId ? `project=${job.projectId}` : `plan=${job.maintenancePlanId}`;

  const loadEntries = () =>
    fetch(`/api/crm/time-entries?${query}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((body: { entries?: TimeEntry[]; setupError?: string }) => {
        setEntries(body.entries ?? []);
        setSetupError(body.setupError ?? null);
        setEntriesLoaded(true);
      })
      .catch(() => setEntriesLoaded(true));

  useEffect(() => {
    void loadEntries();
    fetch('/api/crm/customers?pageSize=500', { credentials: 'include' })
      .then((r) => r.json())
      .then((body: { customers?: Array<Record<string, unknown>> }) => {
        setContacts(
          (body.customers ?? []).map((row) => ({
            id: String(row.id),
            name: String(row.display_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || row.company_name || 'Contact'),
            rateCents: typeof row.labor_cost_cents_per_hour === 'number' ? row.labor_cost_cents_per_hour : null,
            crew:
              Array.isArray(row.roles) &&
              (row.roles as Array<{ slug?: string }>).some((role) => CREW_SLUGS.includes(role.slug ?? '')),
          }))
        );
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const person = useMemo(() => contacts.find((contact) => contact.id === personId) ?? null, [contacts, personId]);

  const save = async () => {
    setError(null);
    const hoursValue = Number(hours);
    if (!(hoursValue > 0 && hoursValue <= 24)) {
      setError('Enter hours between 0 and 24.');
      return;
    }
    if (!personId && !personName.trim()) {
      setError('Pick who worked, or type a name.');
      return;
    }
    const rateValue = rate.trim() === '' ? null : Math.round(Number(rate) * 100);
    if (rateValue != null && !(rateValue >= 0)) {
      setError('Enter a valid cost per hour.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/crm/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: job.projectId ?? null,
          maintenancePlanId: job.maintenancePlanId ?? null,
          contactId: personId || null,
          personName: personId ? null : personName.trim(),
          workDate,
          hours: hoursValue,
          rateCentsPerHour: rateValue,
          note: note.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not log the hours');
      setNote('');
      await loadEntries();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log the hours');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/crm/time-entries/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      setEntries((current) => current.filter((entry) => entry.id !== id));
      onChanged();
    }
  };

  const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours), 0);
  const totalCost = entries.reduce((sum, entry) => sum + Math.round(Number(entry.hours) * entry.rate_cents_per_hour), 0);

  return (
    <Modal isOpen onClose={onClose} title={`Hours on ${job.name}`} maxWidth="lg">
      <div className="space-y-4 p-1">
        {setupError ? (
          <p className="rounded-lg border-2 border-black bg-amber-50 p-3 text-sm">{setupError}</p>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Who worked">
            <PickerSelect
              value={personId}
              onChange={setPersonId}
              noneLabel="Someone else (type the name)"
              searchPlaceholder="Search people"
              options={[...contacts.filter((contact) => contact.crew), ...contacts.filter((contact) => !contact.crew)].map((contact) => ({
                value: contact.id,
                label: contact.name,
                detail: [contact.crew ? 'Crew and subs' : 'Other contact', contact.rateCents != null ? `${money(contact.rateCents)}/h` : '']
                  .filter(Boolean)
                  .join(' · '),
              }))}
            />
          </FormField>
          {personId ? (
            <FormField label="Cost per hour ($)" tip="Leave empty to use the cost saved on the contact, or your default crew cost.">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder={person?.rateCents != null ? (person.rateCents / 100).toFixed(2) : 'Default crew cost'}
              />
            </FormField>
          ) : (
            <FormField label="Name">
              <Input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Crew member" />
            </FormField>
          )}
          {!personId ? (
            <FormField label="Cost per hour ($)" tip="Leave empty to use your default crew cost.">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="Default crew cost"
              />
            </FormField>
          ) : null}
          <FormField label="Date">
            <Input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} />
          </FormField>
          <FormField label="Hours">
            <Input type="number" inputMode="decimal" min="0.25" max="24" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
          </FormField>
          <FormField label="Note" className="sm:col-span-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done (optional)" />
          </FormField>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button size="sm" onClick={() => void save()} disabled={saving || Boolean(setupError)}>
            {saving ? 'Saving…' : 'Log hours'}
          </Button>
        </div>

        <div className="border-t border-gray-200 pt-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">Logged</span>
            <span className="text-gray-600">
              {totalHours} h · {money(totalCost)}
            </span>
          </div>
          {!entriesLoaded ? (
            <div className="h-10 animate-pulse rounded-lg bg-gray-100" aria-busy="true" />
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500">No hours logged yet.</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/15 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{entry.person_name || 'Crew'}</span>
                    <span className="text-gray-600">
                      {' '}
                      · {entry.work_date} · {Number(entry.hours)} h × {money(entry.rate_cents_per_hour)}
                    </span>
                    {entry.note ? <span className="block truncate text-xs text-gray-500">{entry.note}</span> : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-medium">{money(Math.round(Number(entry.hours) * entry.rate_cents_per_hour))}</span>
                    <button
                      type="button"
                      onClick={() => void remove(entry.id)}
                      className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-red-600"
                      aria-label="Delete these hours"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
