/**
 * Utility to clear all local storage data
 * Useful for testing and migration to Supabase
 * 
 * You can also use this from browser console:
 * import { clearAllLocalData } from '@/lib/utils/clearLocalData';
 * clearAllLocalData();
 * 
 * Or visit: /admin/clear-data
 */

import { authStorage } from '@/lib/storage/authStorage';
import { businessStorage } from '@/lib/storage/businessStorage';
import { savedBusinessStorage } from '@/lib/storage/savedBusinessStorage';
import { partnerStorage } from '@/lib/storage/partnerStorage';

/**
 * Clear all local storage data including:
 * - Authentication data (user, token)
 * - Business data
 * - Saved businesses
 * - Partner data
 * - Feedback data
 * - Any other localStorage items
 */
export function clearAllLocalData(): void {
  if (typeof window === 'undefined') {
    console.warn('clearAllLocalData can only be called in browser environment');
    return;
  }

  try {
    // Clear using storage utilities
    authStorage.clear();
    businessStorage.clearAll();
    
    // Clear saved businesses if method exists
    if (typeof savedBusinessStorage.clearAll === 'function') {
      savedBusinessStorage.clearAll();
    }
    
    // Clear partner storage if method exists
    if (typeof partnerStorage.clearAll === 'function') {
      partnerStorage.clearAll();
    }
    
    // Clear feedback storage
    try {
      localStorage.removeItem('business_feedback');
    } catch (error) {
      console.warn('Failed to clear feedback storage:', error);
    }

    // Clear any remaining localStorage items that might exist
    // Get all keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        keysToRemove.push(key);
      }
    }

    // Remove all keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove localStorage key: ${key}`, error);
      }
    });

    // Also clear sessionStorage for good measure
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(key => {
      try {
        sessionStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to remove sessionStorage key: ${key}`, error);
      }
    });

    console.log('✅ All local storage data cleared successfully');
  } catch (error) {
    console.error('❌ Error clearing local storage:', error);
    throw error;
  }
}

/**
 * Clear only authentication-related data
 */
export function clearAuthData(): void {
  if (typeof window === 'undefined') return;
  
  try {
    authStorage.clear();
    console.log('✅ Authentication data cleared');
  } catch (error) {
    console.error('❌ Error clearing auth data:', error);
  }
}

/**
 * Clear only business-related data
 */
export function clearBusinessData(): void {
  if (typeof window === 'undefined') return;
  
  try {
    businessStorage.clearAll();
    console.log('✅ Business data cleared');
  } catch (error) {
    console.error('❌ Error clearing business data:', error);
  }
}

