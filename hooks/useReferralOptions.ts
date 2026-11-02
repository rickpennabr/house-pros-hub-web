'use client';

import { useEffect, useState } from 'react';
import { setCustomNameOptions } from '@/lib/constants/referral';

export interface ExtraReferralOption {
  id: string;
  label: string;
  asksForName: boolean;
  sortOrder: number;
}

let cached: ExtraReferralOption[] | null = null;
let inflight: Promise<ExtraReferralOption[]> | null = null;
const listeners = new Set<(options: ExtraReferralOption[]) => void>();

function applyOptions(options: ExtraReferralOption[]) {
  cached = options;
  setCustomNameOptions(options.filter((option) => option.asksForName).map((option) => option.label));
  listeners.forEach((listener) => listener(options));
}

export function publishReferralOptions(options: ExtraReferralOption[]) {
  applyOptions(options);
}

function loadReferralOptions(): Promise<ExtraReferralOption[]> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch('/api/referral-options')
      .then((res) => res.json())
      .then((data: { options?: ExtraReferralOption[] }) => {
        const options = Array.isArray(data.options) ? data.options : [];
        applyOptions(options);
        return options;
      })
      .catch(() => {
        inflight = null;
        return cached ?? [];
      });
  }
  return inflight;
}

/** Admin-added referral choices. Built-in choices stay in the signup form. */
export function useReferralOptions(): ExtraReferralOption[] {
  const [options, setOptions] = useState<ExtraReferralOption[]>(cached ?? []);

  useEffect(() => {
    listeners.add(setOptions);
    void loadReferralOptions().then(setOptions);
    return () => {
      listeners.delete(setOptions);
    };
  }, []);

  return options;
}
