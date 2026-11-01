/**
 * Short-lived signed token for sensitive visitor actions (e.g. delete conversation).
 * Format: base64url(visitorId:expiryMs).base64url(HMAC-SHA256(that, secret))
 * Verifying ensures the token was issued by the server and not expired.
 */

import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const VISITOR_COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

function signaturesMatch(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function signVisitorCapability(visitorId: string, ttlMs: number): string {
  const expiry = Date.now() + ttlMs;
  const payload = `${visitorId}:${expiry}`;
  const encoded = base64UrlEncode(payload);
  const signature = hmacSha256Base64Url(encoded, getSecret());
  return `${encoded}.${signature}`;
}

/** Returns the visitor id when the signature is valid and the token has not expired. */
export function readSignedVisitorId(token: string): string | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expectedSig = hmacSha256Base64Url(encoded, getSecret());
  if (!signaturesMatch(signature, expectedSig)) return null;
  const decoded = base64UrlDecode(encoded);
  const splitAt = decoded.lastIndexOf(':');
  if (splitAt <= 0) return null;
  const visitorId = decoded.slice(0, splitAt);
  const expiry = parseInt(decoded.slice(splitAt + 1), 10);
  if (!visitorId || Number.isNaN(expiry) || expiry < Date.now()) return null;
  return visitorId;
}

export function signVisitorDeleteToken(visitorId: string): string {
  return signVisitorCapability(visitorId, TOKEN_TTL_MS);
}

export function verifyVisitorDeleteToken(token: string, visitorId: string): boolean {
  const signedId = readSignedVisitorId(token);
  if (!signedId || signedId.length !== visitorId.length) return false;
  return signaturesMatch(signedId, visitorId);
}
