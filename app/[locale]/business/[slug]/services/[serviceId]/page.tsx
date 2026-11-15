import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ServiceDetail } from '@/components/businessdetails/ServiceDetail';
import { listCatalogServices } from '@/lib/booking/catalogAccess';
import { loadBusinessBookingWindow } from '@/lib/booking/loadBookingWindow';
import { getPublicBusiness } from '@/lib/data/businessDirectory';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; serviceId: string }>;
}): Promise<Metadata> {
  const { slug, serviceId } = await params;
  const business = await getPublicBusiness(slug);
  if (!business) return { title: 'Service' };
  const { services } = await listCatalogServices(business.id, false);
  const service = services.find((item) => item.id === serviceId);
  if (!service) return { title: business.businessName };
  return {
    title: `${service.name} | ${business.businessName}`,
    description: service.description || undefined,
  };
}

export default async function BusinessServicePage({
  params,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
}) {
  const { slug, serviceId } = await params;
  const business = await getPublicBusiness(slug);
  if (!business?.slug) notFound();

  const serviceClient = createServiceRoleClient();
  const [{ services }, booking, owner] = await Promise.all([
    listCatalogServices(business.id, false),
    loadBusinessBookingWindow(serviceClient, business.id),
    serviceClient.from('businesses').select('owner_id').eq('id', business.id).maybeSingle(),
  ]);
  const service = services.find((item) => item.id === serviceId);
  if (!service) notFound();

  return (
    <ServiceDetail
      service={service}
      businessName={business.businessName}
      businessSlug={business.slug}
      bookingEnabled={booking?.bookingEnabled === true}
      logo={business.logo || business.businessLogo}
      contractorType={business.contractorType}
      ownerUserId={owner.data?.owner_id ?? null}
    />
  );
}
