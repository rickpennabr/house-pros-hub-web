/**
 * Brand symbol shown on product cards and brand buttons. A logo saved on the brand (Admin → Products)
 * wins; Belgard, Keystone and Las Vegas Paver fall back to their built-in logos. Empty when none.
 */
export function brandLogoSrc(brand: string, saved?: string | null): string {
  if (saved && saved.trim()) return saved.trim();
  const normalized = brand.toLowerCase();
  if (normalized.includes('belgard')) return '/images/brands/belgard/Belgard_logo_symbol.png';
  if (normalized.includes('keystone')) return '/images/brands/keystone/keystone-logo_symbol.png';
  if (normalized.includes('las vegas') || normalized.includes('lvp')) return '/images/brands/lasvegaspaver/LasVegasPaver_logo_symbol.png';
  return '';
}
