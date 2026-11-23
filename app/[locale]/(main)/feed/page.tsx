import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import FeedClient from '@/components/feed/FeedClient';
import { getFeedViewer, loadFeedPage } from '@/lib/feed/server';
import { resolveLocale } from '@/lib/seo/metadata';
import type { FeedPage } from '@/lib/feed/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: resolveLocale(locale), namespace: 'feed' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function FeedRoutePage() {
  let initialPage: FeedPage = { items: [], nextCursor: null, isAdmin: false };
  let localCity = 'Las Vegas';
  try {
    const viewer = await getFeedViewer();
    if (viewer.city) localCity = viewer.city;
    initialPage = await loadFeedPage({ viewer, scope: 'local', filter: 'all' });
  } catch (err) {
    // The client loads again on the first scope or filter change; an empty first paint is fine.
    console.error('Feed page first load', err);
  }
  return <FeedClient initialPage={initialPage} localCity={localCity} />;
}
