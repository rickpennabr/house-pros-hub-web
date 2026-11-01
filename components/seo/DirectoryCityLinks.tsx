import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { directoryPath } from '@/lib/data/directoryParams';

interface DirectoryCityLinksProps {
  locale: string;
  cities: string[];
  category: string;
}

/** Crawlable city listings. The chips above handle trades. */
export async function DirectoryCityLinks({ locale, cities, category }: DirectoryCityLinksProps) {
  if (cities.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'businessList' });
  const shown = cities.slice(0, 40);

  return (
    <nav aria-label={t('seoCitiesLabel')} className="mt-4 border-t-2 border-black px-2 py-3">
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {shown.map((city) => (
          <li key={city}>
            <Link href={`/${locale}${directoryPath(category, city)}`} className="text-sm text-black underline">
              {category ? t('seoCategoryCityLink', { category, city }) : t('seoCityLink', { city })}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
