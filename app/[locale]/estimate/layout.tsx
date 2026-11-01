import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import EstimateShell from '@/components/estimate/EstimateShell';
import { resolveLocale } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: resolveLocale(locale), namespace: 'estimate.page' });
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default function EstimateLayout({ children }: { children: React.ReactNode }) {
  return <EstimateShell>{children}</EstimateShell>;
}
