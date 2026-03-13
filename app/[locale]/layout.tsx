import { Suspense } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { getMessages } from 'next-intl/server';
import Script from 'next/script';
import { locales } from '@/i18n';
import type { Locale } from '@/i18n';
import AuthProviderWrapper from '@/components/providers/AuthProviderWrapper';
import { GlobalHashHandler } from '@/components/auth/GlobalHashHandler';
import ContractorPresenceHeartbeat from '@/components/presence/ContractorPresenceHeartbeat';
import UserPresenceHeartbeat from '@/components/presence/UserPresenceHeartbeat';
import ServiceWorkerRegister from '@/components/notifications/ServiceWorkerRegister';
import { ProBotTransitionProvider } from '@/contexts/ProBotTransitionContext';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const localeMetadata = {
  en: {
    title: 'House Pros Hub | Trusted Local Contractors & Home Improvement',
    description: 'Connect with dedicated trade owners who collaborate to bring your home improvement dreams to life. Personal attention, collective expertise, built to last.',
    descriptionShort: 'Connect with dedicated trade owners who collaborate to bring your home improvement dreams to life.',
    keywords: [
      'local contractors',
      'home improvement',
      'contractors near me',
      'home repair',
      'home renovation',
      'trusted contractors',
      'local service providers',
      'house improvement',
      'contractor network',
      'home building',
      'Nevada contractors',
      'home remodeling',
    ],
    openGraphLocale: 'en_US' as const,
    alt: 'House Pros Hub - Connecting homeowners with trusted local contractors',
  },
  es: {
    title: 'House Pros Hub | Contratistas Locales Confiables y Mejoras para el Hogar',
    description: 'Conéctate con propietarios de oficios dedicados que colaboran para hacer realidad tus sueños de mejoras para el hogar. Atención personal, experiencia colectiva, construido para durar.',
    descriptionShort: 'Conéctate con propietarios de oficios dedicados que colaboran para hacer realidad tus sueños de mejoras para el hogar.',
    keywords: [
      'contratistas locales',
      'mejoras para el hogar',
      'contratistas cerca de mí',
      'reparación del hogar',
      'renovación del hogar',
      'contratistas confiables',
      'proveedores de servicios locales',
      'mejoras para la casa',
      'red de contratistas',
      'construcción de hogares',
      'contratistas de Nevada',
      'remodelación del hogar',
    ],
    openGraphLocale: 'es_US' as const,
    alt: 'House Pros Hub - Conectando propietarios con contratistas locales confiables',
  },
  pt: {
    title: 'House Pros Hub | Contratistas Locais de Confiança e Melhorias para o Lar',
    description: 'Conecte-se com profissionais dedicados que colaboram para realizar seus sonhos de melhorias para o lar. Atenção personalizada, experiência coletiva, feito para durar.',
    descriptionShort: 'Conecte-se com profissionais dedicados que colaboram para realizar seus sonhos de melhorias para o lar.',
    keywords: [
      'contratistas locais',
      'melhorias para o lar',
      'contratistas perto de mim',
      'reparo residencial',
      'reforma residencial',
      'contratistas confiáveis',
      'prestadores de serviços locais',
      'melhorias para casa',
      'rede de contratistas',
      'construção residencial',
      'contratistas de Nevada',
      'remodelação do lar',
    ],
    openGraphLocale: 'pt_BR' as const,
    alt: 'House Pros Hub - Conectando proprietários com contratistas locais confiáveis',
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://houseproshub.com';
  const meta = localeMetadata[locale as keyof typeof localeMetadata] ?? localeMetadata.en;

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: meta.title,
      template: '%s | House Pros Hub',
    },
    description: meta.description,
    keywords: meta.keywords,
    authors: [{ name: 'House Pros Hub' }],
    creator: 'House Pros Hub',
    publisher: 'House Pros Hub',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    icons: {
      icon: '/fav.ico',
      apple: '/house-pros-hub-logo-simble-bot.png',
    },
    manifest: '/manifest.json',
    appleWebApp: {
      title: 'HouseProsHub',
    },
    openGraph: {
      type: 'website',
      locale: meta.openGraphLocale,
      url: '/',
      siteName: 'House Pros Hub',
      title: meta.title,
      description: meta.descriptionShort,
      images: [
        {
          url: '/house-pros-hub-logo-simble-bot.png',
          width: 1200,
          height: 630,
          alt: meta.alt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.descriptionShort,
      images: ['/house-pros-hub-logo-simble-bot.png'],
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
    logo: `${baseUrl}/house-pros-hub-logo-simble-bot.png`,
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
  };

  return (
    <>
      {/* Redirect to reset-password with hash when recovery tokens land on another page (before React loads) */}
      <Script
        id="hash-fragment-recovery-redirect"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  if (typeof window === 'undefined') return;
  var pathname = window.location.pathname || '';
  if (pathname.indexOf('reset-password') !== -1) return;
  var hash = window.location.hash || '';
  if (hash.length < 10) return;
  try {
    var p = new URLSearchParams(hash.substring(1));
    if (p.get('access_token') && p.get('refresh_token') && p.get('type') === 'recovery') {
      var seg = pathname.split('/')[1];
      var locale = (seg === 'es' || seg === 'en' || seg === 'pt') ? seg : 'en';
      window.location.replace('/' + locale + '/reset-password' + hash);
    }
  } catch (e) {}
})();
          `.trim(),
        }}
      />
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
          <ProBotTransitionProvider>
            <ServiceWorkerRegister />
            <UserPresenceHeartbeat />
            <ContractorPresenceHeartbeat />
            <GlobalHashHandler />
            <Suspense fallback={<LoadingOverlay />}>
              {children}
            </Suspense>
          </ProBotTransitionProvider>
        </AuthProviderWrapper>
      </NextIntlClientProvider>
    </>
  );
}
