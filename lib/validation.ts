/**
 * Shared validation utilities
 */

/**
 * Validates email format
 * @param email - Email address to validate
 * @returns true if email format is valid
 */
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Validates password meets minimum requirements
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * @param password - Password to validate
 * @returns true if password meets requirements
 */
export const isValidPassword = (password: string): boolean => {
  if (password.length < 8) {
    return false;
  }
  
  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return false;
  }
  
  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return false;
  }
  
  // Check for at least one number
  if (!/[0-9]/.test(password)) {
    return false;
  }
  
  return true;
};

/**
 * Validates that a string is not empty after trimming
 * @param value - String to validate
 * @returns true if string has content after trimming
 */
export const isNotEmpty = (value: string): boolean => {
  return value.trim().length > 0;
};

