/**
 * Sentry server-side configuration
 * This file is used by Sentry SDK for server-side error tracking
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  debug: process.env.NODE_ENV === 'development',
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

