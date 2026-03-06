import { redirect } from 'next/navigation';

interface CRMPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CRMPage({ params }: CRMPageProps) {
  const { locale } = await params;
  redirect(`/${locale}/crm/customers`);
}
