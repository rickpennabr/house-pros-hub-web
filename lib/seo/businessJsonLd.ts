import type { ProCardData } from '@/components/proscard/ProCard';
import { siteOrigin } from '@/lib/agent/constants';

interface LicenseLike {
  license: string;
  licenseNumber?: string;
  tradeName?: string;
  trade?: string;
}

/**
 * LocalBusiness JSON-LD for a pro profile.
 * The estimate offer is a request, not a quoted price.
 */
export function buildBusinessJsonLd(business: ProCardData, locale: string, origin = siteOrigin()) {
  const slug = business.slug || business.id;
  const profileUrl = `${origin}/${locale}/business/${slug}`;
  const phone = business.phone || business.mobilePhone;
  const licenses = ((business.licenses ?? []) as LicenseLike[])
    .filter((license) => license.licenseNumber?.trim())
    .map((license) => ({
      '@type': 'PropertyValue',
      propertyID: 'license',
      name: license.tradeName || license.trade || license.license,
      value: license.licenseNumber,
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'HomeAndConstructionBusiness',
    name: business.businessName,
    description: business.companyDescription || `${business.contractorType} listed on House Pros Hub`,
    url: profileUrl,
    image: business.logo || business.businessLogo || business.businessBackground,
    ...(business.streetAddress || business.city
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: business.streetAddress || business.address || '',
            addressLocality: business.city || '',
            addressRegion: business.state || '',
            postalCode: business.zipCode || '',
            addressCountry: 'US',
          },
        }
      : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(business.email ? { email: business.email } : {}),
    ...(business.city
      ? {
          areaServed: {
            '@type': 'City',
            name: business.state ? `${business.city}, ${business.state}` : business.city,
          },
        }
      : {}),
    ...(business.category || business.contractorType
      ? { serviceType: business.category || business.contractorType }
      : {}),
    ...(licenses.length > 0 ? { identifier: licenses } : {}),
    makesOffer: {
      '@type': 'Offer',
      name: 'Free project estimate',
      url: `${origin}/${locale}/estimate`,
      description:
        'Request a free estimate through House Pros Hub. A pro prices the job. This offer is not a quoted price.',
    },
  };
}
