/**
 * LocalStorage abstraction for feedback/comments data
 */

export interface Comment {
  id: string;
  author: string;
  authorId: string;
  authorType: 'homeowner' | 'business';
  text: string;
  timestamp: Date;
  authorPicture?: string;
  replies?: Comment[];
  parentId?: string; // For replies
}

const STORAGE_KEY = 'business_feedback';

export const feedbackStorage = {
  /**
   * Get all feedback for a specific business
   * @param businessId - ID of business to get feedback for
   * @returns Array of comments or empty array if none found
   */
  getFeedback: (businessId: string): Comment[] => {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const allFeedback: Record<string, Comment[]> = JSON.parse(stored);
      const feedback = allFeedback[businessId] || [];
      
      // Convert timestamp strings back to Date objects
      return feedback.map(comment => ({
        ...comment,
        timestamp: new Date(comment.timestamp),
        replies: comment.replies?.map(reply => ({
          ...reply,
          timestamp: new Date(reply.timestamp),
        })),
      }));
    } catch (error) {
      console.error('Error parsing stored feedback:', error);
      return [];
    }
  },

  /**
   * Add a comment to a business
   * @param businessId - ID of business to add feedback to
   * @param comment - Comment object to add
   */
  addComment: (businessId: string, comment: Comment): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const allFeedback: Record<string, Comment[]> = stored ? JSON.parse(stored) : {};
      
      if (!allFeedback[businessId]) {
        allFeedback[businessId] = [];
      }
      
      allFeedback[businessId].push(comment);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allFeedback));
    } catch (error) {
      console.error('Error storing comment:', error);
    }
  },

  /**
   * Add a reply to an existing comment
   * @param businessId - ID of business
   * @param parentCommentId - ID of parent comment
   * @param reply - Reply comment object
   */
  addReply: (businessId: string, parentCommentId: string, reply: Comment): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      
      const allFeedback: Record<string, Comment[]> = JSON.parse(stored);
      const feedback = allFeedback[businessId] || [];
      
      const parentIndex = feedback.findIndex(c => c.id === parentCommentId);
      if (parentIndex !== -1) {
        if (!feedback[parentIndex].replies) {
          feedback[parentIndex].replies = [];
        }
        feedback[parentIndex].replies!.push(reply);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allFeedback));
      }
    } catch (error) {
      console.error('Error storing reply:', error);
    }
  },

  /**
   * Update a comment
   * @param businessId - ID of business
   * @param commentId - ID of comment to update
   * @param updates - Partial comment data to update
   */
  updateComment: (businessId: string, commentId: string, updates: Partial<Comment>): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      
      const allFeedback: Record<string, Comment[]> = JSON.parse(stored);
      const feedback = allFeedback[businessId] || [];
      
      const index = feedback.findIndex(c => c.id === commentId);
      if (index !== -1) {
        feedback[index] = { ...feedback[index], ...updates };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allFeedback));
      }
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  },

  /**
   * Delete a comment
   * @param businessId - ID of business
   * @param commentId - ID of comment to delete
   */
  deleteComment: (businessId: string, commentId: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      
      const allFeedback: Record<string, Comment[]> = JSON.parse(stored);
      const feedback = allFeedback[businessId] || [];
      
      const filtered = feedback.filter(c => c.id !== commentId);
      allFeedback[businessId] = filtered;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allFeedback));
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  },

  /**
   * Clear all feedback for a business (useful for testing)
   * @param businessId - ID of business
   */
  clearFeedback: (businessId: string): void => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      
      const allFeedback: Record<string, Comment[]> = JSON.parse(stored);
      delete allFeedback[businessId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allFeedback));
    } catch (error) {
      console.error('Error clearing feedback:', error);
    }
  },
};

