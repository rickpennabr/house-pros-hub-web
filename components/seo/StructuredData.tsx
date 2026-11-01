import { buildBusinessJsonLd } from '@/lib/seo/businessJsonLd';
import type { ProCardData } from '@/components/proscard/ProCard';

interface StructuredDataProps {
  business: ProCardData;
  locale: string;
}

/** Server-rendered LocalBusiness JSON-LD, including the free-estimate offer. */
export default function StructuredData({ business, locale }: StructuredDataProps) {
  const json = JSON.stringify(buildBusinessJsonLd(business, locale)).replace(/</g, '\\u003c');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
