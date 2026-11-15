import { createServiceRoleClient } from '@/lib/supabase/server';
import { MAIN_MENU_KEYS, normalizeMainMenuOrder, type MainMenuKey } from '@/lib/constants/mainMenu';

const SETTING_KEY = 'main_menu_order';

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /site_settings/i.test(error.message ?? '');
}

export async function readMainMenuOrder(): Promise<{ order: MainMenuKey[]; ready: boolean }> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('site_settings')
    .select('value')
    .eq('key', SETTING_KEY)
    .maybeSingle();
  if (error) {
    if (!missingTable(error)) console.error('readMainMenuOrder', error.message);
    return { order: [...MAIN_MENU_KEYS], ready: !missingTable(error) };
  }
  return { order: normalizeMainMenuOrder(data?.value), ready: true };
}

export async function writeMainMenuOrder(order: MainMenuKey[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const service = createServiceRoleClient();
  const { error } = await service.from('site_settings').upsert(
    { key: SETTING_KEY, value: order, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) {
    if (missingTable(error)) {
      return { ok: false, error: 'Apply migration 126_main_menu_order.sql, then save again.' };
    }
    return { ok: false, error: error.message || 'Could not save the menu order' };
  }
  return { ok: true };
}
