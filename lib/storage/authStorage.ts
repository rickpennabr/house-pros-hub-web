/**
 * LocalStorage abstraction for authentication data
 */

import { User } from '@/contexts/AuthContext';
import { STORAGE_KEYS } from '@/lib/constants/auth';

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
   * Get stored password for an email
   * @param email - Email address
   * @returns Password string or null if not found
   */
  getPassword: (email: string): string | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PASSWORDS);
      if (!stored) return null;
      
      const passwords = JSON.parse(stored);
      return passwords[email.toLowerCase()] || null;
    } catch (error) {
      console.error('Error parsing stored passwords:', error);
      return null;
    }
  },

  /**
   * Store password for an email
   * @param email - Email address
   * @param password - Password to store
   */
  setPassword: (email: string, password: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PASSWORDS);
      const passwords = stored ? JSON.parse(stored) : {};
      passwords[email.toLowerCase()] = password;
      localStorage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(passwords));
    } catch (error) {
      console.error('Error storing password:', error);
    }
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
    // Note: We keep passwords stored for future logins
  },
};

