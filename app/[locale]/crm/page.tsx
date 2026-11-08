'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarDays, FileCheck, FilePlus2, FileText, FolderKanban, Loader2, Plus, Users } from 'lucide-react';
import { MobileGridActionsModal, type MobileGridActionItem } from '@/components/crm/MobileGridActionsModal';
import { CRMSearchField } from '@/components/crm/CRMSearchField';
import { useCRMChrome } from '@/components/crm/CRMChromeContext';

interface CRMEstimate {
  id: string;
  display_id: string | null;
  created_at: string;
  amount_cents: number;
  status: 'draft' | 'sent' | 'accepted' | 'declined';
}

interface CRMInvoice {
  id: string;
  display_id: string | null;
  invoice_number: string | null;
  created_at: string;
  amount_cents: number;
  payment_applied_cents: number;
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
}

interface CRMProject {
  id: string;
  display_id: string | null;
  name: string;
  created_at: string;
  status: 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
}

interface CRMTask {
  id: string;
  created_at: string;
  start_at: string;
  task_type: 'estimate_appointment' | 'business_meeting' | 'follow_up' | 'other';
  meeting_with: string | null;
  note?: string | null;
  other_label?: string | null;
}

interface DashHit {
  id: string;
  title: string;
  detail: string;
  href: string;
}

interface DashSearchHits {
  customers: DashHit[];
  estimates: DashHit[];
  invoices: DashHit[];
  projects: DashHit[];
  expenses: DashHit[];
}

function includesText(text: string, needle: string) {
  return text.toLowerCase().includes(needle);
}

function customerTitle(row: {
  display_name?: string | null;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_id?: string | null;
}) {
  return row.display_name?.trim()
    || row.company_name?.trim()
    || [row.first_name, row.last_name].filter(Boolean).join(' ')
    || row.display_id
    || 'Customer';
}

interface DashboardData {
  customersTotal: number;
  estimatesTotal: number;
  estimatesAccepted: number;
  invoicesTotal: number;
  invoicesPaid: number;
  projectsTotal: number;
  projectsActive: number;
  tasksUpcoming7d: CRMTask[];
  recentEstimates: CRMEstimate[];
  recentInvoices: CRMInvoice[];
  recentProjects: CRMProject[];
}

const money = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

const dateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const dateOnly = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Failed: ${url}`);
  return data as T;
}

export default function CRMPage() {
  const locale = useLocale();
  const router = useRouter();
  const { roles } = useAuth();
  const realtorOnly = (roles as string[]).includes('realtor') && !roles.includes('contractor');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const crmChrome = useCRMChrome();
  const searchRowRef = useRef<HTMLFormElement | null>(null);
  const [dashQuery, setDashQuery] = useState('');
  const [dashHits, setDashHits] = useState<DashSearchHits | null>(null);
  const [dashResultQuery, setDashResultQuery] = useState('');

  useEffect(() => {
    if (realtorOnly) {
      router.replace(`/${locale}/crm/calendar`);
      return;
    }
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      const now = new Date();
      const in7Days = new Date(now);
      in7Days.setDate(in7Days.getDate() + 7);

      try {
        const [
          customers,
          estimates,
          estimatesAccepted,
          recentEstimates,
          invoices,
          invoicesPaid,
          recentInvoices,
          projects,
          projectsActive,
          recentProjects,
          tasks,
        ] = await Promise.all([
          fetchJson<{ total: number }>('/api/crm/customers?page=1&pageSize=1'),
          fetchJson<{ total: number }>('/api/crm/estimates?page=1&pageSize=1'),
          fetchJson<{ total: number }>('/api/crm/estimates?page=1&pageSize=1&status=accepted'),
          fetchJson<{ estimates: CRMEstimate[] }>('/api/crm/estimates?page=1&pageSize=5&sortBy=created_at&sortDir=desc'),
          fetchJson<{ total: number }>('/api/crm/invoices?page=1&pageSize=1'),
          fetchJson<{ total: number }>('/api/crm/invoices?page=1&pageSize=1&status=paid'),
          fetchJson<{ invoices: CRMInvoice[] }>('/api/crm/invoices?page=1&pageSize=5&sortBy=created_at&sortDir=desc'),
          fetchJson<{ total: number }>('/api/crm/projects?page=1&pageSize=1'),
          fetchJson<{ total: number }>('/api/crm/projects?page=1&pageSize=1&status=in_progress'),
          fetchJson<{ projects: CRMProject[] }>('/api/crm/projects?page=1&pageSize=5&sortBy=created_at&sortDir=desc'),
          fetchJson<{ tasks: CRMTask[] }>(
            `/api/crm/tasks?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(in7Days.toISOString())}`
          ),
        ]);

        if (!mounted) return;
        setData({
          customersTotal: customers.total || 0,
          estimatesTotal: estimates.total || 0,
          estimatesAccepted: estimatesAccepted.total || 0,
          invoicesTotal: invoices.total || 0,
          invoicesPaid: invoicesPaid.total || 0,
          projectsTotal: projects.total || 0,
          projectsActive: projectsActive.total || 0,
          tasksUpcoming7d: tasks.tasks || [],
          recentEstimates: recentEstimates.estimates || [],
          recentInvoices: recentInvoices.invoices || [],
          recentProjects: recentProjects.projects || [],
        });
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [realtorOnly, locale, router]);

  const totals = useMemo(() => {
    if (!data) return { estimateAmount: 0, invoiceAmount: 0, invoiceOutstanding: 0 };
    const estimateAmount = data.recentEstimates.reduce((sum, x) => sum + (x.amount_cents || 0), 0);
    const invoiceAmount = data.recentInvoices.reduce((sum, x) => sum + (x.amount_cents || 0), 0);
    const invoiceOutstanding = data.recentInvoices.reduce(
      (sum, x) => sum + Math.max((x.amount_cents || 0) - (x.payment_applied_cents || 0), 0),
      0
    );
    return { estimateAmount, invoiceAmount, invoiceOutstanding };
  }, [data]);

  const recentActivity = useMemo(() => {
    if (!data) return [];
    const estimateEvents = data.recentEstimates.map((item) => ({
      id: `estimate-${item.id}`,
      title: item.display_id ? `Estimate ${item.display_id}` : 'Estimate',
      subtitle: `Status: ${item.status}`,
      when: item.created_at,
      href: `/${locale}/crm/estimates`,
    }));
    const invoiceEvents = data.recentInvoices.map((item) => ({
      id: `invoice-${item.id}`,
      title: item.invoice_number ? `Invoice ${item.invoice_number}` : (item.display_id ? `Invoice ${item.display_id}` : 'Invoice'),
      subtitle: `Status: ${item.status} - ${money(item.amount_cents || 0)}`,
      when: item.created_at,
      href: `/${locale}/crm/invoices`,
    }));
    const projectEvents = data.recentProjects.map((item) => ({
      id: `project-${item.id}`,
      title: item.name || (item.display_id ? `Project ${item.display_id}` : 'Project'),
      subtitle: `Status: ${item.status}`,
      when: item.created_at,
      href: `/${locale}/crm/projects`,
    }));

    return [...estimateEvents, ...invoiceEvents, ...projectEvents]
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
      .slice(0, 10);
  }, [data, locale]);

  useEffect(() => {
    if (!crmChrome?.searchOpen) return;
    const close = (event: PointerEvent) => {
      if (searchRowRef.current?.contains(event.target as Node)) return;
      crmChrome.setSearchOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [crmChrome]);

  useEffect(() => {
    const query = dashQuery.trim();
    if (!query) {
      setDashHits(null);
      setDashResultQuery('');
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const enc = encodeURIComponent(query);
      Promise.all([
        fetchJson<{ customers: Array<{ id: string; display_name?: string | null; company_name?: string | null; first_name?: string | null; last_name?: string | null; display_id?: string | null; city?: string | null; state?: string | null; email?: string | null; phone?: string | null }> }>(`/api/crm/customers?page=1&pageSize=20&search=${enc}`),
        fetchJson<{ estimates: Array<{ id: string; display_id?: string | null; status?: string | null; customerFirstName?: string | null; customerLastName?: string | null }> }>(`/api/crm/estimates?page=1&pageSize=20&search=${enc}`),
        fetchJson<{ invoices: Array<{ id: string; invoice_number?: string | null; display_id?: string | null; status?: string | null; customerFirstName?: string | null; customerLastName?: string | null }> }>(`/api/crm/invoices?page=1&pageSize=20&search=${enc}`),
        fetchJson<{ projects: Array<{ id: string; name?: string | null; display_id?: string | null; status?: string | null; customerFirstName?: string | null; customerLastName?: string | null }> }>(`/api/crm/projects?page=1&pageSize=20&search=${enc}`),
        fetchJson<{ expenses: Array<{ id: string; category?: string | null; note?: string | null; amount_cents?: number | null }> }>(`/api/crm/expenses?page=1&pageSize=20&search=${enc}`),
      ]).then(([customers, estimates, invoices, projects, expenses]) => {
        if (cancelled) return;
        setDashHits({
          customers: (customers.customers || []).map((row) => ({
            id: row.id,
            title: customerTitle(row),
            detail: [row.city, row.state, row.email, row.phone].filter(Boolean).join(' · '),
            href: `/${locale}/crm/customers`,
          })),
          estimates: (estimates.estimates || []).map((row) => ({
            id: row.id,
            title: [row.customerFirstName, row.customerLastName].filter(Boolean).join(' ') || (row.display_id ? `Estimate ${row.display_id}` : 'Estimate'),
            detail: row.status ? `Status: ${row.status}` : '',
            href: `/${locale}/crm/estimates`,
          })),
          invoices: (invoices.invoices || []).map((row) => ({
            id: row.id,
            title: [row.customerFirstName, row.customerLastName].filter(Boolean).join(' ') || (row.invoice_number ? `Invoice ${row.invoice_number}` : 'Invoice'),
            detail: [row.invoice_number, row.status].filter(Boolean).join(' · '),
            href: `/${locale}/crm/invoices`,
          })),
          projects: (projects.projects || []).map((row) => ({
            id: row.id,
            title: row.name || (row.display_id ? `Project ${row.display_id}` : 'Project'),
            detail: [[row.customerFirstName, row.customerLastName].filter(Boolean).join(' '), row.status].filter(Boolean).join(' · '),
            href: `/${locale}/crm/projects`,
          })),
          expenses: (expenses.expenses || []).map((row) => ({
            id: row.id,
            title: row.category || 'Expense',
            detail: [row.note, typeof row.amount_cents === 'number' ? money(row.amount_cents) : ''].filter(Boolean).join(' · '),
            href: `/${locale}/crm/expenses`,
          })),
        });
        setDashResultQuery(query.toLowerCase());
      }).catch(() => {
        if (cancelled) return;
        setDashHits({ customers: [], estimates: [], invoices: [], projects: [], expenses: [] });
        setDashResultQuery(query.toLowerCase());
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [dashQuery, locale]);

  const addActionItems: MobileGridActionItem[] = [
    {
      id: 'add-customer',
      label: 'Customer',
      icon: Users,
      onClick: () => router.push(`/${locale}/crm/customers?new=1`),
    },
    {
      id: 'add-estimate',
      label: 'Estimate',
      icon: FileText,
      onClick: () => router.push(`/${locale}/crm/estimates`),
    },
    {
      id: 'add-invoice',
      label: 'Invoice',
      icon: FileCheck,
      onClick: () => router.push(`/${locale}/crm/invoices/new`),
    },
    {
      id: 'add-project',
      label: 'Project',
      icon: FolderKanban,
      onClick: () => router.push(`/${locale}/crm/projects`),
    },
    {
      id: 'add-expense',
      label: 'Expense',
      icon: FilePlus2,
      onClick: () => router.push(`/${locale}/crm/expenses`),
    },
    {
      id: 'add-task',
      label: 'Task / Appointment',
      icon: CalendarDays,
      onClick: () => router.push(`/${locale}/crm/calendar`),
    },
  ];

  if (loading) {
    return (
      <div className="w-full rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-600 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {error || 'Unable to load dashboard'}
      </div>
    );
  }

  const needle = dashQuery.trim().toLowerCase();
  const filtering = Boolean(needle) && dashResultQuery === needle && dashHits !== null;
  const sectionMatches = (text: string, hits?: DashHit[]) => {
    if (!filtering || !needle) return true;
    if (includesText(text, needle)) return true;
    return (hits ?? []).length > 0;
  };
  const taskBlob = data.tasksUpcoming7d
    .map((task) => `${task.task_type} ${task.other_label ?? ''} ${task.meeting_with ?? ''} ${task.note ?? ''}`)
    .join(' ');
  const showCustomers = sectionMatches(`Customers ${data.customersTotal}`, dashHits?.customers);
  const showEstimates = sectionMatches(`Estimates ${data.estimatesTotal} ${data.estimatesAccepted} accepted`, dashHits?.estimates);
  const showInvoices = sectionMatches(`Invoices ${data.invoicesTotal} ${data.invoicesPaid} paid`, dashHits?.invoices);
  const showProjects = sectionMatches(`Projects ${data.projectsTotal} ${data.projectsActive} in progress`, dashHits?.projects);
  const showTasks = sectionMatches(`Upcoming tasks ${data.tasksUpcoming7d.length} next 7 days ${taskBlob}`);
  const financialText = `Financial Snapshot Estimate value ${money(totals.estimateAmount)} Invoice value ${money(totals.invoiceAmount)} Outstanding ${money(totals.invoiceOutstanding)}`;
  const showFinancial = sectionMatches(financialText);
  const visibleActivity = filtering
    ? recentActivity.filter((item) => includesText(`${item.title} ${item.subtitle}`, needle))
    : recentActivity;
  const showActivity = !filtering || includesText('Recent Activity', needle) || visibleActivity.length > 0;
  const visibleTasks = filtering
    ? data.tasksUpcoming7d.filter((task) => includesText(`${task.task_type} ${task.other_label ?? ''} ${task.meeting_with ?? ''} ${task.note ?? ''}`, needle) || includesText('Upcoming tasks', needle))
    : data.tasksUpcoming7d;
  const hitGroups = filtering && dashHits
    ? [
        { title: 'Customers', items: dashHits.customers },
        { title: 'Estimates', items: dashHits.estimates },
        { title: 'Invoices', items: dashHits.invoices },
        { title: 'Projects', items: dashHits.projects },
        { title: 'Expenses', items: dashHits.expenses },
      ].filter((group) => group.items.length > 0)
    : [];
  const nothingMatched = filtering
    && !showCustomers && !showEstimates && !showInvoices && !showProjects && !showTasks
    && !showFinancial && !showActivity && hitGroups.length === 0;

  return (
    <div className="w-full space-y-4">
      <div className="max-md:hidden! md:flex md:items-center md:justify-between md:gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your CRM performance at a glance.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="hidden md:inline-flex h-9 items-center gap-1 rounded-lg border-2 border-black bg-black px-3 text-sm font-medium text-white hover:bg-gray-800 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      <CRMSearchField
        formRef={searchRowRef}
        value={dashQuery}
        onChange={setDashQuery}
        placeholder="Search customers, estimates, invoices..."
        onFocus={() => crmChrome?.setSearchOpen(true)}
        showClose={Boolean(crmChrome?.searchOpen)}
        onClose={() => {
          crmChrome?.setSearchOpen(false);
          (document.activeElement as HTMLElement | null)?.blur();
        }}
        className="pt-2 md:pt-0"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {showCustomers && (
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-center gap-2 text-gray-600"><Users className="h-4 w-4 text-red-600" /> Contacts</div>
          <p className="mt-2 text-2xl font-semibold text-black">{data.customersTotal}</p>
        </div>
        )}
        {showEstimates && (
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-center gap-2 text-gray-600"><FileText className="h-4 w-4 text-red-600" /> Estimates</div>
          <p className="mt-2 text-2xl font-semibold text-black">{data.estimatesTotal}</p>
          <p className="text-xs text-gray-500 mt-1">{data.estimatesAccepted} accepted</p>
        </div>
        )}
        {showInvoices && (
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-center gap-2 text-gray-600"><FileCheck className="h-4 w-4 text-red-600" /> Invoices</div>
          <p className="mt-2 text-2xl font-semibold text-black">{data.invoicesTotal}</p>
          <p className="text-xs text-gray-500 mt-1">{data.invoicesPaid} paid</p>
        </div>
        )}
        {showProjects && (
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-center gap-2 text-gray-600"><FolderKanban className="h-4 w-4 text-red-600" /> Projects</div>
          <p className="mt-2 text-2xl font-semibold text-black">{data.projectsTotal}</p>
          <p className="text-xs text-gray-500 mt-1">{data.projectsActive} in progress</p>
        </div>
        )}
        {showTasks && (
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-center gap-2 text-gray-600"><CalendarDays className="h-4 w-4 text-red-600" /> Upcoming tasks</div>
          <p className="mt-2 text-2xl font-semibold text-black">{data.tasksUpcoming7d.length}</p>
          <p className="text-xs text-gray-500 mt-1">next 7 days</p>
        </div>
        )}
      </div>

      {hitGroups.length > 0 && (
        <div className="space-y-3">
          {hitGroups.map((group) => (
            <div key={group.title} className="rounded-lg border-2 border-black bg-white p-4">
              <h2 className="text-base font-semibold text-gray-900">{group.title}</h2>
              <div className="mt-2 divide-y divide-gray-100">
                {group.items.map((item) => (
                  <Link key={`${group.title}-${item.id}`} href={item.href} className="block py-2 hover:bg-gray-50 rounded-md px-1">
                    <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                    {item.detail ? <p className="truncate text-xs text-gray-500">{item.detail}</p> : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {nothingMatched && (
        <p className="text-sm text-gray-500">No matches.</p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {showFinancial && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Financial Snapshot (Recent)</h2>
              <p className="text-xs text-gray-500 mt-1">Based on latest invoices and estimates.</p>
            </div>
            <Link href={`/${locale}/crm/reports`} className="text-sm font-medium text-black underline shrink-0">
              Reports
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Estimate value</p>
              <p className="text-lg font-semibold text-black mt-1">{money(totals.estimateAmount)}</p>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Invoice value</p>
              <p className="text-lg font-semibold text-black mt-1">{money(totals.invoiceAmount)}</p>
            </div>
            <div className="rounded-md border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Outstanding</p>
              <p className="text-lg font-semibold text-black mt-1">{money(totals.invoiceOutstanding)}</p>
            </div>
          </div>
        </div>
        )}

        {showTasks && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">Upcoming Tasks (7 Days)</h2>
          {visibleTasks.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No upcoming tasks this week.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {visibleTasks.slice(0, 6).map((task) => (
                <div key={task.id} className="rounded-md border border-gray-200 p-2.5">
                  <p className="text-sm font-medium text-gray-900">
                    {(task.task_type || 'task').replaceAll('_', ' ')}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {task.meeting_with || 'No contact set'} · {dateTime(task.start_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      {showActivity && (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
        {visibleActivity.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No recent activity yet.</p>
        ) : (
          <div className="mt-3 divide-y divide-gray-100">
            {visibleActivity.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="flex items-center justify-between gap-3 py-2.5 hover:bg-gray-50 rounded-md px-1"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="truncate text-xs text-gray-500">{item.subtitle}</p>
                </div>
                <span className="shrink-0 text-xs text-gray-500">{dateOnly(item.when)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      )}

      <MobileGridActionsModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New"
        items={addActionItems}
      />

      <button
        type="button"
        onClick={() => setShowAddModal(true)}
        className="md:hidden fixed bottom-[100px] right-[50px] z-50 h-12 w-12 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all shadow-lg"
        aria-label="Add new"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
