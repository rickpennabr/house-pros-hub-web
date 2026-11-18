'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ProBotContact } from '@/components/probot/ProBotSidebar';

const PROBOT_CONTACT: ProBotContact = {
  id: 'probot',
  name: 'ProBot',
  isProBot: true,
};

const FALLBACK_CONTACTS: ProBotContact[] = [
  PROBOT_CONTACT,
  { id: 'santos-general-services', name: 'Santos General Services', isProBot: false },
];

/** Cache key prefix; suffix with auth state so guest/auth don't share. */
const CONTACTS_CACHE_KEY_PREFIX = 'probot_contacts_';
const CONTACTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedContacts(isAuthenticated: boolean): ProBotContact[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = CONTACTS_CACHE_KEY_PREFIX + (isAuthenticated ? 'auth' : 'guest');
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { contacts, ts } = JSON.parse(raw) as { contacts: ProBotContact[]; ts: number };
    if (!Array.isArray(contacts) || Date.now() - ts > CONTACTS_CACHE_TTL_MS) return null;
    return contacts;
  } catch {
    return null;
  }
}

function setCachedContacts(isAuthenticated: boolean, contacts: ProBotContact[]) {
  if (typeof window === 'undefined') return;
  try {
    const key = CONTACTS_CACHE_KEY_PREFIX + (isAuthenticated ? 'auth' : 'guest');
    sessionStorage.setItem(key, JSON.stringify({ contacts, ts: Date.now() }));
  } catch {
    // ignore quota / private
  }
}

interface UseProBotContactsArgs {
  isAuthenticated: boolean;
  userBusinessId?: string;
  /** Pro using their personal profile: list pros + ProBot instead of the customer inbox. */
  asPersonal?: boolean;
}

export function useProBotContacts({ isAuthenticated, userBusinessId, asPersonal = false }: UseProBotContactsArgs) {
  const [contacts, setContacts] = useState<ProBotContact[]>(() => {
    const cached = getCachedContacts(isAuthenticated);
    return cached ?? FALLBACK_CONTACTS;
  });
  /** Which request the current list came from, so callers know when this profile's contacts are in. */
  const requestKey = `${isAuthenticated ? 'auth' : 'guest'}|${userBusinessId ?? ''}|${asPersonal ? 'personal' : ''}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const apply = (next: ProBotContact[]) => {
      if (cancelled) return;
      setContacts(next);
      setLoadedKey(requestKey);
    };
    if (isAuthenticated) {
      // Bust stale session cache so inbox order/membership matches the server after chat fixes.
      try {
        sessionStorage.removeItem(CONTACTS_CACHE_KEY_PREFIX + 'auth');
      } catch {
        // ignore
      }
      fetch(asPersonal ? '/api/chat/contacts?as=personal' : '/api/chat/contacts')
        .then((res) => (res.ok ? res.json() : { contacts: [] }))
        .then((data) => {
          const list = (data.contacts ?? []) as ProBotContact[];
          const next = list.length > 0 ? list : FALLBACK_CONTACTS;
          const updated =
            userBusinessId
              ? next.map((c) => (c.businessId === userBusinessId ? { ...c, online: true } : c))
              : next;
          apply(updated);
          if (!cancelled) setCachedContacts(true, updated);
        })
        .catch(() => apply(FALLBACK_CONTACTS));
    } else {
      fetch('/api/businesses?limit=50')
        .then((res) => (res.ok ? res.json() : { businesses: [] }))
        .then((data) => {
          const list = data.businesses ?? [];
          const proContacts: ProBotContact[] = list.map(
            (b: { id: string; businessName?: string; slug?: string; logo?: string; businessLogo?: string }) => ({
              id: b.id,
              name: b.businessName ?? b.id,
              isProBot: false,
              businessId: b.id,
              slug: b.slug,
              logo: b.logo ?? b.businessLogo,
              online: false,
            })
          );
          const next = [PROBOT_CONTACT, ...proContacts];
          apply(next);
          if (!cancelled) setCachedContacts(false, next);
        })
        .catch(() => apply(FALLBACK_CONTACTS));
    }
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userBusinessId, asPersonal, requestKey]);

  const businessIds = useMemo(
    () => contacts.filter((c) => c.businessId).map((c) => c.businessId as string),
    [contacts]
  );

  const customerUserIds = useMemo(
    () =>
      contacts
        .filter((c) => c.id.startsWith('customer-'))
        .map((c) => c.id.slice('customer-'.length)),
    [contacts]
  );

  const contactById = useMemo(() => {
    const map = new Map<string, ProBotContact>();
    contacts.forEach((c) => {
      map.set(c.id, c);
      if (c.slug) map.set(c.slug, c);
      if (c.businessId && c.businessId !== c.id) map.set(c.businessId, c);
    });
    return map;
  }, [contacts]);

  return { contacts, setContacts, businessIds, customerUserIds, contactById, contactsLoaded: loadedKey === requestKey };
}
