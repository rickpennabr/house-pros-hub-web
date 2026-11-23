'use client';

import { useCallback, useEffect, useState } from 'react';
import { LEADS_CHANGED_EVENT } from '@/lib/leads/events';
import type { OpenLead } from '@/lib/leads/referrals';

/** Job requests waiting for the owner's answer; refreshes when one is answered anywhere on the page. */
export function useOpenLeads(enabled = true) {
  const [leads, setLeads] = useState<OpenLead[]>([]);

  const reload = useCallback(() => {
    if (!enabled) return;
    fetch('/api/crm/leads', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { leads?: OpenLead[] } | null) => setLeads(data?.leads ?? []))
      .catch(() => {});
  }, [enabled]);

  useEffect(() => {
    reload();
    window.addEventListener(LEADS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(LEADS_CHANGED_EVENT, reload);
  }, [reload]);

  return { leads, reload };
}
