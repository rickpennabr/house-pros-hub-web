'use client';

import { useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_PROBOT_VOICE, isProbotVoiceId } from '@/lib/ai/voices';

/**
 * The ProBot voice this person picked. Kept on the device (instant, works for guests) and on the
 * signed-in account (user_metadata.probot_voice), so it follows them to other devices.
 */
const KEY = 'hph_probot_voice';
const listeners = new Set<() => void>();
let current: string | null = null;

function read(): string {
  if (current) return current;
  try {
    const saved = window.localStorage.getItem(KEY);
    if (isProbotVoiceId(saved)) current = saved;
  } catch {
    // Private mode: keep the default.
  }
  return current ?? DEFAULT_PROBOT_VOICE;
}

function set(id: string) {
  current = id;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    // Ignore: still used for this visit.
  }
  listeners.forEach((listener) => listener());
}

/** Load the account's voice once (another device may have changed it). */
let synced = false;
function syncFromAccount() {
  if (synced) return;
  synced = true;
  void createClient()
    .auth.getUser()
    .then(({ data }) => {
      const saved = data.user?.user_metadata?.probot_voice;
      if (isProbotVoiceId(saved) && saved !== read()) set(saved);
    })
    .catch(() => {});
}

export function setProbotVoice(id: string) {
  if (!isProbotVoiceId(id)) return;
  set(id);
  const supabase = createClient();
  void supabase.auth
    .getUser()
    .then(({ data }) => (data.user ? supabase.auth.updateUser({ data: { probot_voice: id } }) : null))
    .catch(() => {});
}

/** The picked voice id, for sending with a message. */
export function currentProbotVoice(): string {
  return typeof window === 'undefined' ? DEFAULT_PROBOT_VOICE : read();
}

export function useProbotVoice(): string {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      syncFromAccount();
      return () => {
        listeners.delete(listener);
      };
    },
    read,
    () => DEFAULT_PROBOT_VOICE
  );
}
