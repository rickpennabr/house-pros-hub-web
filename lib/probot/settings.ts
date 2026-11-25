import { createServiceRoleClient } from '@/lib/supabase/server';
import type { CrmDb } from '@/lib/crm/crm-scope';
import { DEFAULT_PROBOT_SETTINGS, isTimeZone, type ProbotSettings } from '@/lib/probot/settings-shared';

export { DEFAULT_PROBOT_SETTINGS, PRO_TIME_ZONES, isTimeZone, probotSettingsSchema, type ProbotSettings } from '@/lib/probot/settings-shared';

interface Row {
  owner_id: string;
  brief_enabled: boolean;
  brief_hour: number;
  time_zone: string;
  invoice_days: number;
  estimate_days: number;
  project_start_days: number;
  project_cards: boolean;
  push_enabled: boolean;
}

export function settingsFromRow(row: Row | null | undefined): ProbotSettings {
  if (!row) return { ...DEFAULT_PROBOT_SETTINGS };
  return {
    briefEnabled: row.brief_enabled,
    briefHour: row.brief_hour,
    timeZone: isTimeZone(row.time_zone) ? row.time_zone : DEFAULT_PROBOT_SETTINGS.timeZone,
    invoiceDays: row.invoice_days,
    estimateDays: row.estimate_days,
    projectStartDays: row.project_start_days,
    projectCards: row.project_cards,
    pushEnabled: row.push_enabled,
  };
}

export function settingsToRow(ownerId: string, settings: ProbotSettings) {
  return {
    owner_id: ownerId,
    brief_enabled: settings.briefEnabled,
    brief_hour: settings.briefHour,
    time_zone: settings.timeZone,
    invoice_days: settings.invoiceDays,
    estimate_days: settings.estimateDays,
    project_start_days: settings.projectStartDays,
    project_cards: settings.projectCards,
    push_enabled: settings.pushEnabled,
    updated_at: new Date().toISOString(),
  };
}

const SELECT = 'owner_id, brief_enabled, brief_hour, time_zone, invoice_days, estimate_days, project_start_days, project_cards, push_enabled';

/** Settings for many pros at once; a missing table or row gives the defaults. */
export async function loadProbotSettings(ownerIds: string[]): Promise<Map<string, ProbotSettings>> {
  const result = new Map(ownerIds.map((id) => [id, { ...DEFAULT_PROBOT_SETTINGS }]));
  if (ownerIds.length === 0) return result;
  const db = createServiceRoleClient() as unknown as CrmDb;
  for (let index = 0; index < ownerIds.length; index += 500) {
    const { data, error } = await db.from('pro_probot_settings').select(SELECT).in('owner_id', ownerIds.slice(index, index + 500));
    if (error) return result;
    for (const row of (data ?? []) as Row[]) result.set(row.owner_id, settingsFromRow(row));
  }
  return result;
}

export async function loadProbotSettingsFor(ownerId: string): Promise<ProbotSettings> {
  return (await loadProbotSettings([ownerId])).get(ownerId) ?? { ...DEFAULT_PROBOT_SETTINGS };
}
