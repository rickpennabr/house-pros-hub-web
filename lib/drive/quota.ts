/**
 * Account-wide ProDrive quota.
 * Free: 0.5 GB | Hub Pro: 1 GB
 * Overage: $0.032/GB/mo (same rate as BrazaDrive)
 */

export const DRIVE_FREE_BYTES = 512 * 1024 * 1024;
export const DRIVE_PRO_BYTES = 1024 * 1024 * 1024;
export const DRIVE_OVERAGE_USD_PER_GB = 0.032;
export const DRIVE_WARN_THRESHOLD = 0.9;
export const DRIVE_BYTES_PER_GB = 1024 * 1024 * 1024;

export type DriveQuotaErrorCode = 'DRIVE_QUOTA_EXCEEDED';

export interface AccountDriveUsage {
  usedBytes: number;
  freeBytes: number;
  overageBytes: number;
  plan: 'free' | 'pro';
  overageEnabled: boolean;
  percentUsed: number;
  isAtWarning: boolean;
  isAtLimit: boolean;
}

export function freeBytesForPlan(plan: 'free' | 'pro'): number {
  return plan === 'pro' ? DRIVE_PRO_BYTES : DRIVE_FREE_BYTES;
}

export function buildAccountDriveUsage(input: {
  usedBytes: number;
  plan: 'free' | 'pro';
  overageEnabled: boolean;
}): AccountDriveUsage {
  const freeBytes = freeBytesForPlan(input.plan);
  const usedBytes = Math.max(0, input.usedBytes);
  const overageBytes = Math.max(0, usedBytes - freeBytes);
  const percentUsed = freeBytes > 0 ? usedBytes / freeBytes : 1;
  return {
    usedBytes,
    freeBytes,
    overageBytes,
    plan: input.plan,
    overageEnabled: input.overageEnabled,
    percentUsed,
    isAtWarning: percentUsed >= DRIVE_WARN_THRESHOLD,
    isAtLimit: usedBytes >= freeBytes,
  };
}

export function quotaAllows(usage: AccountDriveUsage, additionalBytes: number): boolean {
  const projected = usage.usedBytes + Math.max(0, additionalBytes);
  if (projected <= usage.freeBytes) return true;
  return usage.overageEnabled;
}

/** Billable GB for Stripe usage records (ceil; min 1 when any overage). */
export function overageGbForBilling(overageBytes: number): number {
  if (overageBytes <= 0) return 0;
  return Math.max(1, Math.ceil(overageBytes / DRIVE_BYTES_PER_GB));
}

export function formatDriveBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < DRIVE_BYTES_PER_GB) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / DRIVE_BYTES_PER_GB).toFixed(2)} GB`;
}
