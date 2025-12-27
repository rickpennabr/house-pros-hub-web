/**
 * Admin configuration constants
 */

/**
 * Admin email address for authorization
 * Can be configured via ADMIN_EMAIL environment variable
 * Falls back to default admin email if not set
 */
export const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL?.trim().toLowerCase() ||
  'rick.maickcompanies@gmail.com';

