import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { ADMIN_EMAIL } from '@/lib/constants/admin'
import {
  createExtraCode,
  ensureSiteCode,
  isHttpUrl,
  loadScanStats,
  qrPublicUrl,
  syncProfessionalCards,
  type QrCodeRow,
} from '@/lib/qr/store'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null }
  }
  return { error: null, user }
}

function view(row: QrCodeRow, ownerName: string) {
  return {
    id: row.id,
    code: row.code,
    url: qrPublicUrl(row.code),
    kind: row.kind,
    label: row.label,
    destination: row.destination,
    scanCount: row.scan_count,
    lastScannedAt: row.last_scanned_at,
    ownerName,
  }
}

const CODE_FIELDS = 'id, code, owner_id, kind, label, destination, scan_count, last_scanned_at, created_at'

/**
 * GET /api/admin/qrcodes
 * Every printed code, plus scan totals. Admin only.
 */
export async function GET() {
  try {
    const { error, user } = await requireAdmin()
    if (error || !user) return error

    const admin = createServiceRoleClient()
    await ensureSiteCode(admin, user.id)
    const { data, error: listError } = await admin
      .from('qr_codes')
      .select(CODE_FIELDS)
      .order('created_at', { ascending: true })
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

    const rows = (data ?? []) as QrCodeRow[]
    const ownerIds = [...new Set(rows.map((row) => row.owner_id).filter((id): id is string => Boolean(id)))]
    const { data: profiles } = ownerIds.length
      ? await admin.from('profiles').select('id, first_name, last_name').in('id', ownerIds)
      : { data: [] }
    const names = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Account',
      ])
    )

    const codes = rows.map((row) =>
      view(row, row.kind === 'site' ? 'House Pros Hub' : names.get(row.owner_id ?? '') || 'House Pros Hub')
    )
    const stats = await loadScanStats(admin)
    return NextResponse.json({ codes, stats })
  } catch (err) {
    console.error('GET /api/admin/qrcodes', err)
    return NextResponse.json({ error: 'QR codes are not ready yet. Apply the qr_codes migration.' }, { status: 500 })
  }
}

/**
 * POST /api/admin/qrcodes
 * action "sync" makes a card for each professional and installer.
 * action "create" adds another code with its own destination.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user } = await requireAdmin()
    if (error || !user) return error
    const body = await request.json().catch(() => ({}))
    const admin = createServiceRoleClient()

    if (body.action === 'sync') {
      const created = await syncProfessionalCards(admin)
      return NextResponse.json({ created })
    }

    const label = typeof body.label === 'string' ? body.label.trim().slice(0, 80) : ''
    const destination = typeof body.destination === 'string' ? body.destination.trim() : ''
    if (!label || !isHttpUrl(destination)) {
      return NextResponse.json({ error: 'Add a name and a full https link.' }, { status: 400 })
    }
    await createExtraCode(admin, user.id, label, destination)
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('POST /api/admin/qrcodes', err)
    return NextResponse.json({ error: 'Could not save the QR code.' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/qrcodes
 * Change where a printed code sends people. The printed mark stays the same.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { error } = await requireAdmin()
    if (error) return error
    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === 'string' ? body.id : ''
    const destination = typeof body.destination === 'string' ? body.destination.trim() : ''
    if (!id || !isHttpUrl(destination)) {
      return NextResponse.json({ error: 'Add a full https link.' }, { status: 400 })
    }
    const admin = createServiceRoleClient()
    const { error: updateError } = await admin.from('qr_codes').update({ destination }).eq('id', id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/qrcodes', err)
    return NextResponse.json({ error: 'Could not update the link.' }, { status: 500 })
  }
}
