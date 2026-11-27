'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Loader2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import type { ProBotContact } from '@/components/probot/ProBotSidebar';

interface ForwardMessageModalProps {
  isOpen: boolean;
  contacts: ProBotContact[];
  /** The chat the message is already in. */
  currentContactId?: string;
  onClose: () => void;
  onForward: (contactIds: string[]) => Promise<void>;
}

/** Pick one or more chats and copy the message there. */
export function ForwardMessageModal({ isOpen, contacts, currentContactId, onClose, onForward }: ForwardMessageModalProps) {
  const t = useTranslations('probot');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const choices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((contact) => !contact.isProBot && contact.id !== currentContactId)
      .filter((contact) => !q || contact.name.toLowerCase().includes(q))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || a.name.localeCompare(b.name));
  }, [contacts, currentContactId, query]);

  const close = () => {
    if (sending) return;
    setQuery('');
    setPicked(new Set());
    onClose();
  };

  const toggle = (id: string) => {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 5) next.add(id);
      return next;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={t('forwardTo')} showHeader maxWidth="md" contentClassName="p-3">
      <TypingSearchInput
        value={query}
        onChange={setQuery}
        placeholder={t('forwardSearch')}
        clearLabel={t('forwardSearch')}
        className="relative mb-2"
      />
      {choices.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-gray-500">{t('forwardEmpty')}</p>
      ) : (
        <ul className="max-h-[50vh] overflow-y-auto">
          {choices.map((contact) => {
            const on = picked.has(contact.id);
            return (
              <li key={contact.id}>
                <button
                  type="button"
                  onClick={() => toggle(contact.id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-100"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-black ${on ? 'bg-black text-white' : 'bg-white'}`}
                    aria-hidden
                  >
                    {on ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900">{contact.name}</span>
                    {contact.self ? <span className="block truncate text-xs text-gray-500">{t('selfContactHint')}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        disabled={picked.size === 0 || sending}
        onClick={() => {
          setSending(true);
          void onForward([...picked])
            .then(() => {
              setQuery('');
              setPicked(new Set());
              onClose();
            })
            .catch(() => {})
            .finally(() => setSending(false));
        }}
        className="mt-3 flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-black text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {picked.size > 1 ? `${t('forwardSend')} (${picked.size})` : t('forwardSend')}
      </button>
    </Modal>
  );
}
