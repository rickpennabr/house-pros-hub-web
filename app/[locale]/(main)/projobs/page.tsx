import { Suspense } from 'react';
import ProJobsClient from './ProJobsClient';

export default function ProJobsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<div className="min-h-0 flex-1" />}>
        <ProJobsClient />
      </Suspense>
    </div>
  );
}
