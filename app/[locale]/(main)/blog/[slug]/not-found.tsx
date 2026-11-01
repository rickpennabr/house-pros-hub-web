import { getLocale, getTranslations } from 'next-intl/server';
import BusinessDetailsHeader from '@/components/businessdetails/BusinessDetailsHeader';

export default async function BlogArticleNotFound() {
  const locale = await getLocale();
  const t = await getTranslations('blog');

  return (
    <>
      <BusinessDetailsHeader
        businessName={t('notFoundTitle')}
        backHref={`/${locale}/blog`}
        shareTitle={t('share')}
      />
      <div className="px-3 py-6 md:px-4">
        <p className="text-sm text-gray-700">{t('notFoundBody')}</p>
      </div>
    </>
  );
}
