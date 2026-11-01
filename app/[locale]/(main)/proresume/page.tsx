import { Suspense } from 'react';
import ProResumeClient from './ProResumeClient';

export default function ProResumePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<div className="min-h-0 flex-1" />}>
        <ProResumeClient />
      </Suspense>
    </div>
  );
}
