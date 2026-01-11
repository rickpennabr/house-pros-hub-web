/**
 * Utility functions for handling Server Action errors defensively
 * 
 * Next.js Server Actions can throw errors that may not be caught by standard
 * error boundaries. This utility provides defensive error handling for:
 * - Missing Server Actions (stale client references)
 * - Server Action execution failures
 * - Network errors during Server Action calls
 */

export interface ServerActionError {
  message: string;
  code?: string;
  actionId?: string;
  cause?: Error;
}

/**
 * Check if an error is a Server Action error
 */
export function isServerActionError(error: unknown): error is ServerActionError {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  
  return (
    message.includes('failed to find server action') ||
    message.includes('server action') ||
    message.includes('action could not be found') ||
    error.name === 'ServerActionError'
  );
}

/**
 * Extract Server Action ID from error message
 * Server Action errors typically include an action ID like: "00f2176e7447e3ab2c03cca1b1ed0baeeb6d10d3ac"
 */
export function extractServerActionId(error: Error): string | null {
  const idMatch = error.message.match(/([a-f0-9]{32,})/i);
  return idMatch ? idMatch[1] : null;
}

/**
 * Handle Server Action errors gracefully
 * 
 * This function provides defensive error handling for Server Action errors,
 * which can occur when:
 * - Client-side code references a Server Action that was removed
 * - The server was restarted but the client still has old references
 * - There's a cache mismatch between client and server
 * 
 * @param error - The error to handle
 * @param fallbackAction - Optional fallback action to execute
 * @returns Formatted error message and action ID
 */
export function handleServerActionError(
  error: unknown,
  fallbackAction?: () => void | Promise<void>
): {
  message: string;
  actionId: string | null;
  shouldRetry: boolean;
} {
  if (!isServerActionError(error)) {
    throw error; // Re-throw if not a Server Action error
  }

  const actionId = error instanceof Error ? extractServerActionId(error) : null;
  const message = error instanceof Error ? error.message : String(error);

  // Check if this is a "missing Server Action" error (stale reference)
  const isMissingAction = message.includes('Failed to find Server Action');

  // Log the error with context
  if (process.env.NODE_ENV === 'development') {
    console.warn('[ServerActionError]', {
      message,
      actionId,
      isMissingAction,
      suggestion: isMissingAction
        ? 'This usually means the client has a stale reference. Try clearing browser cache and restarting the dev server.'
        : 'Server Action execution failed. Check server logs for more details.',
    });
  }

  // Execute fallback action if provided
  if (fallbackAction) {
    try {
      void Promise.resolve(fallbackAction()).catch((fallbackError) => {
        console.error('[ServerActionError] Fallback action failed:', fallbackError);
      });
    } catch (syncError) {
      console.error('[ServerActionError] Fallback action failed:', syncError);
    }
  }

  return {
    message: isMissingAction
      ? 'The requested action is no longer available. Please refresh the page and try again.'
      : 'An error occurred while executing the action. Please try again.',
    actionId,
    shouldRetry: isMissingAction, // Suggest retry only for missing action errors
  };
}

/**
 * Wrapper for async functions that might involve Server Actions
 * 
 * This wrapper catches Server Action errors and handles them gracefully,
 * providing user-friendly error messages and fallback behavior.
 * 
 * @example
 * ```ts
 * const safeAction = withServerActionErrorHandler(async () => {
 *   // Your code that might use Server Actions
 * });
 * ```
 */
export function withServerActionErrorHandler<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  fallbackAction?: () => void | Promise<void>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (isServerActionError(error)) {
        const handled = handleServerActionError(error, fallbackAction);
        
        // Return a rejected promise with a user-friendly error
        throw new Error(handled.message);
      }
      throw error; // Re-throw non-Server Action errors
    }
  }) as T;
}

/**
 * Utility to clear stale Server Action references
 * 
 * Call this when detecting Server Action errors to prompt the user
 * to refresh or clear their cache.
 */
export function promptRefreshOnServerActionError(error: unknown): boolean {
  if (!isServerActionError(error)) {
    return false;
  }

  const actionId = error instanceof Error ? extractServerActionId(error) : null;
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('Failed to find Server Action')) {
    // In development, automatically suggest refresh
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[ServerActionError] Stale Server Action detected:',
        actionId,
        '\nSuggestion: Clear browser cache or restart dev server'
      );
    }

    return true; // Indicate that refresh is recommended
  }

  return false;
}



