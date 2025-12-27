/**
 * LocalStorage abstraction for business data
 */

import { ProCardData } from '@/components/proscard/ProCard';

const STORAGE_KEY = 'businesses';

type StoredBusiness = ProCardData & { userId?: string };

export const businessStorage = {
  /**
   * Get all businesses from localStorage
   * @returns Array of businesses or empty array if none found
   */
  getAllBusinesses: (): StoredBusiness[] => {
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
    return allBusinesses.filter((business) => business.userId === userId);
  },

  /**
   * Get a business by its slug or ID
   * @param slugOrId - Slug or ID of the business
   * @returns Business object or null if not found
   */
  getBusinessBySlug: (slugOrId: string): ProCardData | null => {
    const allBusinesses = businessStorage.getAllBusinesses();
    return allBusinesses.find((business) => 
      business.slug === slugOrId || business.id === slugOrId
    ) || null;
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
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error('Storage quota exceeded. Please try using a smaller logo or removing some existing businesses.');
        alert('Could not save business: Storage quota exceeded. Please try using a smaller logo.');
      } else {
        console.error('Error storing business:', error);
      }
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
   * Delete a business by name
   * @param businessName - Name of business to delete
   * @returns true if business was found and deleted, false otherwise
   */
  deleteBusinessByName: (businessName: string): boolean => {
    if (typeof window === 'undefined') return false;
    
    try {
      const businesses = businessStorage.getAllBusinesses();
      const business = businesses.find((b: ProCardData) => 
        b.businessName.toLowerCase().trim() === businessName.toLowerCase().trim()
      );
      
      if (business) {
        businessStorage.deleteBusiness(business.id);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting business by name:', error);
      return false;
    }
  },

  /**
   * Clear all businesses (useful for testing)
   */
  clearAll: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * Initialize mock businesses if localStorage is empty
   * This is useful for development/demo purposes
   * Also merges in any new mock businesses that don't exist yet
   */
  initializeMockBusinesses: (mockBusinesses: ProCardData[]): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const existing = businessStorage.getAllBusinesses();
      
      if (existing.length === 0 && mockBusinesses.length > 0) {
        // Initialize if localStorage is empty
        const businessesWithUserId = mockBusinesses.map(business => ({
          ...business,
          userId: 'mock-user',
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(businessesWithUserId));
      } else if (existing.length > 0 && mockBusinesses.length > 0) {
        // Merge in new mock businesses that don't exist yet
        const existingIds = new Set(existing.map((b: ProCardData) => b.id));
        const newBusinesses = mockBusinesses
          .filter(business => !existingIds.has(business.id))
          .map(business => ({
            ...business,
            userId: 'mock-user',
          }));
        
        if (newBusinesses.length > 0) {
          const allBusinesses = [...existing, ...newBusinesses];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(allBusinesses));
        }
      }
    } catch (error) {
      console.error('Error initializing mock businesses:', error);
    }
  },
};

