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
}

export function useProBotContacts({ isAuthenticated, userBusinessId }: UseProBotContactsArgs) {
  const [contacts, setContacts] = useState<ProBotContact[]>(() => {
    const cached = getCachedContacts(isAuthenticated);
    return cached ?? FALLBACK_CONTACTS;
  });

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/chat/contacts')
        .then((res) => (res.ok ? res.json() : { contacts: [] }))
        .then((data) => {
          const list = (data.contacts ?? []) as ProBotContact[];
          const next = list.length > 0 ? list : FALLBACK_CONTACTS;
          const updated =
            userBusinessId
              ? next.map((c) => (c.businessId === userBusinessId ? { ...c, online: true } : c))
              : next;
          setContacts(updated);
          setCachedContacts(true, updated);
        })
        .catch(() => setContacts(FALLBACK_CONTACTS));
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
          setContacts(next);
          setCachedContacts(false, next);
        })
        .catch(() => setContacts(FALLBACK_CONTACTS));
    }
  }, [isAuthenticated, userBusinessId]);

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

  return { contacts, setContacts, businessIds, customerUserIds, contactById };
}
