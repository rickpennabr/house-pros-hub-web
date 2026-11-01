import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { RATE_LIMIT_CONFIGS, type RateLimitType } from '@/lib/utils/rateLimitConfig';

/**
 * Process-local fallback used when the shared api_rate_limits table is unreachable.
 * The shared counter is the source of truth across instances.
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
 * Client IP from headers a reverse proxy sets, not the leftmost
 * X-Forwarded-For value a caller can prepend.
 */
function getClientIp(request: NextRequest): string {
  const vercelIp = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  if (vercelIp) return vercelIp;

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return 'unknown';
}

function getClientIdentifier(request: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`;
  return `ip:${getClientIp(request)}`;
}

function tooManyRequests(retryAfter: number, config: { maxRequests: number; message: string }, resetTime: number) {
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
        'X-RateLimit-Reset': new Date(resetTime).toISOString(),
      },
    }
  );
}

function consumeMemoryLimit(key: string, windowMs: number, maxRequests: number): { allowed: boolean; retryAfter: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    const resetTime = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return { allowed: true, retryAfter: 0, resetTime };
  }

  if (entry.count >= maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      resetTime: entry.resetTime,
    };
  }

  entry.count++;
  rateLimitStore.set(key, entry);
  return { allowed: true, retryAfter: 0, resetTime: entry.resetTime };
}

let sharedLimitWarned = false;

async function consumeSharedLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<{ allowed: boolean; retryAfter: number } | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_key: key,
    p_window_ms: windowMs,
    p_max: maxRequests,
  });
  if (error || !data || typeof data.allowed !== 'boolean') {
    if (!sharedLimitWarned) {
      sharedLimitWarned = true;
      console.warn(
        'Shared rate limit unavailable; using in-memory fallback.',
        error?.message ?? 'unexpected response'
      );
    }
    return null;
  }
  return {
    allowed: data.allowed,
    retryAfter: typeof data.retry_after_seconds === 'number' ? data.retry_after_seconds : 1,
  };
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

  try {
    const shared = await consumeSharedLimit(key, config.windowMs, config.maxRequests);
    if (shared) {
      if (shared.allowed) return null;
      const resetTime = Date.now() + shared.retryAfter * 1000;
      return tooManyRequests(shared.retryAfter, config, resetTime);
    }
  } catch {
    // Shared store unavailable; fall through to this process.
  }

  const memory = consumeMemoryLimit(key, config.windowMs, config.maxRequests);
  if (memory.allowed) return null;
  return tooManyRequests(memory.retryAfter, config, memory.resetTime);
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

