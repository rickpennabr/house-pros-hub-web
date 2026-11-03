import type { createServiceRoleClient } from '@/lib/supabase/server';
import type { ProInviter } from '@/lib/pros/inviter';

type Admin = ReturnType<typeof createServiceRoleClient>;

const PAGE = 1000;
const CHUNK = 150;
const RESERVED = new Set(['my friend', 'other']);

interface RoleRow {
  user_id: string;
}

interface BusinessRow {
  id: string;
  owner_id: string;
  business_name: string | null;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface InstallerRow {
  user_id: string;
  display_name: string | null;
}

function personName(first: string | null | undefined, last: string | null | undefined): string {
  return [first, last]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

function clean(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

async function eachPage<T>(
  load: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await load(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

/**
 * Contractors, realtors, and installers, plus every active business.
 * A pro with a business is listed as "Rick Penna - The Paver Pro".
 */
export async function listProInviters(admin: Admin): Promise<ProInviter[]> {
  const [roles, businesses] = await Promise.all([
    eachPage<RoleRow>((from, to) =>
      admin
        .from('user_roles')
        .select('user_id')
        .in('role', ['contractor', 'realtor', 'installer'])
        .eq('is_active', true)
        .range(from, to),
    ),
    eachPage<BusinessRow>((from, to) =>
      admin
        .from('businesses')
        .select('id, owner_id, business_name')
        .eq('is_active', true)
        .range(from, to),
    ),
  ]);

  let installers: InstallerRow[] = [];
  try {
    installers = await eachPage<InstallerRow>((from, to) =>
      admin.from('installer_profiles').select('user_id, display_name').range(from, to),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!/installer_profiles|does not exist|schema cache/i.test(message)) throw error;
  }

  const proIds = new Set<string>();
  for (const role of roles) proIds.add(role.user_id);
  for (const installer of installers) proIds.add(installer.user_id);

  const profileIds = new Set<string>(proIds);
  for (const business of businesses) profileIds.add(business.owner_id);

  const profiles: ProfileRow[] = [];
  const ids = [...profileIds];
  for (let index = 0; index < ids.length; index += CHUNK) {
    const chunk = ids.slice(index, index + CHUNK);
    const { data, error } = await admin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', chunk);
    if (error) throw new Error(error.message);
    profiles.push(...(data ?? []));
  }

  const nameOf = new Map(profiles.map((profile) => [profile.id, personName(profile.first_name, profile.last_name)]));
  const installerName = new Map(
    installers.map((installer) => [installer.user_id, clean(installer.display_name)]),
  );
  const ownersWithBusiness = new Set(businesses.map((business) => business.owner_id));

  const inviters: ProInviter[] = [];
  const seen = new Set<string>();

  const add = (id: string, label: string) => {
    const next = clean(label);
    const key = next.toLowerCase();
    if (!next || RESERVED.has(key) || seen.has(key)) return;
    seen.add(key);
    inviters.push({ id, label: next });
  };

  for (const business of businesses) {
    const businessName = clean(business.business_name);
    if (!businessName) continue;
    const person = nameOf.get(business.owner_id) ?? '';
    const sameName = person.toLowerCase() === businessName.toLowerCase();
    add(`business:${business.id}`, person && !sameName ? `${person} - ${businessName}` : (person || businessName));
  }

  for (const userId of proIds) {
    if (ownersWithBusiness.has(userId)) continue;
    const person = nameOf.get(userId) ?? '';
    const display = installerName.get(userId) ?? '';
    if (display && display.toLowerCase() !== person.toLowerCase()) {
      add(`user:${userId}`, person ? `${person} - ${display}` : display);
    } else {
      add(`user:${userId}`, person || display);
    }
  }

  inviters.sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));
  return inviters;
}
