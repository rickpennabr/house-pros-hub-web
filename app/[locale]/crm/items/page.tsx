import { redirect } from 'next/navigation';

export default async function CRMItemsRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/crm/services`);
}
