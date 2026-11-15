'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Building2, Calendar, Tag, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import BusinessDetailsHeader from '@/components/businessdetails/BusinessDetailsHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ImageSlides } from '@/components/media/ImageSlides';
import { formatCatalogPrice, type CatalogService } from '@/lib/booking/catalogService';

interface ServiceDetailProps {
  service: CatalogService;
  businessName: string;
  businessSlug: string;
  bookingEnabled: boolean;
  logo?: string;
  contractorType?: string;
  ownerUserId?: string | null;
}

export function ServiceDetail({
  service,
  businessName,
  businessSlug,
  bookingEnabled,
  logo,
  contractorType,
  ownerUserId,
}: ServiceDetailProps) {
  const t = useTranslations('businessServices');
  const locale = useLocale();
  const { user } = useAuth();
  const isOwner = !!user?.id && !!ownerUserId && user.id === ownerUserId;
  const price = formatCatalogPrice(service, locale, {
    requestPrice: t('requestPrice'),
    from: t('from'),
    units: {
      job: t('job'),
      hour: t('hour'),
      sqft: t('sqft'),
      each: t('each'),
    },
  });
  const imageUrls = service.imageUrls?.length
    ? service.imageUrls
    : service.imageUrl
      ? [service.imageUrl]
      : [];
  const images = imageUrls.map((src) => ({ src, alt: service.name }));

  return (
    <div className="flex flex-col">
      <BusinessDetailsHeader
        logo={logo}
        businessName={businessName}
        contractorType={contractorType}
        subtitle={t('detailsTitle')}
        isOwner={isOwner}
      />
      <div className="flex flex-col gap-3 p-2 md:p-4">
      <Breadcrumb
        className="mb-0 pb-0"
        items={[
          { label: businessName, href: `/business/${businessSlug}`, icon: Building2 },
          { label: t('tab'), href: `/business/${businessSlug}?tab=services`, icon: Wrench },
          { label: service.name },
        ]}
      />

      <div className="overflow-hidden rounded-lg border-2 border-black bg-white">
        <div className="flex flex-col md:flex-row md:items-start">
          <div className="w-full bg-neutral-100 p-2 md:w-1/2 md:p-3">
            {images.length > 0 ? (
              <ImageSlides images={images} label={service.name} />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-lg border-2 border-black bg-white text-neutral-400">
                <Tag className="h-16 w-16" aria-hidden />
                <span className="sr-only">{t('noPhoto')}</span>
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-3 p-3 md:w-1/2 md:p-5">
            {service.category ? <p className="text-sm font-medium text-gray-500">{service.category}</p> : null}
            <h2 className="text-xl font-bold leading-tight text-black md:text-2xl">{service.name}</h2>
            <p className="text-lg font-semibold text-black">{price}</p>
            <p className="text-sm text-gray-600">{businessName}</p>
            {service.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{service.description}</p>
            ) : (
              <p className="text-sm text-gray-500">{t('noDescription')}</p>
            )}
            {service.isActive && bookingEnabled ? (
              <Link
                href={`/${locale}/book/${businessSlug}?service=${service.id}`}
                className="inline-flex h-11 w-fit items-center gap-2 rounded-lg border-2 border-black bg-black px-4 text-sm font-semibold text-white"
              >
                <Calendar className="h-4 w-4" />
                {t('makeAppointment')}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
