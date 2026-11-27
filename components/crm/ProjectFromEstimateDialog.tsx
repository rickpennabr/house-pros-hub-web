'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { projectDurationText } from '@/lib/crm/project-duration';
import { PickerSelect } from '@/components/ui/PickerSelect';

interface Manager {
  id: string;
  name: string;
}

interface ProjectFromEstimateDialogProps {
  /** Estimate to turn into a project; null keeps the dialog closed. */
  estimateId: string | null;
  /** Customer name, for the suggested project name. */
  customerName?: string | null;
  onClose: () => void;
  onCreated: (projectId: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold', label: 'On hold' },
];

/**
 * Turning an approved estimate into a project: name, dates, status, project manager and notes
 * up front, so the project is ready to schedule instead of "Project from estimate" with no dates.
 */
export function ProjectFromEstimateDialog({ estimateId, customerName, onClose, onCreated }: ProjectFromEstimateDialogProps) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('planned');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [managerId, setManagerId] = useState('');
  const [note, setNote] = useState('');
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Fill the form from the estimate each time the dialog opens for one.
  if (estimateId && loadedFor !== estimateId) {
    setLoadedFor(estimateId);
    setName(customerName?.trim() || '');
    setStatus('planned');
    setStartDate('');
    setEndDate('');
    setManagerId('');
    setNote('');
    setError(null);
    setSaving(false);
    setLoading(true);
  }
  if (!estimateId && loadedFor !== null) setLoadedFor(null);

  useEffect(() => {
    if (!estimateId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/crm/estimates/${estimateId}`, { credentials: 'include' }).then((res) => res.json()).catch(() => ({})),
      fetch('/api/crm/customers?role=project_manager&pageSize=200', { credentials: 'include' })
        .then((res) => res.json())
        .catch(() => ({})),
    ])
      .then(([estimate, people]) => {
        if (cancelled) return;
        const area = typeof estimate?.jobArea === 'string' ? estimate.jobArea.trim() : '';
        if (area) setName((current) => (current ? `${current} - ${area}` : area));
        if (typeof estimate?.note === 'string') setNote(estimate.note);
        const list = Array.isArray(people?.customers) ? people.customers : [];
        setManagers(
          list.map((row: { id: string; first_name?: string | null; last_name?: string | null; display_name?: string | null; company_name?: string | null }) => ({
            id: row.id,
            name: contactDisplayName(row),
          }))
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [estimateId]);

  const create = async () => {
    if (!estimateId) return;
    if (startDate && endDate && endDate < startDate) {
      setError('The end date is before the start date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/projects/convert-from-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          estimateId,
          name: name.trim(),
          status,
          startDate: startDate || null,
          endDate: endDate || null,
          note,
          projectManagerId: managerId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not create the project');
      onCreated(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the project');
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={Boolean(estimateId)} onClose={() => !saving && onClose()} showHeader={false} showCloseButton maxWidth="md" preventCloseOnOverlayClick={saving}>
      <div className="space-y-4 p-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Create project from estimate</h2>
          <p className="mt-1 text-sm text-gray-600">
            The project keeps the estimate&apos;s customer, property and price. Set it up now so it is ready to schedule.
          </p>
        </div>
        {loading ? <p className="text-sm text-gray-500">Loading the estimate…</p> : null}

        <label className="block text-sm font-medium text-gray-900">
          Project name
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Backyard pavers" className="mt-1" />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-900">
            Start date
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1" />
          </label>
          <label className="block text-sm font-medium text-gray-900">
            End date
            <Input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} className="mt-1" />
          </label>
        </div>

        {projectDurationText(startDate, endDate) ? (
          <p className="-mt-2 text-sm text-gray-700">Duration: <strong>{projectDurationText(startDate, endDate)}</strong></p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-900">
            Status
            <Select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm font-medium text-gray-900">
            Project manager
            <PickerSelect
              value={managerId}
              onChange={setManagerId}
              className="mt-1"
              noneLabel={managers.length ? 'None yet' : 'No project managers yet'}
              options={managers.map((manager) => ({ value: manager.id, label: manager.name }))}
            />
          </label>
        </div>
        {managers.length === 0 && !loading ? (
          <p className="-mt-2 text-xs text-gray-500">Give a contact the Project manager role to pick them here.</p>
        ) : null}

        <label className="block text-sm font-medium text-gray-900">
          Notes for the crew
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="mt-1 w-full resize-y rounded-lg border-2 border-black px-3 py-2 text-sm focus:outline-none"
            placeholder="Access, materials, anything the crew should know"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void create()} disabled={saving || loading}>
            {saving ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
