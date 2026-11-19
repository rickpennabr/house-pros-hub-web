'use client';

import { useEffect, useState } from 'react';
import type { ContactDeleteImpact as Impact } from '@/app/api/crm/customers/delete-impact/route';

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function listWords(parts: string[]) {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The delete confirmation's warning: deleting a contact also deletes their estimates, invoices,
 * projects, plans and files, and takes them off the customer's My Places.
 */
export function ContactDeleteImpact({ ids }: { ids: string[] }) {
  const key = ids.join(',');
  const [loaded, setLoaded] = useState<{ key: string; impact: Impact | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crm/customers/delete-impact?ids=${encodeURIComponent(key)}`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { impact?: Impact } | null) => {
        if (!cancelled) setLoaded({ key, impact: data?.impact ?? null });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, impact: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const box = 'mb-4 rounded-lg border-2 border-red-600 bg-red-50 px-3 py-2 text-left text-sm text-red-700';
  if (loaded?.key !== key) {
    return <p className={box}>Checking what else will be deleted…</p>;
  }
  const impact = loaded.impact;
  if (!impact) {
    return (
      <p className={box} role="alert">
        This also permanently deletes their estimates, invoices, projects, maintenance plans and files.
      </p>
    );
  }

  const files = impact.documents + impact.attachments;
  const parts = [
    impact.estimates ? plural(impact.estimates, 'estimate') : null,
    impact.invoices ? plural(impact.invoices, 'invoice') : null,
    impact.recurringInvoices ? plural(impact.recurringInvoices, 'recurring invoice') : null,
    impact.projects ? plural(impact.projects, 'project') : null,
    impact.maintenancePlans ? plural(impact.maintenancePlans, 'maintenance plan') : null,
    files ? plural(files, 'file') : null,
  ].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;

  return (
    <div className={box} role="alert">
      <p>
        This also permanently deletes their <strong>{listWords(parts)}</strong>.
      </p>
      {impact.linkedToHub > 0 ? (
        <p className="mt-1">
          {ids.length === 1 ? 'This customer is' : 'Some of these customers are'} on House Pros Hub. These will also
          disappear from their My Places.
        </p>
      ) : null}
    </div>
  );
}
