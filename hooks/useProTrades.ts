'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TradeSlug } from '@/lib/protrades/trades';

export interface ProTradesState {
  /** False for crew members: they follow the owner's trades. */
  canManage: boolean;
  active: TradeSlug[];
  limit: number | null;
  planName: string;
}

const EVENT = 'protrades-changed';
let cache: ProTradesState | null = null;
let inflight: Promise<ProTradesState | null> | null = null;

function fetchTrades(): Promise<ProTradesState | null> {
  inflight ??= fetch('/api/crm/protrades', { credentials: 'include' })
    .then(async (res) => (res.ok ? ((await res.json()) as ProTradesState) : null))
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** The pro's turned-on trades, shared across the CRM menu and pages. */
export function useProTrades() {
  const [state, setState] = useState<ProTradesState | null>(cache);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void fetchTrades().then((next) => {
        if (!alive || !next) return;
        cache = next;
        setState(next);
      });
    if (!cache) load();
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<ProTradesState>).detail;
      if (next) setState(next);
    };
    window.addEventListener(EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);

  /** Turn a trade on or off. Throws with the server message (e.g. the plan limit). */
  const setActive = useCallback(async (trade: TradeSlug, active: boolean) => {
    const res = await fetch('/api/crm/protrades', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trade, active }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not update ProTrades');
    cache = data as ProTradesState;
    window.dispatchEvent(new CustomEvent(EVENT, { detail: cache }));
  }, []);

  return { state, loaded: state !== null, setActive };
}
