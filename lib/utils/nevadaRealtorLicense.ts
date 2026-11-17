/**
 * Nevada Real Estate Division (NRED) license helpers for Las Vegas / statewide.
 * Sources: NRS/NAC 645, Form 501, NRED license lookup / advertising rules.
 *
 * License levels and number prefixes:
 * - Salesperson: S.12345
 * - Broker-salesperson: BS.12345
 * - Broker: B.12345
 *
 * Leading zeros after the prefix may be omitted. Ads must also show the
 * brokerage name prominently.
 */

export type NevadaRealtorLicenseLevel = 'salesperson' | 'broker_salesperson' | 'broker';

export const REALTOR_LICENSE_CODES = {
  salesperson: 'REALTOR_SALES',
  brokerSalesperson: 'REALTOR_BROKER_SALES',
  broker: 'REALTOR_BROKER',
} as const;

const PREFIX_BY_CODE: Record<string, string> = {
  REALTOR_SALES: 'S',
  REALTOR_BROKER_SALES: 'BS',
  REALTOR_BROKER: 'B',
};

/** Normalize to PREFIX.digits with no leading zeros in the numeric part. */
export function normalizeNevadaRealtorLicenseNumber(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  const match = cleaned.match(/^(S|BS|B)\.?0*(\d+)$/i);
  if (!match) return cleaned;
  const prefix = match[1].toUpperCase();
  const digits = match[2].replace(/^0+/, '') || '0';
  return `${prefix}.${digits}`;
}

export function expectedPrefixForRealtorLicenseCode(code: string): string | null {
  return PREFIX_BY_CODE[code] ?? null;
}

/**
 * Valid when the number matches Nevada's prefix.digits pattern.
 * If a license classification is provided, the prefix must match that level.
 */
export function isValidNevadaRealtorLicenseNumber(
  raw: string,
  licenseCode?: string | null
): boolean {
  const normalized = normalizeNevadaRealtorLicenseNumber(raw);
  const match = normalized.match(/^(S|BS|B)\.(\d+)$/);
  if (!match) return false;
  if (!licenseCode) return true;
  const expected = expectedPrefixForRealtorLicenseCode(licenseCode);
  if (!expected) return true;
  return match[1] === expected;
}

export function nevadaRealtorLicenseHint(licenseCode?: string | null): string {
  const expected = licenseCode ? expectedPrefixForRealtorLicenseCode(licenseCode) : null;
  if (expected === 'S') return 'Example: S.12345 (Nevada salesperson)';
  if (expected === 'BS') return 'Example: BS.12345 (Nevada broker-salesperson)';
  if (expected === 'B') return 'Example: B.12345 (Nevada broker)';
  return 'Use your Nevada number with prefix, e.g. S.12345, BS.12345, or B.12345';
}
