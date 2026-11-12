'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import AddTaskModal from '@/components/crm/AddTaskModal';
import { contactDisplayName } from '@/lib/crm/contact-name';

export type ProBotCrmViewType = 'calendar' | 'customers' | 'estimates' | 'invoices' | 'projects' | 'expenses' | 'add_task';

interface CalendarTask {
  id: string;
  task_type: string;
  other_label?: string | null;
  meeting_with?: string | null;
  start_at: string;
  end_at: string;
  note?: string | null;
  pro_crm_customers?: { first_name?: string; last_name?: string; display_name?: string | null } | null;
}

const TASK_TYPE_SHORT: Record<string, string> = {
  estimate_appointment: 'Estimate',
  business_meeting: 'Meeting',
  follow_up: 'Follow up',
  other: 'Task',
};

function formatTaskTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatTaskDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

interface ProBotCrmViewsProps {
  view: ProBotCrmViewType;
  onBack: () => void;
  onOpenAddTask?: () => void;
  onOpenAddCustomer?: () => void;
  /** When Add Task is the view, we show the modal and call this on success/close */
  onAddTaskSuccess?: () => void;
}

const btnClass =
  'probot-sky-btn px-4 py-2.5 rounded-lg bg-white border-2 border-black text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer inline-flex items-center gap-2';

export function ProBotCrmViews({ view, onBack, onOpenAddTask, onOpenAddCustomer, onAddTaskSuccess }: ProBotCrmViewsProps) {
  const t = useTranslations('bot');
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; first_name: string; last_name: string; display_name?: string | null; email?: string | null; phone?: string | null }[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [estimates, setEstimates] = useState<{ id: string; status: string; amount_cents?: number | null; due_date?: string | null; created_at: string }[]>([]);
  const [estimatesLoading, setEstimatesLoading] = useState(false);
  const [invoices, setInvoices] = useState<{ id: string; invoice_number: string; amount_cents: number; status: string; customerFirstName?: string | null; customerLastName?: string | null }[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string; status: string; start_date?: string | null; end_date?: string | null }[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [expenses, setExpenses] = useState<{ id: string; amount_cents: number; category: string; expense_date: string; description?: string | null }[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const from = new Date();
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from.getFullYear(), from.getMonth() + 2, 0, 23, 59, 59);
      const res = await fetch(
        `/api/crm/tasks?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        { credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) setTasks(data.tasks ?? []);
      else setTasks([]);
    } catch {
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const res = await fetch('/api/crm/customers?pageSize=100', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setCustomers(data.customers ?? []);
      else setCustomers([]);
    } catch {
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  const fetchEstimates = useCallback(async () => {
    setEstimatesLoading(true);
    try {
      const res = await fetch('/api/crm/estimates?pageSize=50', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setEstimates(data.estimates ?? []);
      else setEstimates([]);
    } catch {
      setEstimates([]);
    } finally {
      setEstimatesLoading(false);
    }
  }, []);

  const fetchInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const res = await fetch('/api/crm/invoices?pageSize=50', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setInvoices(data.invoices ?? []);
      else setInvoices([]);
    } catch {
      setInvoices([]);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const res = await fetch('/api/crm/projects?pageSize=50', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setProjects(data.projects ?? []);
      else setProjects([]);
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    setExpensesLoading(true);
    try {
      const res = await fetch('/api/crm/expenses?pageSize=50', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setExpenses(data.expenses ?? []);
      else setExpenses([]);
    } catch {
      setExpenses([]);
    } finally {
      setExpensesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'calendar' || view === 'add_task') fetchTasks();
  }, [view, fetchTasks]);
  useEffect(() => {
    if (view === 'customers') fetchCustomers();
  }, [view, fetchCustomers]);
  useEffect(() => {
    if (view === 'estimates') fetchEstimates();
  }, [view, fetchEstimates]);
  useEffect(() => {
    if (view === 'invoices') fetchInvoices();
  }, [view, fetchInvoices]);
  useEffect(() => {
    if (view === 'projects') fetchProjects();
  }, [view, fetchProjects]);
  useEffect(() => {
    if (view === 'expenses') fetchExpenses();
  }, [view, fetchExpenses]);

  const handleAddTaskClose = useCallback(() => {
    setAddTaskOpen(false);
    onAddTaskSuccess?.();
    fetchTasks();
    if (view === 'add_task') onBack();
  }, [view, onBack, onAddTaskSuccess, fetchTasks]);

  const handleAddTaskSuccess = useCallback(() => {
    handleAddTaskClose();
  }, [handleAddTaskClose]);

  // Add Task view: show modal only (or list + "Add task" that opens modal)
  if (view === 'add_task') {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <div className="flex items-center gap-2 shrink-0 mb-4">
          <button type="button" onClick={onBack} className={btnClass} aria-label={t('back')}>
            <ChevronLeft className="w-4 h-4" />
            {t('back')}
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tasksLoading ? (
            <p className="text-sm text-gray-500 py-4">Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No upcoming tasks. Add one below.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.slice(0, 20).map((task) => (
                <li key={task.id} className="p-3 rounded-lg bg-white border border-gray-200 text-sm">
                  <span className="font-medium text-gray-900">{TASK_TYPE_SHORT[task.task_type] ?? task.task_type}</span>
                  {task.pro_crm_customers && (
                    <span className="text-gray-600 ml-1">
                      – {contactDisplayName(task.pro_crm_customers)}
                    </span>
                  )}
                  {task.meeting_with && <span className="text-gray-600 ml-1">– {task.meeting_with}</span>}
                  <div className="text-gray-500 mt-0.5">
                    {formatTaskDate(task.start_at)} {formatTaskTime(task.start_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <button type="button" onClick={() => setAddTaskOpen(true)} className={btnClass}>
              <Plus className="w-4 h-4" />
              {t('addTask')}
            </button>
          </div>
        </div>
        <AddTaskModal isOpen={addTaskOpen} onClose={handleAddTaskClose} onSuccess={handleAddTaskSuccess} />
      </div>
    );
  }

  const renderBack = () => (
    <button type="button" onClick={onBack} className={btnClass} aria-label={t('back')}>
      <ChevronLeft className="w-4 h-4" />
      {t('back')}
    </button>
  );

  if (view === 'calendar') {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <div className="flex items-center justify-between gap-2 shrink-0 mb-4 flex-wrap">
          {renderBack()}
          <button type="button" onClick={() => setAddTaskOpen(true)} className={btnClass}>
            <Plus className="w-4 h-4" />
            {t('addTask')}
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {tasksLoading ? (
            <p className="text-sm text-gray-500 py-4">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No upcoming tasks. Add one above.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.slice(0, 30).map((task) => (
                <li key={task.id} className="p-3 rounded-lg bg-white border border-gray-200 text-sm">
                  <span className="font-medium text-gray-900">{TASK_TYPE_SHORT[task.task_type] ?? task.task_type}</span>
                  {task.pro_crm_customers && (
                    <span className="text-gray-600 ml-1">
                      – {contactDisplayName(task.pro_crm_customers)}
                    </span>
                  )}
                  {task.meeting_with && <span className="text-gray-600 ml-1">– {task.meeting_with}</span>}
                  <div className="text-gray-500 mt-0.5">
                    {formatTaskDate(task.start_at)} {formatTaskTime(task.start_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <AddTaskModal isOpen={addTaskOpen} onClose={handleAddTaskClose} onSuccess={handleAddTaskSuccess} />
      </div>
    );
  }

  if (view === 'customers') {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <div className="flex items-center justify-between gap-2 shrink-0 mb-4 flex-wrap">
          {renderBack()}
          {onOpenAddCustomer && (
            <button type="button" onClick={onOpenAddCustomer} className={btnClass}>
              <Plus className="w-4 h-4" />
              {t('addCustomer')}
            </button>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {customersLoading ? (
            <p className="text-sm text-gray-500 py-4">Loading…</p>
          ) : customers.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No customers yet. Add one above.</p>
          ) : (
            <ul className="space-y-2">
              {customers.map((c) => (
                <li key={c.id} className="p-3 rounded-lg bg-white border border-gray-200 text-sm">
                  <span className="font-medium text-gray-900">
                    {contactDisplayName(c)}
                  </span>
                  {c.email && <div className="text-gray-500 truncate">{c.email}</div>}
                  {c.phone && <div className="text-gray-500">{c.phone}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (view === 'estimates') {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <div className="flex items-center gap-2 shrink-0 mb-4">{renderBack()}</div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {estimatesLoading ? (
            <p className="text-sm text-gray-500 py-4">Loading…</p>
          ) : estimates.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No estimates yet.</p>
          ) : (
            <ul className="space-y-2">
              {estimates.map((e) => (
                <li key={e.id} className="p-3 rounded-lg bg-white border border-gray-200 text-sm flex justify-between items-center">
                  <span className="font-medium text-gray-900 capitalize">{e.status}</span>
                  {e.amount_cents != null && <span className="text-gray-600">${(e.amount_cents / 100).toFixed(2)}</span>}
                  {e.due_date && <span className="text-gray-500 text-xs">{new Date(e.due_date).toLocaleDateString()}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (view === 'invoices') {
    const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] || 'en' : 'en';
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <div className="flex items-center gap-2 shrink-0 mb-4">{renderBack()}</div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {invoicesLoading ? (
            <p className="text-sm text-gray-500 py-4">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No invoices yet.</p>
          ) : (
            <ul className="space-y-2">
              {invoices.map((inv) => (
                <li key={inv.id} className="p-3 rounded-lg bg-white border border-gray-200 text-sm flex justify-between items-center">
                  <span className="font-medium text-gray-900">{inv.invoice_number}</span>
                  <span className="text-gray-600">${(inv.amount_cents / 100).toFixed(2)}</span>
                  <span className="text-gray-500 capitalize">{inv.status}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm mt-4">
            <a href={`/${locale}/crm/invoices`} className="text-black font-medium underline hover:no-underline">
              Open full Invoices →
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (view === 'projects') {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <div className="flex items-center gap-2 shrink-0 mb-4">{renderBack()}</div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {projectsLoading ? (
            <p className="text-sm text-gray-500 py-4">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No projects yet.</p>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id} className="p-3 rounded-lg bg-white border border-gray-200 text-sm">
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <div className="text-gray-500 capitalize">{p.status.replace('_', ' ')}</div>
                  {(p.start_date || p.end_date) && (
                    <div className="text-gray-500 text-xs">
                      {p.start_date && new Date(p.start_date).toLocaleDateString()}
                      {p.start_date && p.end_date && ' – '}
                      {p.end_date && new Date(p.end_date).toLocaleDateString()}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (view === 'expenses') {
    return (
      <div className="flex flex-col flex-1 min-h-0 w-full">
        <div className="flex items-center gap-2 shrink-0 mb-4">{renderBack()}</div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {expensesLoading ? (
            <p className="text-sm text-gray-500 py-4">Loading…</p>
          ) : expenses.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No expenses yet.</p>
          ) : (
            <ul className="space-y-2">
              {expenses.map((e) => (
                <li key={e.id} className="p-3 rounded-lg bg-white border border-gray-200 text-sm flex justify-between items-center">
                  <span className="font-medium text-gray-900">${(e.amount_cents / 100).toFixed(2)}</span>
                  <span className="text-gray-600 capitalize">{e.category}</span>
                  <span className="text-gray-500 text-xs">{new Date(e.expense_date).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return null;
}
