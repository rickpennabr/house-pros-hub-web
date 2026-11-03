'use client';

import { useEffect, useState } from 'react';
import type { ProInviter } from '@/lib/pros/inviter';

let cached: ProInviter[] | null = null;
let inflight: Promise<ProInviter[]> | null = null;

function loadProInviters(): Promise<ProInviter[]> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch('/api/pros/inviters')
      .then((res) => res.json())
      .then((data: { inviters?: ProInviter[] }) => {
        const inviters = Array.isArray(data.inviters) ? data.inviters : [];
        cached = inviters;
        return inviters;
      })
      .catch(() => {
        inflight = null;
        return cached ?? [];
      });
  }
  return inflight;
}

/** Pros already on the platform. Pass enabled so customer signup does not request the list. */
export function useProInviters(enabled: boolean): { inviters: ProInviter[]; loading: boolean } {
  const [inviters, setInviters] = useState<ProInviter[]>(enabled ? cached ?? [] : []);
  const [loading, setLoading] = useState(enabled && !cached);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (!cached) setLoading(true);
    void loadProInviters().then((rows) => {
      if (cancelled) return;
      setInviters(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { inviters: enabled ? inviters : [], loading: enabled && loading };
}
