'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

interface ProjectOption {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
}

const OPEN_STATUSES = new Set(['planned', 'in_progress', 'on_hold']);

/**
 * Put an employee, subcontractor or project manager on one job's team (pro_crm_project_members),
 * the same team the job photo viewer shows.
 */
export function AddToJobModal({
  contact,
  onClose,
  onAdded,
}: {
  /** Null keeps the window closed. */
  contact: { id: string; name: string; roleId: string; roleName: string } | null;
  onClose: () => void;
  onAdded?: (projectName: string) => void;
}) {
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contact) return;
    let cancelled = false;
    fetch('/api/crm/projects?pageSize=500&sortBy=updated_at&sortDir=desc', { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { projects?: ProjectOption[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        const open = (data.projects ?? []).filter((project) => OPEN_STATUSES.has(project.status));
        setProjects(open);
        setProjectId(open[0]?.id ?? '');
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your jobs');
      });
    return () => {
      cancelled = true;
    };
  }, [contact]);

  const close = () => {
    setProjects(null);
    setProjectId('');
    setError(null);
    onClose();
  };

  async function add() {
    if (!contact || !projectId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/projects/${projectId}/members`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id, roleId: contact.roleId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Could not add them to the job');
      onAdded?.(projects?.find((project) => project.id === projectId)?.name ?? '');
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add them to the job');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={Boolean(contact)} onClose={close} title="Add to a job" maxWidth="md">
      {contact ? (
        <div className="space-y-4 p-4">
          <p className="text-sm text-gray-700">
            <span className="font-medium">{contact.name}</span> joins the job team as{' '}
            <span className="font-medium">{contact.roleName}</span>. They show on the job and its photos.
          </p>
          {projects === null && !error ? <p className="text-sm text-gray-500">Loading jobs…</p> : null}
          {projects && projects.length === 0 ? (
            <p className="text-sm text-gray-600">No open jobs. Create a project first.</p>
          ) : null}
          {projects && projects.length > 0 ? (
            <Select value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Job">
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {project.start_date ? ` · starts ${project.start_date}` : ''}
                  {project.status === 'in_progress' ? ' · in progress' : project.status === 'on_hold' ? ' · on hold' : ''}
                </option>
              ))}
            </Select>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void add()} disabled={saving || !projectId} loading={saving}>
              Add to job
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
