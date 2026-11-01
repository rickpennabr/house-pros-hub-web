import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StructuredData from '@/components/seo/StructuredData';
import { getPublicBusiness } from '@/lib/data/businessDirectory';
import { privateRobots } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

function profileTitle(name: string, trade: string, place: string): string {
  if (trade && place) return `${name} | ${trade} in ${place}`;
  if (trade) return `${name} | ${trade}`;
  if (place) return `${name} in ${place}`;
  return name;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) {
    return { title: 'Pro', robots: privateRobots };
  }

  const trade = business.category || business.contractorType || '';
  const place = [business.city, business.state].filter(Boolean).join(', ');
  const title = profileTitle(business.businessName, trade, place);
  const description = (
    business.companyDescription ||
    `${business.businessName} is a ${trade || 'home service pro'}${place ? ` in ${place}` : ''} on House Pros Hub.`
  ).slice(0, 160);
  const image = business.logo || business.businessLogo;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: image ? [{ url: image, alt: business.businessName }] : undefined,
    },
  };
}

/**
 * Puts LocalBusiness JSON-LD in the first HTML response for this pro.
 */
export default async function BusinessProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  let business = null;
  let failed = false;
  try {
    business = await getPublicBusiness(slug);
  } catch {
    failed = true;
  }

  if (!business && !failed) notFound();

  return (
    <>
      {business ? <StructuredData business={business} locale={locale} /> : null}
      {business ? <h1 className="sr-only">{business.businessName}</h1> : null}
      <div className="min-h-screen w-full flex items-center justify-center p-2 md:p-0 bg-white">
        <div className="w-full max-w-[960px] mx-auto flex flex-col min-h-0 border-2 border-black rounded-lg h-[calc(100vh-1rem)] overflow-y-auto overflow-x-hidden md:my-2 bg-white">
          {children}
        </div>
      </div>
    </>
  );
}
