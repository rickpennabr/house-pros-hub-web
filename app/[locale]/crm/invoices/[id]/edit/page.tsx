import { redirect } from 'next/navigation';

/** Invoices are edited on the invoice page itself (its "Edit invoice" tab). Old links land there. */
export default async function CRMEditInvoicePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  redirect(`/${locale}/crm/invoices/${id}`);
}
