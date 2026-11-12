import { Suspense } from 'react';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import LoadingOverlay from '@/components/ui/LoadingOverlay';
import { getMessages } from 'next-intl/server';
import Script from 'next/script';
import { locales } from '@/i18n';
import type { Locale } from '@/i18n';
import AuthProviderWrapper from '@/components/providers/AuthProviderWrapper';
import { GlobalHashHandler } from '@/components/auth/GlobalHashHandler';
import { RecoveryHashRedirect } from '@/components/auth/RecoveryHashRedirect';
import ContractorPresenceHeartbeat from '@/components/presence/ContractorPresenceHeartbeat';
import UserPresenceHeartbeat from '@/components/presence/UserPresenceHeartbeat';
import ServiceWorkerRegister from '@/components/notifications/ServiceWorkerRegister';
import { ProBotTransitionProvider } from '@/contexts/ProBotTransitionContext';
import { QuickRepairCameraHost } from '@/components/media/QuickRepairCameraModal';
import {
  alternatesFor,
  isPrivatePath,
  pathWithoutLocale,
  privateRobots,
  publicRobots,
  resolveLocale,
} from '@/lib/seo/metadata';

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
  const headerList = await headers();
  const pathname = headerList.get('x-hph-pathname') || `/${locale}`;
  const search = headerList.get('x-hph-search') || '';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://houseproshub.com';
  const meta = localeMetadata[locale as keyof typeof localeMetadata] ?? localeMetadata.en;
  const resolvedLocale = resolveLocale(locale);
  const barePath = pathWithoutLocale(pathname);
  const privatePage = isPrivatePath(barePath === '' ? '/businesslist' : barePath);
  const alternates = alternatesFor(resolvedLocale, pathname, search);

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
      icon: [
        { url: '/fav.ico' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    },
    manifest: '/manifest.json',
    appleWebApp: {
      capable: true,
      title: 'HouseProsHub',
      statusBarStyle: 'black-translucent',
    },
    openGraph: {
      type: 'website',
      locale: meta.openGraphLocale,
      url: alternates?.canonical || '/',
      siteName: 'House Pros Hub',
      title: meta.title,
      description: meta.descriptionShort,
      images: [
        {
          url: '/house-pros-hub-logo-simble-bot.png',
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
    alternates,
    robots: privatePage ? privateRobots : publicRobots,
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
  
  const meta = localeMetadata[resolvedLocale];
  const organizationStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'House Pros Hub',
    description: meta.description,
    url: baseUrl,
    logo: `${baseUrl}/house-pros-hub-logo-simble-bot.png`,
    areaServed: {
      '@type': 'State',
      name: 'Nevada',
      containedInPlace: {
        '@type': 'Country',
        name: 'United States',
      },
    },
  };

  return (
    <>
      <RecoveryHashRedirect />
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
            <QuickRepairCameraHost />
            <Suspense fallback={<LoadingOverlay />}>
              {children}
            </Suspense>
          </ProBotTransitionProvider>
        </AuthProviderWrapper>
      </NextIntlClientProvider>
    </>
  );
}
