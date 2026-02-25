'use client';

import { useEffect } from 'react';
import { captureException } from '@/lib/monitoring/sentry';

/**
 * Root-level error boundary. Replaces the root layout when triggered.
 * Must define its own html/body per Next.js App Router.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, {
      context: 'global-error-boundary',
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased">
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '28rem',
              width: '100%',
              textAlign: 'center',
              padding: '1.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '0.5rem',
              backgroundColor: '#fff',
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#1e293b',
                marginBottom: '0.5rem',
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                fontSize: '0.875rem',
                color: '#64748b',
                marginBottom: '1.5rem',
              }}
            >
              A critical error occurred. Please try again or refresh the page.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#fff',
                  backgroundColor: '#334155',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <a
                href="/"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                }}
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
