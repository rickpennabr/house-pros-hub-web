import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase, user: null };
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), supabase, user: null };
  return { error: null, supabase, user };
}

const postSchema = z.object({
  contactId: z.string().uuid(),
  roleId: z.string().uuid(),
});

/** GET /api/crm/projects/[id]/members — people assigned to this job. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { error, supabase, user } = await requireContractor();
    if (error || !user) return error!;
    const { id } = await context.params;
    const { data: project } = await supabase.from('pro_crm_projects').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: members, error: listError } = await supabase
      .from('pro_crm_project_members')
      .select('contact_id, role_id, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: true });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });

    const contactIds = (members ?? []).map((row) => row.contact_id);
    const roleIds = [...new Set((members ?? []).map((row) => row.role_id))];
    const { data: contacts } = contactIds.length
      ? await supabase.from('pro_crm_customers').select('id, first_name, last_name, display_name, email, phone').in('id', contactIds)
      : { data: [] };
    const { data: roles } = roleIds.length
      ? await supabase.from('pro_crm_roles').select('id, name, slug').in('id', roleIds)
      : { data: [] };
    const contactMap = new Map((contacts ?? []).map((row) => [row.id, row]));
    const roleMap = new Map((roles ?? []).map((row) => [row.id, row]));

    return NextResponse.json({
      members: (members ?? []).map((row) => {
        const contact = contactMap.get(row.contact_id);
        const role = roleMap.get(row.role_id);
        const name = contact?.display_name?.trim()
          || [contact?.first_name, contact?.last_name].filter(Boolean).join(' ')
          || 'Contact';
        return {
          contactId: row.contact_id,
          roleId: row.role_id,
          name,
          email: contact?.email ?? null,
          phone: contact?.phone ?? null,
          roleName: role?.name ?? '',
          roleSlug: role?.slug ?? '',
        };
      }),
    });
  } catch {
    return NextResponse.json({ error: 'Could not load the team' }, { status: 500 });
  }
}

/** POST /api/crm/projects/[id]/members — assign an existing contact to this job. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { error, supabase, user } = await requireContractor();
    if (error || !user) return error!;
    const { id } = await context.params;
    const body = postSchema.parse(await request.json());
    const { data: project } = await supabase.from('pro_crm_projects').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data: contact } = await supabase.from('pro_crm_customers').select('id').eq('id', body.contactId).eq('owner_id', user.id).maybeSingle();
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    const { data: role } = await supabase
      .from('pro_crm_roles')
      .select('id, slug')
      .eq('id', body.roleId)
      .or(`owner_id.is.null,owner_id.eq.${user.id}`)
      .maybeSingle();
    if (!role || role.slug === 'customer') return NextResponse.json({ error: 'Choose a team role' }, { status: 400 });

    const { error: insertError } = await supabase
      .from('pro_crm_project_members')
      .upsert({ project_id: id, contact_id: body.contactId, role_id: body.roleId }, { onConflict: 'project_id,contact_id' });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
    return NextResponse.json({ contactId: body.contactId }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Choose a person and a role' }, { status: 400 });
    return NextResponse.json({ error: 'Could not add that person' }, { status: 500 });
  }
}
