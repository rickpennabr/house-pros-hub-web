'use client';

import { useEffect, useState } from 'react';
import { subscribeUploads, type UploadState } from '@/lib/upload/uploadWithProgress';

/** One bar with a percentage (used inline, or by the global host). */
export function UploadProgressBar({ percent, label }: { percent: number; label?: string }) {
  return (
    <div className="w-full" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label ? `Uploading ${label}` : 'Uploading'}>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs font-medium">
        <span className="truncate">{label ? `Uploading ${label}` : 'Uploading'}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-red-600 transition-[width] duration-200" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Mounted once in the layout: shows every upload in progress, anywhere in the Hub. */
export function UploadProgressHost() {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  useEffect(() => subscribeUploads(setUploads), []);
  if (uploads.length === 0) return null;
  return (
    <div className="fixed left-1/2 top-3 z-[200] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 space-y-2 rounded-lg border-2 border-black bg-white p-3 text-black shadow-lg" aria-live="polite">
      {uploads.map((upload) => (
        <UploadProgressBar key={upload.id} percent={upload.percent} label={upload.label} />
      ))}
    </div>
  );
}
