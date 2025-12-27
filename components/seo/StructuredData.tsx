'use client';

import { useEffect, useMemo } from 'react';
import { ProCardData } from '@/components/proscard/ProCard';

interface StructuredDataProps {
  business: ProCardData;
}

/**
 * JSON-LD Structured Data component for LocalBusiness schema
 * Helps search engines understand and display business information in rich results
 */
export default function StructuredData({ business }: StructuredDataProps) {
  // Use environment variable for consistent SSR/client rendering
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://houseproshub.com';
  const businessUrl = `${baseUrl}/business/${business.slug || business.id}`;

  // Build address object if available
  const address = business.streetAddress || business.address ? {
    '@type': 'PostalAddress',
    streetAddress: business.streetAddress || business.address || '',
    addressLocality: business.city || '',
    addressRegion: business.state || '',
    postalCode: business.zipCode || '',
    addressCountry: 'US',
  } : undefined;

  // Extract contact information
  const phoneLink = business.links.find(l => l.type === 'phone');
  const emailLink = business.links.find(l => l.type === 'email');
  const websiteLink = business.links.find(l => l.type === 'website');

  // Build structured data (memoized to prevent unnecessary re-renders)
  const structuredData = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.businessName,
    description: business.companyDescription || `Professional ${business.contractorType} services`,
    url: businessUrl,
    image: business.logo || business.businessLogo || business.businessBackground,
    ...(address && { address }),
    ...(phoneLink?.value && {
      telephone: phoneLink.value,
    }),
    ...(emailLink?.value && {
      email: emailLink.value,
    }),
    ...(websiteLink?.url && {
      sameAs: websiteLink.url,
    }),
    ...(business.city && business.state && {
      areaServed: {
        '@type': 'City',
        name: `${business.city}, ${business.state}`,
      },
    }),
    // Add service type
    serviceType: business.contractorType,
    ...(business.category && {
      additionalType: `https://schema.org/${business.category}`,
    }),
  }), [
    business.businessName,
    business.companyDescription,
    business.contractorType,
    businessUrl,
    address,
    phoneLink?.value,
    emailLink?.value,
    websiteLink?.url,
    business.city,
    business.state,
    business.category,
    business.logo,
    business.businessLogo,
    business.businessBackground,
  ]);

  // Inject JSON-LD structured data for SEO
  useEffect(() => {
    const scriptId = `business-structured-data-${business.slug || business.id}`;
    // Remove existing script if it exists
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    // Create and inject new script
    const script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData, null, 0);
    document.head.appendChild(script);

    // Cleanup function
    return () => {
      const scriptToRemove = document.getElementById(scriptId);
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [structuredData, business.slug, business.id]);

  return null;
}
