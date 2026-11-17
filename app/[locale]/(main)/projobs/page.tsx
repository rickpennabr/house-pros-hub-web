import { Suspense } from 'react';
import { listPublishedJobs } from '@/lib/data/proJobs-server';
import ProJobsClient from './ProJobsClient';

export default async function ProJobsPage() {
  const initialJobs = await listPublishedJobs();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<div className="min-h-0 flex-1" />}>
        <ProJobsClient initialJobs={initialJobs} />
      </Suspense>
    </div>
  );
}
