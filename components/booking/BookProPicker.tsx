'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import ProCard, { type ProCardData } from '@/components/proscard/ProCard';
import { matchesSearchQuery } from '@/lib/utils/businessSearch';

interface BookProPickerProps {
  open: boolean;
  onClose: () => void;
}

interface DirectoryPage {
  businesses?: ProCardData[];
  pagination?: { hasMore?: boolean };
  error?: string;
}

const PAGE_SIZE = 50;

async function loadAllPros(): Promise<ProCardData[]> {
  const all: ProCardData[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`/api/businesses?limit=${PAGE_SIZE}&offset=${offset}`);
    const data = (await res.json().catch(() => ({}))) as DirectoryPage;
    if (!res.ok) throw new Error(data.error || 'load');
    const page = data.businesses ?? [];
    all.push(...page);
    if (!data.pagination?.hasMore || page.length === 0) return all;
    offset += page.length;
  }
}

export function BookProPicker({ open, onClose }: BookProPickerProps) {
  const t = useTranslations('appointments');
  const locale = useLocale();
  const [pros, setPros] = useState<ProCardData[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadAllPros()
      .then((list) => {
        if (!cancelled) setPros(list);
      })
      .catch(() => {
        if (!cancelled) setError(t('loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  const visible = useMemo(
    () => pros.filter((pro) => matchesSearchQuery(pro, query.trim())),
    [pros, query]
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t('pickPro')}
      showHeader
      maxWidth="md"
      className="md:!w-[500px] md:!max-w-[500px] !overflow-hidden"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <div className="border-b-2 border-black p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPros')}
            aria-label={t('searchPros')}
            className="h-10 w-full rounded-lg border-2 border-black bg-white pl-9 pr-3 text-sm text-black placeholder:text-gray-500 focus:outline-none"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? <p className="p-2 text-sm text-gray-600">{t('loadingPros')}</p> : null}
        {error ? <p className="p-2 text-sm text-red-700">{error}</p> : null}
        {!loading && !error && pros.length === 0 ? <p className="p-2 text-sm text-gray-700">{t('noPros')}</p> : null}
        {!loading && !error && pros.length > 0 && visible.length === 0 ? (
          <p className="p-2 text-sm text-gray-700">{t('noSearchResults')}</p>
        ) : null}
        {!loading && !error && visible.length > 0 ? (
          <p className="px-1 pb-2 text-sm text-gray-600">{t('pickProHint')}</p>
        ) : null}
        <div className="grid grid-cols-1 gap-3">
          {visible.map((pro) => (
            <ProCard
              key={pro.id}
              data={pro}
              href={`/${locale}/book/${pro.slug || pro.id}`}
              pickOnly
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
