'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string | null;
  street_address: string | null;
  city: string | null;
  portal_kind: 'house' | 'business' | 'building' | null;
  portal_user_id: string | null;
}

interface ProjectRow {
  id: string;
  customer_id: string;
  name: string;
  status: string;
  shared: boolean;
}

interface PhaseRow {
  id: string;
  project_id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

interface PlanRow {
  id: string;
  customer_id: string;
  name: string;
  frequency: string;
  next_visit_date: string | null;
  is_active: boolean;
}

interface DocRow {
  id: string;
  customer_id: string;
  title: string;
  kind: string;
  file_name: string;
}

export default function CustomerPortalPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/crm/portal', { credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load the portal');
    setCustomers(data.customers ?? []);
    setProjects(data.projects ?? []);
    setPhases(data.phases ?? []);
    setPlans(data.plans ?? []);
    setDocuments(data.documents ?? []);
    setCustomerId((current) => current || data.customers?.[0]?.id || '');
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load the portal'));
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/portal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const customer = customers.find((row) => row.id === customerId) ?? null;
  const customerProjects = projects.filter((row) => row.customer_id === customerId);
  const customerPlans = plans.filter((row) => row.customer_id === customerId);
  const customerDocs = documents.filter((row) => row.customer_id === customerId);

  const addPhase = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void post({
      action: 'phase',
      projectId: form.get('projectId'),
      name: form.get('name'),
      status: form.get('status'),
      startDate: form.get('startDate'),
      endDate: form.get('endDate'),
      note: form.get('note'),
    });
    event.currentTarget.reset();
  };

  const addPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void post({
      action: 'plan',
      customerId,
      name: form.get('name'),
      frequency: form.get('frequency'),
      summary: form.get('summary'),
      nextVisit: form.get('nextVisit'),
      amount: form.get('amount'),
    });
    event.currentTarget.reset();
  };

  const addDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set('customerId', customerId);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/portal/documents', { method: 'POST', credentials: 'include', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not upload');
      event.currentTarget.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Customer portal</h1>
        <p className="text-sm text-gray-700 mt-1">
          Publish the plan, the repeating service, and the PDFs a customer sees on My places. They see it when they sign in with the email on this customer.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <FormField label="Customer">
        <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
          {customers.length === 0 ? <option value="">No customers yet</option> : null}
          {customers.map((row) => (
            <option key={row.id} value={row.id}>
              {row.first_name} {row.last_name}
              {row.company_name ? ` · ${row.company_name}` : ''}
            </option>
          ))}
        </Select>
      </FormField>

      {customer ? (
        <div className="border-2 border-black rounded-lg p-4 space-y-3 text-sm">
          <p>
            {customer.email ? customer.email : 'Add an email on the customer so their login can claim this place.'}
            {customer.portal_user_id ? ' · Linked to their account.' : ' · Waiting for them to sign in with that email.'}
          </p>
          <FormField label="Place">
            <Select
              value={customer.portal_kind ?? 'house'}
              onChange={(event) => void post({ action: 'kind', customerId, kind: event.target.value })}
            >
              <option value="house">House</option>
              <option value="business">Business</option>
              <option value="building">Building</option>
            </Select>
          </FormField>
          <p className="text-xs text-gray-600">
            {[customer.street_address, customer.city].filter(Boolean).join(', ') || 'No street on the customer yet.'}
          </p>
        </div>
      ) : null}

      {customer ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Projects on their place</h2>
          {customerProjects.length === 0 ? <p className="text-sm text-gray-600">Create the project in Projects first.</p> : null}
          {customerProjects.map((project) => (
            <div key={project.id} className="border border-black rounded-lg p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={project.shared}
                  onChange={(event) => void post({ action: 'share', projectId: project.id, shared: event.target.checked })}
                />
                <span className="font-medium">{project.name}</span>
                <span className="text-xs text-gray-600">{project.status}</span>
              </label>
              <ul className="text-sm space-y-1">
                {phases
                  .filter((phase) => phase.project_id === project.id)
                  .map((phase) => (
                    <li key={phase.id} className="flex items-center justify-between gap-2">
                      <span>
                        {phase.name} · {phase.status}
                        {phase.start_date ? ` · ${phase.start_date}` : ''}
                      </span>
                      <button type="button" className="text-red-600 text-xs" onClick={() => void post({ action: 'deletePhase', id: phase.id })}>
                        Remove
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          ))}

          {customerProjects.length > 0 ? (
            <form onSubmit={addPhase} className="grid gap-2">
              <h3 className="text-sm font-medium">Add a step to the plan</h3>
              <Select name="projectId" defaultValue={customerProjects[0]?.id}>
                {customerProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
              <Input name="name" placeholder="Phase name" required />
              <Select name="status" defaultValue="planned">
                <option value="planned">Planned</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input name="startDate" type="date" />
                <Input name="endDate" type="date" />
              </div>
              <Input name="note" placeholder="Note the customer can read" />
              <Button type="submit" disabled={busy} size="sm">
                Add phase
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}

      {customer ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Maintenance</h2>
          {customerPlans.map((plan) => (
            <div key={plan.id} className="flex items-center justify-between gap-2 text-sm border border-black rounded-lg px-3 py-2">
              <span>
                {plan.name} · {plan.frequency}
                {plan.next_visit_date ? ` · next ${plan.next_visit_date}` : ''}
              </span>
              <button type="button" className="text-red-600 text-xs" onClick={() => void post({ action: 'deletePlan', id: plan.id })}>
                Remove
              </button>
            </div>
          ))}
          <form onSubmit={addPlan} className="grid gap-2">
            <Input name="name" placeholder="Pool service, lawn, filter change" required />
            <Select name="frequency" defaultValue="monthly">
              <option value="weekly">Every week</option>
              <option value="biweekly">Every two weeks</option>
              <option value="monthly">Every month</option>
              <option value="quarterly">Every quarter</option>
              <option value="yearly">Every year</option>
            </Select>
            <Input name="summary" placeholder="What is included" />
            <Input name="nextVisit" type="date" />
            <Input name="amount" type="number" min="0" step="0.01" placeholder="Amount each visit (optional)" />
            <Button type="submit" disabled={busy} size="sm">
              Add maintenance
            </Button>
          </form>
        </section>
      ) : null}

      {customer ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Contract and PDFs</h2>
          {customerDocs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-2 text-sm border border-black rounded-lg px-3 py-2">
              <a href={`/api/places/documents/${doc.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {doc.title} · {doc.kind}
              </a>
              <button type="button" className="text-red-600 text-xs" onClick={() => void post({ action: 'deleteDocument', id: doc.id })}>
                Remove
              </button>
            </div>
          ))}
          <form onSubmit={addDocument} className="grid gap-2">
            <Input name="title" placeholder="Title" required />
            <Select name="kind" defaultValue="contract">
              <option value="contract">Contract</option>
              <option value="project_pdf">Project PDF</option>
              <option value="agreement">Maintenance agreement</option>
              <option value="other">Other</option>
            </Select>
            {customerProjects.length > 0 ? (
              <Select name="projectId" defaultValue="">
                <option value="">Not tied to one project</option>
                {customerProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="text-sm" />
            <Button type="submit" disabled={busy} size="sm">
              Publish file
            </Button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
