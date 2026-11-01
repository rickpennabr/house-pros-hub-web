import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getUserRoles } from '@/lib/utils/roles'

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  const suffix = crypto.randomUUID().slice(0, 8)
  return `${base || 'installer'}-${suffix}`
}

function parseTrades(value: unknown): string[] {
  const raw = Array.isArray(value) ? value.join(',') : String(value ?? '')
  const trades = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 12)
  return trades.map((item) => item.slice(0, 40))
}

/**
 * POST /api/installer/profile
 * Saves the signed-in installer's shareable details. Does not create a directory card.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const roles = await getUserRoles(authData.user.id)
    if (!roles.includes('installer')) {
      return NextResponse.json({ error: 'Installer role required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const trades = parseTrades(body.trades)
    const bio = String(body.bio ?? '').trim().slice(0, 1000)
    const serviceArea = String(body.serviceArea ?? '').trim().slice(0, 120)
    if (trades.length === 0) {
      return NextResponse.json({ error: 'Add at least one trade' }, { status: 400 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone, user_picture')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (profileError) {
      return NextResponse.json({ error: 'Could not read your account' }, { status: 500 })
    }

    const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || 'Installer'
    const service = createServiceRoleClient()
    const { data: existing } = await service
      .from('installer_profiles')
      .select('id, slug')
      .eq('user_id', authData.user.id)
      .maybeSingle()

    const row = {
      display_name: displayName,
      photo_url: profile?.user_picture ?? null,
      phone: profile?.phone ?? null,
      email: authData.user.email ?? null,
      bio: bio || null,
      trades,
      service_area: serviceArea || null,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error } = await service.from('installer_profiles').update(row).eq('id', existing.id)
      if (error) return NextResponse.json({ error: 'Could not save installer profile' }, { status: 500 })
      return NextResponse.json({ slug: existing.slug })
    }

    const slug = slugify(displayName)
    const { error } = await service.from('installer_profiles').insert({
      ...row,
      user_id: authData.user.id,
      slug,
    })
    if (error) return NextResponse.json({ error: 'Could not save installer profile' }, { status: 500 })
    return NextResponse.json({ slug })
  } catch {
    return NextResponse.json({ error: 'Could not save installer profile' }, { status: 500 })
  }
}
