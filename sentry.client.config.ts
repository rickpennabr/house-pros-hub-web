/**
 * Sentry client-side configuration
 * This file is used by Sentry SDK for browser-side error tracking
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: process.env.NODE_ENV === 'development',
  enabled: process.env.NODE_ENV === 'production' || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend(event, hint) {
    // Filter out sensitive data
    if (event.request) {
      if (event.request.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-csrf-token'];
        if (event.request?.headers) {
          const headers = event.request.headers;
          sensitiveHeaders.forEach((header) => {
            if (header in headers) {
              headers[header] = '[REDACTED]';
            }
          });
        }
      }
    }
    return event;
  },
});

