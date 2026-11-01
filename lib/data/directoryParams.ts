const CATEGORY_PATTERN = /^[\p{L}\p{N}&'./ -]{1,80}$/u;
const CITY_PATTERN = /^[\p{L}\p{N} .'/-]{1,80}$/u;

export function sanitizeDirectorySearch(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[%_\\,]/g, '').trim().slice(0, 80);
}

export function sanitizeDirectoryCategory(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value || value === 'All') return '';
  if (!CATEGORY_PATTERN.test(value)) return '';
  return value;
}

export function sanitizeDirectoryCity(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value || !CITY_PATTERN.test(value)) return '';
  return value;
}

/** Locale-free directory path. Category and city become a crawlable query string. */
export function directoryPath(category?: string | null, city?: string | null): string {
  const params = new URLSearchParams();
  const cleanCategory = sanitizeDirectoryCategory(category);
  const cleanCity = sanitizeDirectoryCity(city);
  if (cleanCategory) params.set('category', cleanCategory);
  if (cleanCity) params.set('city', cleanCity);
  const query = params.toString();
  return query ? `/businesslist?${query}` : '/businesslist';
}
