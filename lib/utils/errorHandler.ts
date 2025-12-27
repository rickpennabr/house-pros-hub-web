import { NextResponse } from 'next/server';
import { AppError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, RateLimitError } from '@/lib/types/errors';

/**
 * Generate a unique error ID for tracking
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Log error with structured data
 * In production, this should send to a logging service
 */
function logError(error: unknown, errorId: string, context?: Record<string, unknown>): void {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    console.error(`[${errorId}] Error:`, error);
    if (context) {
      console.error(`[${errorId}] Context:`, context);
    }
  } else {
    // In production, send to logging service (Sentry, LogRocket, etc.)
    // Example structure for logging service:
    const logData = {
      errorId,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      context,
      timestamp: new Date().toISOString(),
    };
    
    // TODO: Send to logging service
    // Example: Sentry.captureException(error, { extra: logData });
  }
}

/**
 * Handle errors and return appropriate response
 * 
 * @param error - The error to handle
 * @param context - Additional context about the error
 * @returns NextResponse with error details
 */
export function handleError(
  error: unknown,
  context?: {
    endpoint?: string;
    userId?: string;
    requestId?: string;
    [key: string]: unknown;
  }
): NextResponse {
  const errorId = generateErrorId();
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log the error
  logError(error, errorId, context);

  // Handle known error types
  if (error instanceof AppError) {
    const response: {
      error: string;
      code?: string;
      errorId?: string;
      details?: unknown;
    } = {
      error: error.message,
      code: error.code,
    };

    // Only include error ID and details in development
    if (isDevelopment) {
      response.errorId = errorId;
      if (error.details) {
        response.details = error.details;
      }
    } else {
      // In production, include error ID for tracking but not details
      response.errorId = errorId;
    }

    return NextResponse.json(response, { status: error.statusCode });
  }

  // Handle Zod validation errors
  if (error && typeof error === 'object' && 'issues' in error) {
    const zodError = error as { issues: Array<{ path: (string | number)[]; message: string }> };
    const details = zodError.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errorId: isDevelopment ? errorId : undefined,
        details: isDevelopment ? details : undefined,
      },
      { status: 400 }
    );
  }

  // Handle unknown errors
  const message = error instanceof Error ? error.message : 'Internal server error';
  
  return NextResponse.json(
    {
      error: message,
      code: 'INTERNAL_ERROR',
      errorId: isDevelopment ? errorId : undefined,
    },
    { status: 500 }
  );
}

/**
 * Wrapper for API route handlers to automatically handle errors
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  };
}

// Export error types for use in API routes
export {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
};

