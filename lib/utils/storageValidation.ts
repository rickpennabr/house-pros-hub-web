/**
 * Storage bucket and path validation for admin storage API.
 * Allowlisting buckets and validating paths reduces risk of misuse and path traversal.
 */

/** Buckets that admin storage list/delete are allowed to access */
export const ALLOWED_STORAGE_BUCKETS = [
  'profile-pictures',
  'business-logos',
  'business-backgrounds',
  'estimate-images',
] as const;

const ALLOWED_SET = new Set<string>(ALLOWED_STORAGE_BUCKETS);

const MAX_PATH_LENGTH = 512;
const UNSAFE_PATH_PATTERN = /\.\.|^\/|[<>:"|?*\\\x00-\x1f]/;

/**
 * Validates that the bucket is in the allowlist.
 * @returns null if valid, or an error message if invalid
 */
export function validateStorageBucket(bucket: string): string | null {
  if (!bucket || typeof bucket !== 'string') {
    return 'Bucket name is required';
  }
  const trimmed = bucket.trim();
  if (!trimmed) return 'Bucket name is required';
  if (!ALLOWED_SET.has(trimmed)) {
    return `Bucket not allowed. Allowed: ${ALLOWED_STORAGE_BUCKETS.join(', ')}`;
  }
  return null;
}

/**
 * Validates storage path or folder: no path traversal, no leading slash, no unsafe chars, length limit.
 * @returns null if valid, or an error message if invalid
 */
export function validateStoragePath(path: string): string | null {
  if (typeof path !== 'string') return 'Path must be a string';
  const trimmed = path.trim();
  if (trimmed.length > MAX_PATH_LENGTH) {
    return `Path must be at most ${MAX_PATH_LENGTH} characters`;
  }
  if (UNSAFE_PATH_PATTERN.test(trimmed)) {
    return 'Path contains invalid or unsafe characters';
  }
  return null;
}

/**
 * Normalizes a path/folder for storage: trim, collapse repeated slashes, remove leading/trailing slashes.
 * Call after validateStoragePath; use empty string for root.
 */
export function normalizeStoragePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '';
  const normalized = trimmed
    .replace(/\/+/g, '/')
    .replace(/^\//, '')
    .replace(/\/$/, '');
  return normalized;
}
