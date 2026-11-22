'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import Accordion from '@/components/ui/Accordion';
import type { ContactProperty } from '@/lib/places/contact-places';
import { TimelineSteps } from '@/components/timeline/TimelineSteps';
import { buildProPropertyTimeline } from '@/lib/timeline/steps';

export interface PropertyHistory {
  properties: ContactProperty[];
  property: ContactProperty | null;
  totals: { invoicedCents: number; paidCents: number; balanceCents: number; visits: number; laborSeconds: number };
  estimates: Array<{
    id: string;
    display_id: string;
    amount_cents: number;
    status: string;
    agreement_kind: string;
    job_area: string | null;
    created_at: string;
    updated_at?: string | null;
    signed_at?: string | null;
    signer_name?: string | null;
  }>;
  invoices: Array<{
    id: string;
    display_id: string;
    invoice_number: string;
    amount_cents: number;
    payment_applied_cents: number;
    status: string;
    invoice_date: string;
    due_date: string | null;
    created_at?: string | null;
  }>;
  payments: Array<{
    id: string;
    invoice_id: string;
    amount_cents: number;
    payment_date: string;
    method: string;
    reference: string | null;
  }>;
  plans: Array<{
    id: string;
    name: string;
    frequency: string;
    next_visit_date: string | null;
    last_visit_date: string | null;
    is_active: boolean;
    amount_cents: number | null;
    created_at?: string | null;
  }>;
  visits: Array<{
    id: string;
    maintenance_plan_id: string | null;
    status: string;
    started_at: string;
    ended_at?: string | null;
    labor_seconds: number | null;
    duration_seconds: number | null;
    generated_description: string | null;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    shared?: boolean | null;
  }>;
  documents: Array<{ id: string; title: string; kind: string; created_at: string; visible_to_customer?: boolean | null }>;
}

const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const day = (value: string | null) => (value ? value.slice(0, 10) : '');

const hours = (seconds: number) => `${(seconds / 3600).toFixed(1)}h`;

const label = (value: string) => value.replace(/_/g, ' ');

function Group({
  title,
  count,
  children,
  defaultOpen = false,
  subtitle,
}: {
  title: string;
  count: number;
  children: ReactNode;
  defaultOpen?: boolean;
  subtitle?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <Accordion
      title={title}
      subtitle={subtitle ?? (count === 1 ? '1 record' : `${count} records`)}
      isOpen={isOpen}
      onToggle={() => setIsOpen((open) => !open)}
    >
      {count === 0 ? <p className="text-sm text-gray-600">Nothing yet.</p> : <ul className="space-y-1 text-sm">{children}</ul>}
    </Accordion>
  );
}

function Row({ href, left, right }: { href?: string; left: ReactNode; right?: ReactNode }) {
  const body = (
    <>
      <span className="min-w-0 truncate">{left}</span>
      {right ? <span className="shrink-0 text-gray-700">{right}</span> : null}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-center justify-between gap-3 rounded px-1 py-1 hover:bg-gray-100">
          {body}
        </Link>
      ) : (
        <div className="flex items-center justify-between gap-3 px-1 py-1">{body}</div>
      )}
    </li>
  );
}

/** Everything done on one of the customer's properties, for the pro on the Customer portal page. */
export function PortalPropertyHistory({ data, locale }: { data: PropertyHistory; locale: string }) {
  const { totals } = data;
  const invoiceNumber = new Map(data.invoices.map((row) => [row.id, row.invoice_number || row.display_id]));
  const planName = new Map(data.plans.map((row) => [row.id, row.name]));
  const crm = `/${locale}/crm`;
  const timeline = buildProPropertyTimeline(data, crm);
  const [timelineOpen, setTimelineOpen] = useState(true);

  return (
    <section className="border-2 border-black rounded-lg p-4 space-y-3">
      <h2 className="font-semibold">Everything on this property</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        {[
          ['Invoiced', money(totals.invoicedCents)],
          ['Paid', money(totals.paidCents)],
          ['Balance due', money(totals.balanceCents)],
          ['Visits', `${totals.visits} · ${hours(totals.laborSeconds)}`],
        ].map(([name, value]) => (
          <div key={name} className="border border-black rounded-lg px-3 py-2">
            <p className="text-xs text-gray-600">{name}</p>
            <p className="font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <Accordion
        title="Timeline"
        subtitle={timeline.length === 1 ? '1 step · what you and the customer see' : `${timeline.length} steps · what you and the customer see`}
        isOpen={timelineOpen}
        onToggle={() => setTimelineOpen((open) => !open)}
      >
        <TimelineSteps steps={timeline} emptyText="Nothing on this property yet." showAudience />
      </Accordion>

      <Group title="Payments" count={data.payments.length}>
        {data.payments.map((row) => (
          <Row
            key={row.id}
            href={`${crm}/invoices/${row.invoice_id}`}
            left={`${day(row.payment_date)} · ${label(row.method)} · invoice ${invoiceNumber.get(row.invoice_id) ?? ''}`}
            right={money(row.amount_cents)}
          />
        ))}
      </Group>

      <Group title="Invoices" count={data.invoices.length}>
        {data.invoices.map((row) => (
          <Row
            key={row.id}
            href={`${crm}/invoices/${row.id}`}
            left={`${row.invoice_number || row.display_id} · ${day(row.invoice_date)} · ${label(row.status)}`}
            right={
              row.payment_applied_cents > 0 && row.payment_applied_cents < row.amount_cents
                ? `${money(row.payment_applied_cents)} of ${money(row.amount_cents)}`
                : money(row.amount_cents)
            }
          />
        ))}
      </Group>

      <Group title="Estimates" count={data.estimates.length}>
        {data.estimates.map((row) => (
          <Row
            key={row.id}
            href={`${crm}/estimates?id=${row.id}`}
            left={`${row.display_id} · ${day(row.created_at)} · ${label(row.agreement_kind)}${row.job_area ? ` · ${row.job_area}` : ''} · ${label(row.status)}`}
            right={money(row.amount_cents)}
          />
        ))}
      </Group>

      <Group title="Maintenance visits" count={data.visits.length}>
        {data.visits.map((row) => (
          <Row
            key={row.id}
            href={`${crm}/maintenance/visits/${row.id}`}
            left={`${day(row.started_at)}${row.maintenance_plan_id && planName.get(row.maintenance_plan_id) ? ` · ${planName.get(row.maintenance_plan_id)}` : ''} · ${label(row.status)}`}
            right={hours(row.labor_seconds ?? row.duration_seconds ?? 0)}
          />
        ))}
      </Group>

      <Group title="Maintenance agreements" count={data.plans.length}>
        {data.plans.map((row) => (
          <Row
            key={row.id}
            href={`${crm}/maintenance/houses/${row.id}`}
            left={`${row.name} · ${row.frequency}${row.is_active ? '' : ' · ended'}${row.next_visit_date ? ` · next ${row.next_visit_date}` : ''}`}
            right={row.amount_cents != null ? `${money(row.amount_cents)} / visit` : undefined}
          />
        ))}
      </Group>

      <Group title="Projects" count={data.projects.length}>
        {data.projects.map((row) => (
          <Row
            key={row.id}
            href={`${crm}/projects`}
            left={`${row.name} · ${label(row.status)}`}
            right={[day(row.start_date), day(row.end_date)].filter(Boolean).join(' – ') || undefined}
          />
        ))}
      </Group>

      <Group title="Files" count={data.documents.length}>
        {data.documents.map((row) => (
          <li key={row.id}>
            <a
              href={`/api/places/documents/${row.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded px-1 py-1 hover:bg-gray-100"
            >
              <span className="min-w-0 truncate">{row.title}</span>
              <span className="shrink-0 text-gray-700">
                {label(row.kind)} · {day(row.created_at)}
              </span>
            </a>
          </li>
        ))}
      </Group>
    </section>
  );
}
