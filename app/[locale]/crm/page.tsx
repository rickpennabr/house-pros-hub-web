'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarDays, FileCheck, FilePlus2, FileText, FolderKanban, Loader2, Plus, Users } from 'lucide-react';
import { MobileGridActionsModal, type MobileGridActionItem } from '@/components/crm/MobileGridActionsModal';

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

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your CRM performance at a glance.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="hidden md:inline-flex h-9 items-center gap-1 rounded-lg border-2 border-black bg-white px-3 text-sm font-medium text-black hover:bg-gray-50 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-center gap-2 text-gray-600"><Users className="h-4 w-4 text-red-600" /> Customers</div>
          <p className="mt-2 text-2xl font-semibold text-black">{data.customersTotal}</p>
        </div>
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-center gap-2 text-gray-600"><FileText className="h-4 w-4 text-red-600" /> Estimates</div>
          <p className="mt-2 text-2xl font-semibold text-black">{data.estimatesTotal}</p>
          <p className="text-xs text-gray-500 mt-1">{data.estimatesAccepted} accepted</p>
        </div>
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-center gap-2 text-gray-600"><FileCheck className="h-4 w-4 text-red-600" /> Invoices</div>
          <p className="mt-2 text-2xl font-semibold text-black">{data.invoicesTotal}</p>
          <p className="text-xs text-gray-500 mt-1">{data.invoicesPaid} paid</p>
        </div>
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-center gap-2 text-gray-600"><FolderKanban className="h-4 w-4 text-red-600" /> Projects</div>
          <p className="mt-2 text-2xl font-semibold text-black">{data.projectsTotal}</p>
          <p className="text-xs text-gray-500 mt-1">{data.projectsActive} in progress</p>
        </div>
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-center gap-2 text-gray-600"><CalendarDays className="h-4 w-4 text-red-600" /> Upcoming tasks</div>
          <p className="mt-2 text-2xl font-semibold text-black">{data.tasksUpcoming7d.length}</p>
          <p className="text-xs text-gray-500 mt-1">next 7 days</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">Upcoming Tasks (7 Days)</h2>
          {data.tasksUpcoming7d.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No upcoming tasks this week.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {data.tasksUpcoming7d.slice(0, 6).map((task) => (
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
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No recent activity yet.</p>
        ) : (
          <div className="mt-3 divide-y divide-gray-100">
            {recentActivity.map((item) => (
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
