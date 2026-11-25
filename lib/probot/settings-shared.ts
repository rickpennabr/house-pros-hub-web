import { z } from 'zod';

/** A pro's morning brief settings (pro_probot_settings). No row = these defaults. Safe in the browser. */
export interface ProbotSettings {
  briefEnabled: boolean;
  /** Local hour; the brief goes out at :30. */
  briefHour: number;
  timeZone: string;
  invoiceDays: number;
  estimateDays: number;
  projectStartDays: number;
  projectCards: boolean;
  pushEnabled: boolean;
}

export const DEFAULT_PROBOT_SETTINGS: ProbotSettings = {
  briefEnabled: true,
  briefHour: 6,
  timeZone: 'America/Los_Angeles',
  invoiceDays: 3,
  estimateDays: 3,
  projectStartDays: 2,
  projectCards: true,
  pushEnabled: true,
};

/** US time zones first; any valid IANA zone is accepted. */
export const PRO_TIME_ZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific (Las Vegas, LA)' },
  { value: 'America/Phoenix', label: 'Arizona' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Chicago', label: 'Central (Chicago, Dallas)' },
  { value: 'America/New_York', label: 'Eastern (New York, Miami)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'America/Sao_Paulo', label: 'Brasília' },
  { value: 'America/Mexico_City', label: 'Mexico City' },
] as const;

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const probotSettingsSchema = z.object({
  briefEnabled: z.boolean(),
  briefHour: z.number().int().min(4).max(11),
  timeZone: z.string().min(3).max(64).refine(isTimeZone, 'Unknown time zone'),
  invoiceDays: z.number().int().min(1).max(30),
  estimateDays: z.number().int().min(1).max(30),
  projectStartDays: z.number().int().min(1).max(14),
  projectCards: z.boolean(),
  pushEnabled: z.boolean(),
});
