'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ProBotContact, ProBotRecentConversation } from '@/components/probot/ProBotSidebar';

const PROBOT_CONTACT: ProBotContact = {
  id: 'probot',
  name: 'ProBot',
  isProBot: true,
};

const FALLBACK_CONTACTS: ProBotContact[] = [
  PROBOT_CONTACT,
  { id: 'santos-general-services', name: 'Santos General Services', isProBot: false },
];

interface UseProBotContactsArgs {
  isAuthenticated: boolean;
  userBusinessId?: string;
}

export function useProBotContacts({ isAuthenticated, userBusinessId }: UseProBotContactsArgs) {
  const [contacts, setContacts] = useState<ProBotContact[]>(FALLBACK_CONTACTS);

  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/chat/contacts')
        .then((res) => (res.ok ? res.json() : { contacts: [] }))
        .then((data) => {
          const list = (data.contacts ?? []) as ProBotContact[];
          const next = list.length > 0 ? list : FALLBACK_CONTACTS;
          setContacts(
            userBusinessId
              ? next.map((c) => (c.businessId === userBusinessId ? { ...c, online: true } : c))
              : next
          );
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
          setContacts([PROBOT_CONTACT, ...proContacts]);
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
    contacts.forEach((c) => map.set(c.id, c));
    return map;
  }, [contacts]);

  return { contacts, setContacts, businessIds, customerUserIds, contactById };
}
