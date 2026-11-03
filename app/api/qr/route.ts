import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { getUserRoles } from '@/lib/utils/roles'
import { ensureOwnerCard, isHttpUrl, loadScanStats, qrPublicUrl, type QrCodeRow } from '@/lib/qr/store'

/**
 * GET /api/qr
 * The signed-in professional or installer's card code and scan counts.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roles = await getUserRoles(user.id)
    const allowed = roles.includes('contractor') || roles.includes('realtor') || roles.includes('installer')
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createServiceRoleClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .maybeSingle()
    const label = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'My card'
    const row = await ensureOwnerCard(admin, user.id, label)
    const stats = await loadScanStats(admin, row.id)
    return NextResponse.json({
      code: {
        id: row.id,
        url: qrPublicUrl(row.code),
        label: row.label,
        destination: row.destination,
        scanCount: row.scan_count,
        lastScannedAt: row.last_scanned_at,
      },
      stats,
    })
  } catch (err) {
    console.error('GET /api/qr', err)
    return NextResponse.json({ error: 'QR codes are not ready yet. Apply the qr_codes migration.' }, { status: 500 })
  }
}

/**
 * PATCH /api/qr
 * Change where this person's printed card sends people.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const roles = await getUserRoles(user.id)
    const allowed = roles.includes('contractor') || roles.includes('realtor') || roles.includes('installer')
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const destination = typeof body.destination === 'string' ? body.destination.trim() : ''
    if (!isHttpUrl(destination)) {
      return NextResponse.json({ error: 'Add a full https link.' }, { status: 400 })
    }

    const admin = createServiceRoleClient()
    const { data: row } = await admin
      .from('qr_codes')
      .select('id')
      .eq('owner_id', user.id)
      .eq('kind', 'card')
      .maybeSingle()
    if (!row) return NextResponse.json({ error: 'No card yet.' }, { status: 404 })

    const { error } = await admin.from('qr_codes').update({ destination }).eq('id', row.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/qr', err)
    return NextResponse.json({ error: 'Could not update the link.' }, { status: 500 })
  }
}
