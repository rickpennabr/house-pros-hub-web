/**
 * Keys that can be overridden per-invoice for company display (e.g. DBA vs legal entity).
 */
const COMPANY_DISPLAY_KEYS = [
  'business_name',
  'address',
  'email',
  'phone',
  'website',
  'business_logo',
  'company_tagline',
] as const;

export type CompanyDisplayOverride = Partial<{
  business_name: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  business_logo: string;
  company_tagline: string;
}>;

/**
 * Merges company_display overrides into a business object. Mutates business.
 */
export function applyCompanyDisplay(
  business: Record<string, unknown>,
  companyDisplay: unknown
): void {
  if (!companyDisplay || typeof companyDisplay !== 'object' || Array.isArray(companyDisplay)) return;
  const raw = companyDisplay as Record<string, unknown>;
  for (const k of COMPANY_DISPLAY_KEYS) {
    if (k in raw) (business as Record<string, unknown>)[k] = raw[k] ?? null;
  }
}

/**
 * Sanitize payload to only allow known company display keys with string values.
 */
export function sanitizeCompanyDisplay(payload: unknown): CompanyDisplayOverride | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload !== 'object' || Array.isArray(payload)) return null;
  const raw = payload as Record<string, unknown>;
  const out: CompanyDisplayOverride = {};
  for (const k of COMPANY_DISPLAY_KEYS) {
    if (k in raw) {
      const v = raw[k];
      out[k as keyof CompanyDisplayOverride] = typeof v === 'string' ? v : v != null ? String(v) : '';
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
