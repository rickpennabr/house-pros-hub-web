'use client';

import { useEffect, useState } from 'react';
import { CrmStatCards } from '@/components/crm/CrmStatCards';

interface Summary { active: number; dueThisWeek: number; overdue: number; visitsThisMonth: number }

/** Indicator cards on the Maintenance page. Tapping Due / Overdue opens Next visits. */
export function MaintenanceStatCards({ onOpenNext }: { onOpenNext: () => void }) {
  const [sum, setSum] = useState<Summary | null>(null);
  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let live = true;
    fetch(`/api/crm/maintenance/summary?timeZone=${encodeURIComponent(timeZone)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Summary | null) => { if (live && data) setSum(data); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  if (!sum) return null;
  const houses = (n: number) => `${n} ${n === 1 ? 'house' : 'houses'}`;
  return (
    <CrmStatCards
      cards={[
        { key: 'active', label: 'Active plans', value: houses(sum.active), sub: 'On a maintenance plan' },
        { key: 'due', label: 'Due this week', value: houses(sum.dueThisWeek), sub: 'Next 7 days' },
        { key: 'overdue', label: 'Overdue', value: houses(sum.overdue), sub: 'Visit date passed', alert: sum.overdue > 0 },
        { key: 'month', label: 'Visits this month', value: String(sum.visitsThisMonth), sub: sum.visitsThisMonth === 1 ? 'visit' : 'visits' },
      ]}
      onSelect={(key) => { if (key === 'due' || key === 'overdue') onOpenNext(); }}
    />
  );
}
