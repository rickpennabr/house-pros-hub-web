'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { captureException } from '@/lib/monitoring/sentry';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BusinessError({ error, reset }: ErrorProps) {
  const pathname = usePathname();

  useEffect(() => {
    captureException(error, {
      context: 'business-error-boundary',
      pathname: pathname ?? undefined,
      digest: error.digest,
    });
  }, [error, pathname]);

  const locale = pathname?.split('/')[1] ?? 'en';

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          We couldn’t load this business page. Please try again or return home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Try again
          </button>
          <Link
            href={`/${locale}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
