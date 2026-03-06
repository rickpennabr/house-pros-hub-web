/**
 * Short-lived signed token for sensitive visitor actions (e.g. delete conversation).
 * Format: base64url(visitorId:expiryMs).base64url(HMAC-SHA256(that, secret))
 * Verifying ensures the token was issued by the server and not expired.
 */

import { createHmac } from 'crypto';

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getSecret(): string {
  const secret = process.env.CHAT_VISITOR_TOKEN_SECRET?.trim();
  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error('CHAT_VISITOR_TOKEN_SECRET is required in production for visitor delete tokens');
  }
  return secret ?? 'dev-unsafe-secret-change-in-production';
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data, 'utf8').toString('base64url');
}

function base64UrlDecode(str: string): string {
  try {
    return Buffer.from(str, 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function hmacSha256Base64Url(message: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(message, 'utf8').digest();
  return Buffer.from(sig).toString('base64url');
}

export function signVisitorDeleteToken(visitorId: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${visitorId}:${expiry}`;
  const encoded = base64UrlEncode(payload);
  const secret = getSecret();
  const signature = hmacSha256Base64Url(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifyVisitorDeleteToken(token: string, visitorId: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encoded, signature] = parts;
  const secret = getSecret();
  const expectedSig = hmacSha256Base64Url(encoded, secret);
  if (expectedSig !== signature) return false;
  const decoded = base64UrlDecode(encoded);
  const [tokenVisitorId, expiryStr] = decoded.split(':');
  if (tokenVisitorId !== visitorId) return false;
  const expiry = parseInt(expiryStr ?? '0', 10);
  if (Number.isNaN(expiry) || expiry < Date.now()) return false;
  return true;
}
