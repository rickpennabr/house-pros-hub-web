'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { FileCheck, FileText, FolderKanban, History, LayoutGrid, Receipt, Wrench } from 'lucide-react';
import type { ContactProperty } from '@/lib/places/contact-places';
import { MobileGridActionsModal } from '@/components/crm/MobileGridActionsModal';
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

/** Same tabs, icons and order as the customer's My Places page. */
const TABS = [
  { id: 'timeline', label: 'Timeline', icon: History },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'invoices', label: 'Invoices', icon: Receipt },
  { id: 'estimates', label: 'Estimates', icon: FileCheck },
] as const;
type PortalTab = (typeof TABS)[number]['id'];

const money = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const hours = (seconds: number) => `${(seconds / 3600).toFixed(1)}h`;

const label = (value: string) => {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** "Nov 22, 2026" from a date or timestamp. */
function formatDay(value: string | null | undefined) {
  if (!value) return '—';
  const [year, month, dayOfMonth] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !dayOfMonth) return value;
  return new Date(year, month - 1, dayOfMonth).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatWhen(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || value.length <= 10) return formatDay(value);
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Panel({ children, empty, emptyText }: { children: ReactNode; empty: boolean; emptyText: string }) {
  return (
    <section className="space-y-2 rounded-lg border-2 border-black p-4" role="tabpanel">
      {empty ? <p className="text-sm text-gray-600">{emptyText}</p> : children}
    </section>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="pt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h3>;
}

/** One record, like the rows on My Places: name, a gray line under it, and a red action on the right. */
function RecordRow({
  href,
  external = false,
  title,
  meta,
  amount,
  action = 'Open',
}: {
  href?: string;
  external?: boolean;
  title: ReactNode;
  meta: ReactNode;
  amount?: string;
  action?: string;
}) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block truncate font-medium">{title}</span>
        <span className="block text-xs text-gray-600">{meta}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {amount ? <span className="font-semibold">{amount}</span> : null}
        {href ? <span className="font-medium text-red-600">{action}</span> : null}
      </span>
    </>
  );
  const className = 'flex items-center justify-between gap-3 rounded-lg border border-black px-3 py-2 text-sm';
  if (!href) return <div className={className}>{body}</div>;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${className} hover:bg-gray-50`}>
      {body}
    </a>
  ) : (
    <Link href={href} className={`${className} hover:bg-gray-50`}>
      {body}
    </Link>
  );
}

/** Everything done on one of the customer's properties, for the pro on the Customer portal page. */
export function PortalPropertyHistory({ data, locale }: { data: PropertyHistory; locale: string }) {
  const { totals } = data;
  const [tab, setTab] = useState<PortalTab>('timeline');
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const invoiceNumber = new Map(data.invoices.map((row) => [row.id, row.invoice_number || row.display_id]));
  const planName = new Map(data.plans.map((row) => [row.id, row.name]));
  const crm = `/${locale}/crm`;
  const timeline = buildProPropertyTimeline(data, crm);
  const counts: Record<PortalTab, number> = {
    timeline: timeline.length,
    projects: data.projects.length,
    maintenance: data.plans.length + data.visits.length,
    documents: data.documents.length,
    invoices: data.invoices.length + data.payments.length,
    estimates: data.estimates.length,
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ['Invoiced', money(totals.invoicedCents)],
          ['Paid', money(totals.paidCents)],
          ['Balance due', money(totals.balanceCents)],
          ['Visits', `${totals.visits} · ${hours(totals.laborSeconds)}`],
        ].map(([name, value]) => (
          <div key={name} className="rounded-lg border-2 border-black px-3 py-2">
            <p className="text-xs text-gray-600">{name}</p>
            <p className="font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs: same bar as My Places. The phone gets a grid button too. */}
      <div className="flex items-start gap-2 pt-1">
        <button
          type="button"
          onClick={() => setTabMenuOpen(true)}
          aria-label="All sections"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-black bg-black hover:bg-gray-800 md:hidden"
        >
          <LayoutGrid className="h-5 w-5 text-white" />
        </button>
        <MobileGridActionsModal
          isOpen={tabMenuOpen}
          onClose={() => setTabMenuOpen(false)}
          title={data.property?.name ?? 'This property'}
          items={TABS.map((item) => ({
            id: item.id,
            label: item.label,
            icon: item.icon,
            isActive: tab === item.id,
            onClick: () => setTab(item.id),
          }))}
        />
        <div className="min-w-0 flex-1 overflow-x-auto pb-2" role="tablist">
          <div className="flex h-10 w-max items-center gap-2">
            {TABS.map((item) => {
              const selected = tab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(item.id)}
                  className={`group flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg border-2 px-2.5 text-sm font-medium transition-all duration-300 md:gap-2 md:px-3 ${
                    selected ? 'border-black bg-black text-white' : 'border-transparent bg-transparent text-black hover:border-gray-400'
                  }`}
                >
                  <Icon className="h-[1.125rem] w-[1.125rem] text-red-500" />
                  <span className="whitespace-nowrap">{item.label}</span>
                  {counts[item.id] > 0 ? (
                    <span
                      className={`rounded-md px-1.5 text-xs font-semibold ${selected ? 'bg-white text-black' : 'bg-gray-100 text-gray-700'}`}
                    >
                      {counts[item.id]}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {tab === 'timeline' ? (
        <section className="space-y-3 rounded-lg border-2 border-black p-4" role="tabpanel">
          <p className="text-sm text-gray-600">
            Everything that happened on this property: estimates, approvals, invoices, payments, visits and files. Each step
            says whether the customer sees it.
          </p>
          <TimelineSteps steps={timeline} emptyText="Nothing on this property yet." showAudience formatWhen={formatWhen} />
        </section>
      ) : null}

      {tab === 'projects' ? (
        <Panel empty={data.projects.length === 0} emptyText="No projects on this property yet.">
          {data.projects.map((row) => (
            <RecordRow
              key={row.id}
              href={`${crm}/projects`}
              title={row.name}
              meta={[
                label(row.status),
                `${formatDay(row.start_date)} – ${formatDay(row.end_date)}`,
                row.shared ? 'Shared with the customer' : 'Not shared',
              ].join(' · ')}
            />
          ))}
        </Panel>
      ) : null}

      {tab === 'maintenance' ? (
        <Panel empty={data.plans.length + data.visits.length === 0} emptyText="No maintenance on this property yet.">
          {data.plans.length > 0 ? <SubHeading>Agreements</SubHeading> : null}
          {data.plans.map((row) => (
            <RecordRow
              key={row.id}
              href={`${crm}/maintenance/houses/${row.id}`}
              title={row.name}
              meta={[
                label(row.frequency),
                row.is_active ? 'Active' : 'Ended',
                `Next visit: ${formatDay(row.next_visit_date)}`,
                `Last visit: ${formatDay(row.last_visit_date)}`,
              ].join(' · ')}
              amount={row.amount_cents != null ? `${money(row.amount_cents)} / visit` : undefined}
            />
          ))}
          {data.visits.length > 0 ? <SubHeading>Visits</SubHeading> : null}
          {data.visits.map((row) => (
            <RecordRow
              key={row.id}
              href={`${crm}/maintenance/visits/${row.id}`}
              title={
                (row.maintenance_plan_id && planName.get(row.maintenance_plan_id)) || `Visit on ${formatDay(row.started_at)}`
              }
              meta={[formatWhen(row.started_at), label(row.status), hours(row.labor_seconds ?? row.duration_seconds ?? 0)].join(' · ')}
            />
          ))}
        </Panel>
      ) : null}

      {tab === 'documents' ? (
        <Panel empty={data.documents.length === 0} emptyText="No files on this property yet.">
          {data.documents.map((row) => (
            <RecordRow
              key={row.id}
              href={`/api/places/documents/${row.id}`}
              external
              title={row.title}
              meta={[
                label(row.kind),
                `Added ${formatWhen(row.created_at)}`,
                row.visible_to_customer === false ? 'Hidden from the customer' : 'Customer sees it',
              ].join(' · ')}
              action="Open file"
            />
          ))}
        </Panel>
      ) : null}

      {tab === 'invoices' ? (
        <Panel empty={data.invoices.length + data.payments.length === 0} emptyText="No invoices on this property yet.">
          {data.invoices.length > 0 ? <SubHeading>Invoices</SubHeading> : null}
          {data.invoices.map((row) => {
            const balance = Math.max(0, row.amount_cents - row.payment_applied_cents);
            return (
              <RecordRow
                key={row.id}
                href={`${crm}/invoices/${row.id}`}
                title={row.invoice_number || row.display_id}
                meta={[
                  label(row.status),
                  `Balance ${money(balance)}`,
                  row.due_date ? `Due ${formatDay(row.due_date)}` : null,
                  `Dated ${formatDay(row.invoice_date)}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                amount={money(row.amount_cents)}
              />
            );
          })}
          {data.payments.length > 0 ? <SubHeading>Payments</SubHeading> : null}
          {data.payments.map((row) => (
            <RecordRow
              key={row.id}
              href={`${crm}/invoices/${row.invoice_id}`}
              title={`Payment on ${invoiceNumber.get(row.invoice_id) ?? 'invoice'}`}
              meta={[label(row.method), formatDay(row.payment_date), row.reference ? `Ref ${row.reference}` : null]
                .filter(Boolean)
                .join(' · ')}
              amount={money(row.amount_cents)}
            />
          ))}
        </Panel>
      ) : null}

      {tab === 'estimates' ? (
        <Panel empty={data.estimates.length === 0} emptyText="No estimates on this property yet.">
          {data.estimates.map((row) => (
            <RecordRow
              key={row.id}
              href={`${crm}/estimates?id=${row.id}`}
              title={`#${row.display_id}${row.job_area ? ` · ${row.job_area}` : ''}${
                row.agreement_kind === 'maintenance' ? ' · Maintenance agreement' : ''
              }`}
              meta={[
                label(row.status),
                row.signed_at ? `Signed ${formatWhen(row.signed_at)}${row.signer_name ? ` by ${row.signer_name}` : ''}` : null,
                `Created ${formatWhen(row.created_at)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
              amount={money(row.amount_cents)}
            />
          ))}
        </Panel>
      ) : null}
    </div>
  );
}
