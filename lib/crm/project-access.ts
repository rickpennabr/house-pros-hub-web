import { NextResponse } from 'next/server';
import type { CrmScope } from '@/lib/crm/crm-scope';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ScopedProject {
  id: string;
  name: string;
  customer_id: string | null;
  estimate_id: string | null;
  place_id: string | null;
}

/** The project, if it belongs to the signed-in owner (or the owner a crew member works for). */
export async function loadScopedProject(scope: CrmScope, id: string): Promise<ScopedProject | NextResponse> {
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const { data, error } = await scope.supabase
    .from('pro_crm_projects')
    .select('id, name, customer_id, estimate_id, place_id')
    .eq('id', id)
    .eq('owner_id', scope.ownerId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return data as ScopedProject;
}

/** Name shown next to what someone logged: the crew member's name, or "Office" for the owner. */
export async function actorLabel(scope: CrmScope): Promise<string> {
  if (scope.isCrew && scope.crewMemberId) {
    const { data } = await scope.supabase
      .from('business_crew_members')
      .select('display_name, email')
      .eq('id', scope.crewMemberId)
      .maybeSingle();
    const row = data as { display_name?: string | null; email?: string | null } | null;
    return row?.display_name?.trim() || row?.email?.trim() || 'Crew';
  }
  const meta = (scope.user.user_metadata ?? {}) as { first_name?: string; full_name?: string };
  return meta.first_name?.trim() || meta.full_name?.trim() || 'Office';
}

/** Missing tables: the migration has not been run yet. */
export function materialsSchemaMissing(message: string | undefined): boolean {
  return Boolean(message && /pro_crm_project_material|created_by_name|schema cache|does not exist/i.test(message));
}

export const MATERIALS_SETUP_ERROR = 'Run migration 169_project_materials.sql in Supabase before adding materials.';
