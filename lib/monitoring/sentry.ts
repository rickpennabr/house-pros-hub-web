/**
 * Sentry configuration and initialization
 * 
 * To use Sentry:
 * 1. Set SENTRY_DSN environment variable
 * 2. Run: npx @sentry/nextjs init
 * 3. Or manually configure as shown below
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Initialize Sentry if DSN is configured
 */
export function initSentry() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

  if (!dsn) {
    // Sentry not configured, skip initialization
    if (process.env.NODE_ENV === 'development') {
      console.warn('Sentry DSN not configured. Monitoring disabled.');
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    debug: process.env.NODE_ENV === 'development',
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request?.headers) {
        // Remove sensitive headers
        const headers = event.request.headers;
        const sensitiveHeaders = ['authorization', 'cookie', 'x-csrf-token'];
        sensitiveHeaders.forEach((header) => {
          if (header in headers) {
            headers[header] = '[REDACTED]';
          }
        });
      }

      // Remove sensitive data from user context
      if (event.user) {
        delete event.user.email; // Don't send email to Sentry
      }

      return event;
    },
  });
}

/**
 * Capture exception with context
 */
export function captureException(error: Error, context?: Record<string, unknown>) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Capture message with level
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, unknown>) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }
}

/**
 * Set user context for Sentry
 */
export function setUserContext(userId: string, email?: string) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
    Sentry.setUser({
      id: userId,
      // Don't set email for privacy
    });
  }
}

/**
 * Clear user context
 */
export function clearUserContext() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

