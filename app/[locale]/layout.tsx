import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import Script from 'next/script';
import { locales } from '@/i18n';
import type { Locale } from '@/i18n';
import AuthProviderWrapper from '@/components/providers/AuthProviderWrapper';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://houseproshub.com';
  
  const isSpanish = locale === 'es';
  
  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: isSpanish 
        ? "House Pros Hub | Contratistas Locales Confiables y Mejoras para el Hogar"
        : "House Pros Hub | Trusted Local Contractors & Home Improvement",
      template: "%s | House Pros Hub"
    },
    description: isSpanish
      ? "Conéctate con propietarios de oficios dedicados que colaboran para hacer realidad tus sueños de mejoras para el hogar. Atención personal, experiencia colectiva, construido para durar."
      : "Connect with dedicated trade owners who collaborate to bring your home improvement dreams to life. Personal attention, collective expertise, built to last.",
    keywords: isSpanish
      ? [
          "contratistas locales",
          "mejoras para el hogar",
          "contratistas cerca de mí",
          "reparación del hogar",
          "renovación del hogar",
          "contratistas confiables",
          "proveedores de servicios locales",
          "mejoras para la casa",
          "red de contratistas",
          "construcción de hogares",
          "contratistas de Nevada",
          "remodelación del hogar"
        ]
      : [
          "local contractors",
          "home improvement",
          "contractors near me",
          "home repair",
          "home renovation",
          "trusted contractors",
          "local service providers",
          "house improvement",
          "contractor network",
          "home building",
          "Nevada contractors",
          "home remodeling"
        ],
    authors: [{ name: "House Pros Hub" }],
    creator: "House Pros Hub",
    publisher: "House Pros Hub",
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    icons: {
      icon: '/fav.ico',
      apple: '/hph-logo-simble-sq-white-bg-2.2.png',
    },
    manifest: '/manifest.json',
    openGraph: {
      type: 'website',
      locale: isSpanish ? 'es_US' : 'en_US',
      url: '/',
      siteName: 'House Pros Hub',
      title: isSpanish
        ? 'House Pros Hub | Contratistas Locales Confiables y Mejoras para el Hogar'
        : 'House Pros Hub | Trusted Local Contractors & Home Improvement',
      description: isSpanish
        ? 'Conéctate con propietarios de oficios dedicados que colaboran para hacer realidad tus sueños de mejoras para el hogar.'
        : 'Connect with dedicated trade owners who collaborate to bring your home improvement dreams to life.',
      images: [
        {
          url: '/hph-logo-2.3.png',
          width: 1200,
          height: 630,
          alt: isSpanish
            ? 'House Pros Hub - Conectando propietarios con contratistas locales confiables'
            : 'House Pros Hub - Connecting homeowners with trusted local contractors',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: isSpanish
        ? 'House Pros Hub | Contratistas Locales Confiables y Mejoras para el Hogar'
        : 'House Pros Hub | Trusted Local Contractors & Home Improvement',
      description: isSpanish
        ? 'Conéctate con propietarios de oficios dedicados que colaboran para hacer realidad tus sueños de mejoras para el hogar.'
        : 'Connect with dedicated trade owners who collaborate to bring your home improvement dreams to life.',
      images: ['/hph-logo-2.3.png'],
      creator: '@houseproshub',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const resolvedLocale: Locale = locales.includes(locale as Locale) ? (locale as Locale) : 'en';

  // Pass `locale` explicitly to avoid relying on request-locale inference.
  // This makes routing more robust across Next.js runtime changes.
  const messages = await getMessages({ locale: resolvedLocale });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://houseproshub.com';
  
  const organizationStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'House Pros Hub',
    description: 'Connect with dedicated trade owners who collaborate to bring your home improvement dreams to life. Personal attention, collective expertise, built to last.',
    url: baseUrl,
    logo: `${baseUrl}/hph-logo-2.3.png`,
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
  };

  return (
    <>
      {/* Organization Structured Data for SEO */}
      <Script
        id="organization-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationStructuredData),
        }}
      />
      <NextIntlClientProvider locale={resolvedLocale} messages={messages}>
        <AuthProviderWrapper>
          {children}
        </AuthProviderWrapper>
      </NextIntlClientProvider>
    </>
  );
}
