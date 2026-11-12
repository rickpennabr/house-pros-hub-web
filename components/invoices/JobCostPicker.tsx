'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { emptyInvoiceLine, type InvoiceLineItem } from '@/lib/invoices/draft';
import { jobCostLine, markedUpCents, type UnbilledExpense } from '@/lib/crm/job-costs';

interface JobCostPickerProps {
  customerId: string;
  invoiceId: string | null;
  lineItems: InvoiceLineItem[];
  onLineItemsChange: (lines: InvoiceLineItem[]) => void;
}

const money = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);

export function JobCostPicker({ customerId, invoiceId, lineItems, onLineItemsChange }: JobCostPickerProps) {
  const [expenses, setExpenses] = useState<UnbilledExpense[]>([]);
  const [markup, setMarkup] = useState('0');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) {
      setExpenses([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    const params = new URLSearchParams({ customerId });
    if (invoiceId) params.set('invoiceId', invoiceId);
    fetch(`/api/crm/expenses/unbilled?${params}`, { credentials: 'include' })
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) throw new Error(data.error);
        setExpenses(data.expenses ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setExpenses([]);
          setLoadError(err instanceof Error ? err.message : 'Could not load job costs');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, invoiceId]);

  const percent = parseFloat(markup) || 0;
  const selected = new Set(lineItems.map((line) => line.expense_id).filter((id): id is string => Boolean(id)));

  const applyMarkup = (nextPercent: number) => {
    onLineItemsChange(
      lineItems.map((line) => {
        if (!line.expense_id || line.cost_cents == null) return line;
        const amount = markedUpCents(line.cost_cents, nextPercent);
        return { ...line, qty: 1, rate_cents: amount, amount_cents: amount };
      })
    );
  };

  const toggle = (expense: UnbilledExpense, checked: boolean) => {
    if (!checked) {
      const next = lineItems.filter((line) => line.expense_id !== expense.id);
      onLineItemsChange(next.length > 0 ? next : [emptyInvoiceLine()]);
      return;
    }
    const withoutBlank = lineItems.filter((line) => line.description || line.product_or_service || line.amount_cents > 0 || line.expense_id);
    onLineItemsChange([...withoutBlank, jobCostLine(expense, percent)]);
  };

  return (
    <div className="rounded-lg border-2 border-black p-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Job costs</h3>
          <p className="text-xs text-gray-500">Add project expenses to this invoice. Markup is added on top of what you paid.</p>
        </div>
        <label className="text-sm text-gray-700">
          Markup %
          <Input
            className="mt-1 w-24"
            inputMode="decimal"
            value={markup}
            onChange={(event) => {
              setMarkup(event.target.value);
              applyMarkup(parseFloat(event.target.value) || 0);
            }}
          />
        </label>
      </div>
      {!customerId ? (
        <p className="mt-3 text-sm text-gray-500">Choose a customer to see their job costs.</p>
      ) : loading ? (
        <p className="mt-3 text-sm text-gray-500">Loading job costs…</p>
      ) : loadError ? (
        <p className="mt-3 text-sm text-red-600">{loadError}</p>
      ) : expenses.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No unbilled job costs for this customer.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {expenses.map((expense) => {
            const billed = markedUpCents(expense.amountCents, percent);
            const label = expense.description?.trim() || expense.note?.trim() || expense.category;
            return (
              <li key={expense.id}>
                <label className="flex items-start gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(expense.id)}
                    onChange={(event) => toggle(expense, event.target.checked)}
                  />
                  <span>
                    <span className="font-medium">{label}</span>
                    <span className="text-gray-500">
                      {' '}· {expense.expenseDate}
                      {expense.projectName ? ` · ${expense.projectName}` : ''}
                      {expense.poNumber ? ` · PO ${expense.poNumber}` : ''}
                      {' '}· cost {money(expense.amountCents)}
                      {percent ? ` · bill ${money(billed)}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
