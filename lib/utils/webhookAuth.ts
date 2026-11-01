/**
 * Webhook authentication for Resend inbound email.
 * Resend signs deliveries with Svix (svix-id, svix-timestamp, svix-signature).
 * A static WEBHOOK_API_KEY is an alternate for non-Resend callers.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { logger } from './logger';

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function webhookSecrets(): { resend: string | null; apiKey: string | null } {
  const resend = process.env.RESEND_WEBHOOK_SECRET?.trim() || null;
  const apiKey = process.env.WEBHOOK_API_KEY?.trim() || null;
  return { resend, apiKey };
}

/**
 * Verify a Svix signature over the raw request body.
 * Secret may be stored as `whsec_<base64>` (Resend dashboard) or raw base64.
 */
export function verifyResendWebhook(rawBody: string, request: NextRequest): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signatureHeader = request.headers.get('svix-signature');
  if (!id || !timestamp || !signatureHeader) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    logger.warn('Webhook timestamp outside tolerance', { endpoint: 'webhook-auth' });
    return false;
  }

  const secretBytes = decodeWebhookSecret(secret);
  if (!secretBytes) return false;

  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secretBytes).update(signed).digest('base64');

  const parts = signatureHeader.split(' ');
  for (const part of parts) {
    const [version, signature] = part.split(',');
    if (version === 'v1' && signature && safeEqual(signature, expected)) {
      return true;
    }
  }
  return false;
}

function decodeWebhookSecret(secret: string): Buffer | null {
  const encoded = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  try {
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length === 0) return null;
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Bearer or x-api-key check. Returns false when WEBHOOK_API_KEY is unset.
 */
export function verifyWebhookApiKey(request: NextRequest): boolean {
  const expectedKey = process.env.WEBHOOK_API_KEY?.trim();
  if (!expectedKey) return false;

  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.headers.get('x-api-key') ||
    '';

  if (!provided || !safeEqual(provided, expectedKey)) {
    return false;
  }
  return true;
}

/**
 * Accept the request when a configured secret validates.
 * In development, with neither secret set, allow the call so local inbound tests still run.
 */
export function authorizeInboundEmailWebhook(rawBody: string, request: NextRequest): boolean {
  const { resend, apiKey } = webhookSecrets();

  if (!resend && !apiKey) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('RESEND_WEBHOOK_SECRET or WEBHOOK_API_KEY is required in production', {
        endpoint: 'webhook-auth',
      });
      return false;
    }
    logger.warn('No webhook secret configured, allowing inbound email webhook in development', {
      endpoint: 'webhook-auth',
    });
    return true;
  }

  if (resend && verifyResendWebhook(rawBody, request)) return true;
  if (apiKey && verifyWebhookApiKey(request)) return true;

  logger.warn('Webhook authentication failed', { endpoint: 'webhook-auth' });
  return false;
}
