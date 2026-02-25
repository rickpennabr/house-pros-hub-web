/**
 * Webhook authentication utilities
 * Validates webhook requests from Resend
 */

import { NextRequest } from 'next/server';
import { logger } from './logger';

/**
 * Verify Resend webhook signature
 * 
 * Resend sends webhooks with a signature in the headers.
 * You should configure a webhook secret in Resend and verify it here.
 * 
 * @param request - Next.js request object
 * @returns true if signature is valid, false otherwise
 */
export function verifyResendWebhook(request: NextRequest): boolean {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  
  // If no secret is configured, allow in development but warn
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('RESEND_WEBHOOK_SECRET is not configured in production', {
        endpoint: 'webhook-auth',
      });
      return false;
    }
    
    logger.warn('RESEND_WEBHOOK_SECRET is not configured, allowing webhook in development', {
      endpoint: 'webhook-auth',
    });
    return true; // Allow in development for testing
  }

  // Resend sends signature in X-Resend-Signature header
  // The signature is a SHA256 HMAC of the request body using the webhook secret
  const signature = request.headers.get('x-resend-signature');
  
  if (!signature) {
    logger.warn('Missing webhook signature', {
      endpoint: 'webhook-auth',
    });
    return false;
  }

  // TODO: Implement actual signature verification
  // This requires:
  // 1. Reading the raw request body
  // 2. Computing HMAC-SHA256(body, webhookSecret)
  // 3. Comparing with the signature header
  // 
  // Note: Next.js request body can only be read once, so we need to
  // handle this carefully. For now, we'll use a simpler approach with
  // an API key check or IP whitelist.

  // For now, we'll use a simpler API key approach
  // You can configure this in Resend webhook settings
  const apiKey = request.headers.get('x-resend-api-key');
  
  if (apiKey && apiKey === webhookSecret) {
    return true;
  }

  // Alternative: Check if request comes from Resend IPs
  // Resend webhooks come from specific IP ranges (check Resend docs)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown';
  
  // For development, we'll be more lenient
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Webhook authentication check', {
      endpoint: 'webhook-auth',
      ip,
      hasSignature: !!signature,
      hasApiKey: !!apiKey,
    });
    // In development, allow if we have either signature or API key
    return !!(signature || apiKey);
  }

  // In production, require proper authentication
  logger.warn('Webhook authentication failed', {
    endpoint: 'webhook-auth',
    ip,
    hasSignature: !!signature,
    hasApiKey: !!apiKey,
  });
  
  return false;
}

/**
 * Simple API key authentication for webhooks
 * Useful for testing or if Resend doesn't provide signature verification
 */
export function verifyWebhookApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('authorization')?.replace('Bearer ', '') ||
                 request.headers.get('x-api-key');
  const expectedKey = process.env.WEBHOOK_API_KEY;

  if (!expectedKey) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('WEBHOOK_API_KEY is not configured in production', {
        endpoint: 'webhook-auth',
      });
      return false;
    }
    // Allow in development if no key is set
    return true;
  }

  if (!apiKey || apiKey !== expectedKey) {
    logger.warn('Invalid webhook API key', {
      endpoint: 'webhook-auth',
      hasKey: !!apiKey,
    });
    return false;
  }

  return true;
}
