/**
 * LocalStorage abstraction for authentication data
 * 
 * @deprecated This module is deprecated in favor of Supabase authentication.
 * All authentication is now handled through AuthContext which uses Supabase.
 * This file is kept for backward compatibility during migration but should
 * not be used in new code. Use useAuth() hook from AuthContext instead.
 */

import { User } from '@/contexts/AuthContext';
import { STORAGE_KEYS } from '@/lib/constants/auth';

/**
 * @deprecated Use AuthContext and Supabase instead
 */
export const authStorage = {
  /**
   * Get stored user from localStorage
   * @returns User object or null if not found
   */
  getUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.USER);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error parsing stored user data:', error);
      return null;
    }
  },

  /**
   * Store user in localStorage
   * @param user - User object to store
   */
  setUser: (user: User): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  /**
   * Get stored auth token
   * @returns Token string or null if not found
   */
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  /**
   * Store auth token
   * @param token - Token string to store
   */
  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  },

  /**
   * SECURITY NOTE: Passwords should NEVER be stored in localStorage.
   * This method is deprecated and will be removed.
   * In production, authentication should use httpOnly cookies with server-side sessions.
   * 
   * @deprecated This method is for backward compatibility only. Do not use in production.
   */
  getPassword: (): string | null => {
    // SECURITY: Never store passwords client-side
    // This is a mock implementation for development only
    if (process.env.NODE_ENV === 'production') {
      console.warn('getPassword should not be used in production');
      return null;
    }
    return null;
  },

  /**
   * SECURITY NOTE: Passwords should NEVER be stored in localStorage.
   * This method is deprecated and will be removed.
   * In production, passwords should be hashed server-side (bcrypt/argon2) and never stored client-side.
   * 
   * @deprecated This method is for backward compatibility only. Do not use in production.
   */
  setPassword: (): void => {
    // SECURITY: Never store passwords client-side
    // This is intentionally a no-op to prevent password storage
    if (process.env.NODE_ENV === 'production') {
      console.warn('setPassword should not be used in production');
      return;
    }
    // No-op: Do not store passwords
  },

  /**
   * Check if user exists for email
   * @param email - Email address to check
   * @returns true if user exists
   */
  userExists: (email: string): boolean => {
    const user = authStorage.getUser();
    return user?.email.toLowerCase() === email.toLowerCase();
  },

  /**
   * Clear all authentication data
   */
  clear: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    // Note: Passwords are never stored (security best practice)
  },
};

