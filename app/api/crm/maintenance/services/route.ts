import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import {
  ensureDefaultMaintenanceServices,
  mapServiceOption,
} from '@/lib/crm/maintenance-visits-db';

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  descriptionTemplate: z.string().trim().max(500).optional(),
});

/**
 * GET /api/crm/maintenance/services
 * List (and seed) landscape maintenance service chips for the business owner.
 */
export async function GET() {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;

    await ensureDefaultMaintenanceServices(scope.supabase, scope.ownerId);

    const { data, error: queryError } = await scope.supabase
      .from('pro_crm_maintenance_service_options')
      .select('id, name, description_template, sort_order, is_active, is_default_seed')
      .eq('owner_id', scope.ownerId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    return NextResponse.json({
      services: (data ?? []).map(mapServiceOption),
    });
  } catch (error) {
    console.error('GET /api/crm/maintenance/services', error);
    return NextResponse.json({ error: 'Failed to load services' }, { status: 500 });
  }
}

/**
 * POST /api/crm/maintenance/services
 * Add a custom chip; it becomes available on future visits.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    if (scope.isCrew) {
      return NextResponse.json({ error: 'Only the business owner can add services' }, { status: 403 });
    }

    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid service' }, { status: 400 });
    }

    await ensureDefaultMaintenanceServices(scope.supabase, scope.ownerId);

    const { data: existing } = await scope.supabase
      .from('pro_crm_maintenance_service_options')
      .select('id, name, description_template, sort_order, is_active, is_default_seed')
      .eq('owner_id', scope.ownerId)
      .ilike('name', parsed.data.name)
      .maybeSingle();

    if (existing) {
      if (!existing.is_active) {
        const { data: revived, error: reviveError } = await scope.supabase
          .from('pro_crm_maintenance_service_options')
          .update({
            is_active: true,
            description_template: parsed.data.descriptionTemplate?.trim() || existing.description_template,
          })
          .eq('id', existing.id)
          .select('id, name, description_template, sort_order, is_active, is_default_seed')
          .single();
        if (reviveError || !revived) {
          return NextResponse.json({ error: reviveError?.message ?? 'Could not restore service' }, { status: 500 });
        }
        return NextResponse.json({ service: mapServiceOption(revived) });
      }
      return NextResponse.json({ service: mapServiceOption(existing) });
    }

    const { data: maxRow } = await scope.supabase
      .from('pro_crm_maintenance_service_options')
      .select('sort_order')
      .eq('owner_id', scope.ownerId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const description =
      parsed.data.descriptionTemplate?.trim() ||
      `Completed ${parsed.data.name.toLowerCase()} as part of the maintenance visit.`;

    const { data, error: insertError } = await scope.supabase
      .from('pro_crm_maintenance_service_options')
      .insert({
        owner_id: scope.ownerId,
        name: parsed.data.name,
        description_template: description,
        sort_order: (maxRow?.sort_order ?? 200) + 10,
        is_active: true,
        is_default_seed: false,
      })
      .select('id, name, description_template, sort_order, is_active, is_default_seed')
      .single();

    if (insertError || !data) {
      return NextResponse.json({ error: insertError?.message ?? 'Could not create service' }, { status: 500 });
    }

    return NextResponse.json({ service: mapServiceOption(data) }, { status: 201 });
  } catch (error) {
    console.error('POST /api/crm/maintenance/services', error);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}
