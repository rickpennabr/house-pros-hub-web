/**
 * Rate limit configurations for different endpoint types
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message: string; // Error message when limit exceeded
}

export const RATE_LIMIT_CONFIGS = {
  // Authentication endpoints - strict limits to prevent brute force
  auth: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.',
  } as RateLimitConfig,

  // File upload endpoints - prevent abuse
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'Upload limit exceeded. Please try again later.',
  } as RateLimitConfig,

  // Estimate image uploads (ProBot + estimate page) - separate quota so multiple images per estimate are allowed
  estimateUpload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 30,
    message: 'Upload limit exceeded. Please try again later.',
  } as RateLimitConfig,

  // General API endpoints - more lenient
  general: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Rate limit exceeded. Please slow down your requests.',
  } as RateLimitConfig,

  // Business creation/editing - moderate limits
  business: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    message: 'Too many business operations. Please try again later.',
  } as RateLimitConfig,

  // ProBot chat - prevent spam
  chat: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Too many messages. Please slow down.',
  } as RateLimitConfig,
} as const;

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIGS;

