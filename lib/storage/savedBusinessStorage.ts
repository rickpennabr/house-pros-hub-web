/**
 * LocalStorage abstraction for saved businesses (user-specific)
 */

const STORAGE_KEY = 'savedBusinesses';

interface SavedBusiness {
  userId: string;
  businessId: string;
  savedAt: number; // timestamp
}

export const savedBusinessStorage = {
  /**
   * Get all saved businesses from localStorage
   * @returns Array of saved business records
   */
  getAllSavedBusinesses: (): SavedBusiness[] => {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error parsing saved businesses:', error);
      return [];
    }
  },

  /**
   * Get saved business IDs for a specific user
   * @param userId - User ID to filter saved businesses
   * @returns Array of business IDs saved by the user
   */
  getSavedBusinessIds: (userId: string): string[] => {
    const allSaved = savedBusinessStorage.getAllSavedBusinesses();
    return allSaved
      .filter((saved: SavedBusiness) => saved.userId === userId)
      .map((saved: SavedBusiness) => saved.businessId);
  },

  /**
   * Check if a business is saved by a user
   * @param userId - User ID
   * @param businessId - Business ID
   * @returns true if the business is saved by the user
   */
  isBusinessSaved: (userId: string, businessId: string): boolean => {
    const allSaved = savedBusinessStorage.getAllSavedBusinesses();
    return allSaved.some(
      (saved: SavedBusiness) => saved.userId === userId && saved.businessId === businessId
    );
  },

  /**
   * Save a business for a user
   * @param userId - User ID
   * @param businessId - Business ID to save
   */
  saveBusiness: (userId: string, businessId: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const allSaved = savedBusinessStorage.getAllSavedBusinesses();
      
      // Check if already saved
      const alreadySaved = allSaved.some(
        (saved: SavedBusiness) => saved.userId === userId && saved.businessId === businessId
      );
      
      if (!alreadySaved) {
        allSaved.push({
          userId,
          businessId,
          savedAt: Date.now(),
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allSaved));
      }
    } catch (error) {
      console.error('Error saving business:', error);
    }
  },

  /**
   * Remove a saved business for a user
   * @param userId - User ID
   * @param businessId - Business ID to remove
   */
  removeSavedBusiness: (userId: string, businessId: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const allSaved = savedBusinessStorage.getAllSavedBusinesses();
      const filtered = allSaved.filter(
        (saved: SavedBusiness) => !(saved.userId === userId && saved.businessId === businessId)
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing saved business:', error);
    }
  },

  /**
   * Clear all saved businesses for a user
   * @param userId - User ID
   */
  clearUserSavedBusinesses: (userId: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const allSaved = savedBusinessStorage.getAllSavedBusinesses();
      const filtered = allSaved.filter(
        (saved: SavedBusiness) => saved.userId !== userId
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error clearing saved businesses:', error);
    }
  },

  /**
   * Clear all saved businesses (useful for testing)
   */
  clearAll: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },
};
