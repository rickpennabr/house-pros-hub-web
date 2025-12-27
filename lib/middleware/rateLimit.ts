import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMIT_CONFIGS, type RateLimitType } from '@/lib/utils/rateLimitConfig';

/**
 * In-memory store for rate limiting
 * TODO: Replace with Redis for production multi-instance deployments
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Get client identifier for rate limiting
 * Uses IP address or user ID if authenticated
 */
function getClientIdentifier(request: NextRequest, userId?: string): string {
  // Prefer user ID for authenticated requests (more accurate)
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded ? forwarded.split(',')[0].trim() : realIp || 'unknown';
  return `ip:${ip}`;
}

/**
 * Rate limiting middleware
 * 
 * @param request - Next.js request object
 * @param type - Type of rate limit to apply
 * @param userId - Optional user ID for user-based rate limiting
 * @returns Response with 429 status if limit exceeded, null if allowed
 */
export async function checkRateLimit(
  request: NextRequest,
  type: RateLimitType,
  userId?: string
): Promise<NextResponse | null> {
  const config = RATE_LIMIT_CONFIGS[type];
  const identifier = getClientIdentifier(request, userId);
  const key = `${type}:${identifier}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return null; // Allow request
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return NextResponse.json(
      {
        error: config.message,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(entry.resetTime).toISOString(),
        },
      }
    );
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return null; // Allow request
}

/**
 * Helper to determine rate limit type from request path
 */
export function getRateLimitType(pathname: string): RateLimitType {
  if (pathname.includes('/auth/')) {
    return 'auth';
  }
  if (pathname.includes('/storage/upload')) {
    return 'upload';
  }
  if (pathname.includes('/business/create') || pathname.includes('/business/')) {
    return 'business';
  }
  return 'general';
}

