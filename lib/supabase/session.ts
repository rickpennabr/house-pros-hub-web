import { createClient } from './client';
import type { Session } from '@supabase/supabase-js';

/**
 * Get the current session from Supabase
 * Returns null if no session exists
 */
export async function getSession(): Promise<Session | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Refresh the current session
 * Returns the refreshed session or null if refresh fails
 * Handles missing refresh token errors gracefully
 */
export async function refreshSession(): Promise<Session | null> {
  try {
    const supabase = createClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.refreshSession();

    // Check if error is due to missing refresh token (non-fatal)
    if (error) {
      const isRefreshTokenError = error.message?.includes('Refresh Token Not Found') ||
                                 error.message?.includes('refresh_token_not_found') ||
                                 error.code === 'refresh_token_not_found';
      
      if (isRefreshTokenError) {
        // Refresh token is missing - this is expected when user is logged out
        // Return null instead of throwing
        return null;
      }
      // Other errors should be logged
      console.warn('Error refreshing session:', error.message);
      return null;
    }

    return session;
  } catch (error) {
    // Catch any unexpected errors
    console.warn('Unexpected error during session refresh:', error);
    return null;
  }
}

/**
 * Check if the current session is valid and not expired
 */
export async function isSessionValid(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  
  // Check if session is expired (with 5 minute buffer)
  const expiresAt = session.expires_at;
  if (!expiresAt) return false;
  
  const now = Math.floor(Date.now() / 1000);
  const buffer = 5 * 60; // 5 minutes in seconds
  
  return expiresAt > (now + buffer);
}

