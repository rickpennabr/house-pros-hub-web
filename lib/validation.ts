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
 * @param password - Password to validate
 * @param minLength - Minimum password length (default: 6)
 * @returns true if password meets requirements
 */
export const isValidPassword = (password: string, minLength: number = 6): boolean => {
  return password.length >= minLength;
};

/**
 * Validates that a string is not empty after trimming
 * @param value - String to validate
 * @returns true if string has content after trimming
 */
export const isNotEmpty = (value: string): boolean => {
  return value.trim().length > 0;
};

