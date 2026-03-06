/**
 * Parse object-position string (e.g. "50% 50%") to { x, y } in 0-100.
 */
export function parseObjectPosition(value: string | undefined): { x: number; y: number } {
  if (!value || typeof value !== 'string') return { x: 50, y: 50 };
  const parts = value.trim().split(/\s+/);
  const x = Math.min(100, Math.max(0, parseFloat(parts[0]?.replace('%', '') || '50') || 50));
  const y = Math.min(100, Math.max(0, parseFloat(parts[1]?.replace('%', '') || '50') || 50));
  return { x, y };
}

/**
 * Format { x, y } to object-position string.
 */
export function formatObjectPosition(x: number, y: number): string {
  const cx = Math.min(100, Math.max(0, x));
  const cy = Math.min(100, Math.max(0, y));
  return `${cx}% ${cy}%`;
}
