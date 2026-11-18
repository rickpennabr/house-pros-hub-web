'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicEstimateView } from '@/components/estimates/PublicEstimateView';

function PublicEstimateViewContent() {
  const searchParams = useSearchParams();
  return (
    <PublicEstimateView token={searchParams.get('token')} presentMode={searchParams.get('present') === '1'} />
  );
}

export default function PublicEstimateViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-8 text-gray-500">Loading...</div>}>
      <PublicEstimateViewContent />
    </Suspense>
  );
}
