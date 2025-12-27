'use client';

import { useEffect, useMemo } from 'react';

/**
 * JSON-LD Structured Data component for Organization schema
 * Helps search engines understand your business and display information in Knowledge Graph
 */
export default function OrganizationStructuredData() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://houseproshub.com';

  const structuredData = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'House Pros Hub',
    description: 'Connect with dedicated trade owners who collaborate to bring your home improvement dreams to life. Personal attention, collective expertise, built to last.',
    url: baseUrl,
    logo: `${baseUrl}/hph-logo-2.3.png`,
    sameAs: [
      // Add your social media profiles here when available
      // 'https://www.facebook.com/houseproshub',
      // 'https://www.instagram.com/houseproshub',
      // 'https://www.twitter.com/houseproshub',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      // Add your contact information when available
      // email: 'support@houseproshub.com',
      // telephone: '+1-XXX-XXX-XXXX',
    },
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
  }), [baseUrl]);

  // Inject JSON-LD structured data for SEO
  useEffect(() => {
    const scriptId = 'organization-structured-data-component';
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
  }, [structuredData]);

  return null;
}
