/**
 * LocalStorage abstraction for partnership data
 */

export interface Partnership {
  id: string;
  requesterId: string; // Business ID that initiated the request
  receiverId: string;  // Business ID that received the request
  status: 'pending' | 'active' | 'rejected';
  requestDate: string;
}

const STORAGE_KEY = 'partnerships';

export const partnerStorage = {
  /**
   * Get all partnerships from localStorage
   */
  getAllPartnerships: (): Partnership[] => {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error parsing stored partnerships:', error);
      return [];
    }
  },

  /**
   * Get partnerships for a specific business
   */
  getPartnershipsByBusinessId: (businessId: string): Partnership[] => {
    const all = partnerStorage.getAllPartnerships();
    return all.filter(p => p.requesterId === businessId || p.receiverId === businessId);
  },

  /**
   * Add a new partnership request
   */
  addPartnership: (partnership: Omit<Partnership, 'id'>): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const all = partnerStorage.getAllPartnerships();
      const newPartnership = {
        ...partnership,
        id: `partnership_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      all.push(newPartnership);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (error) {
      console.error('Error storing partnership:', error);
    }
  },

  /**
   * Update partnership status
   */
  updateStatus: (partnershipId: string, status: Partnership['status']): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const all = partnerStorage.getAllPartnerships();
      const index = all.findIndex(p => p.id === partnershipId);
      if (index !== -1) {
        all[index].status = status;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      }
    } catch (error) {
      console.error('Error updating partnership status:', error);
    }
  },

  /**
   * Remove a partnership
   */
  removePartnership: (partnershipId: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const all = partnerStorage.getAllPartnerships();
      const filtered = all.filter(p => p.id !== partnershipId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing partnership:', error);
    }
  },

  /**
   * Clear all partnerships (useful for cleanup)
   */
  clearAll: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }
};
