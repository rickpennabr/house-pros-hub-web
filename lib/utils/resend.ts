import { Resend } from 'resend';
import { logger } from './logger';

let resendClient: Resend | null = null;

/**
 * Get or create Resend client instance (singleton)
 * @returns Resend client instance
 * @throws Error if RESEND_API_KEY is not configured
 */
export function getResendClient(): Resend {
  if (resendClient) {
    return resendClient;
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.error('RESEND_API_KEY is not configured', { endpoint: 'resend-client' });
    throw new Error('Email service is not configured. Please contact support.');
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

/**
 * Get the from email address for Resend
 * @returns From email address
 */
export function getResendFromEmail(): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  
  if (!fromEmail) {
    logger.warn('RESEND_FROM_EMAIL is not configured, using default', { endpoint: 'resend-client' });
    return 'noreply@houseproshub.com';
  }

  return fromEmail;
}

