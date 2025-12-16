/**
 * LocalStorage abstraction for business data
 */

import { ProCardData } from '@/components/proscard/ProCard';

const STORAGE_KEY = 'businesses';

export const businessStorage = {
  /**
   * Get all businesses from localStorage
   * @returns Array of businesses or empty array if none found
   */
  getAllBusinesses: (): ProCardData[] => {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error parsing stored businesses:', error);
      return [];
    }
  },

  /**
   * Get businesses for a specific user
   * @param userId - User ID to filter businesses
   * @returns Array of businesses owned by the user
   */
  getBusinessesByUserId: (userId: string): ProCardData[] => {
    const allBusinesses = businessStorage.getAllBusinesses();
    return allBusinesses.filter((business: any) => business.userId === userId);
  },

  /**
   * Store a business in localStorage
   * @param business - Business object to store (must include userId)
   */
  addBusiness: (business: ProCardData & { userId: string }): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const businesses = businessStorage.getAllBusinesses();
      businesses.push(business);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(businesses));
    } catch (error) {
      console.error('Error storing business:', error);
    }
  },

  /**
   * Update an existing business
   * @param businessId - ID of business to update
   * @param updates - Partial business data to update
   */
  updateBusiness: (businessId: string, updates: Partial<ProCardData>): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const businesses = businessStorage.getAllBusinesses();
      const index = businesses.findIndex((b: ProCardData) => b.id === businessId);
      if (index !== -1) {
        businesses[index] = { ...businesses[index], ...updates };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(businesses));
      }
    } catch (error) {
      console.error('Error updating business:', error);
    }
  },

  /**
   * Delete a business
   * @param businessId - ID of business to delete
   */
  deleteBusiness: (businessId: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const businesses = businessStorage.getAllBusinesses();
      const filtered = businesses.filter((b: ProCardData) => b.id !== businessId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting business:', error);
    }
  },

  /**
   * Clear all businesses (useful for testing)
   */
  clearAll: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },
};

