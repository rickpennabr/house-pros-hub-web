'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicInvoiceView } from '@/components/invoices/PublicInvoiceView';

function InvoiceViewContent() {
  const searchParams = useSearchParams();
  return (
    <PublicInvoiceView
      token={searchParams.get('token')}
      presentMode={searchParams.get('present') === '1'}
      paidReturn={searchParams.get('paid') === '1'}
    />
  );
}

export default function PublicInvoiceViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-8 text-gray-500">Loading…</div>}>
      <InvoiceViewContent />
    </Suspense>
  );
}
