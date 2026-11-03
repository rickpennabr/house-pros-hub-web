import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/supabase'
import type { QrDevice, ScanStats } from '@/lib/qr/types'
import { publicOrigin } from '@/lib/qr/public-origin'

export { publicOrigin }

type Admin = SupabaseClient<Database>
export type QrKind = 'site' | 'card' | 'extra'
export type { QrDevice, ScanStats }

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface QrCodeRow {
  id: string
  code: string
  owner_id: string | null
  kind: QrKind
  label: string
  destination: string
  scan_count: number
  last_scanned_at: string | null
  created_at: string
}

export function qrPublicUrl(code: string): string {
  return `${publicOrigin()}/q/${code}`
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function deviceFromAgent(userAgent: string): QrDevice {
  const ua = userAgent.toLowerCase()
  if (/ipad|tablet|playbook|silk/.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod|android/.test(ua)) return 'phone'
  return 'computer'
}

export function isScanBot(userAgent: string): boolean {
  return /bot|spider|crawl|preview|facebookexternalhit|whatsapp|slackbot|telegrambot/i.test(userAgent)
}

export function visitorHash(ip: string, userAgent: string): string {
  return createHash('sha256').update(`${ip}|${userAgent}`).digest('hex').slice(0, 32)
}

function newCode(): string {
  let code = ''
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length]
  return code.slice(0, 7)
}

async function insertCode(
  admin: Admin,
  row: { owner_id: string | null; kind: QrKind; label: string; destination: string }
): Promise<QrCodeRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from('qr_codes')
      .insert({ ...row, code: newCode() })
      .select('id, code, owner_id, kind, label, destination, scan_count, last_scanned_at, created_at')
      .single()
    if (!error && data) return data as QrCodeRow
    if (error && error.code !== '23505') throw new Error(error.message)
  }
  throw new Error('Could not create a QR code')
}

export async function ensureSiteCode(admin: Admin, ownerId: string): Promise<QrCodeRow> {
  const { data } = await admin
    .from('qr_codes')
    .select('id, code, owner_id, kind, label, destination, scan_count, last_scanned_at, created_at')
    .eq('kind', 'site')
    .maybeSingle()
  if (data) return data as QrCodeRow
  try {
    return await insertCode(admin, {
      owner_id: ownerId,
      kind: 'site',
      label: 'House Pros Hub card',
      destination: `${publicOrigin()}/`,
    })
  } catch {
    const { data: again, error } = await admin
      .from('qr_codes')
      .select('id, code, owner_id, kind, label, destination, scan_count, last_scanned_at, created_at')
      .eq('kind', 'site')
      .single()
    if (error || !again) throw new Error(error?.message || 'Could not create the site QR code')
    return again as QrCodeRow
  }
}

export async function defaultCardDestination(admin: Admin, userId: string): Promise<string> {
  const { data } = await admin
    .from('businesses')
    .select('slug')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const slug = data?.slug?.trim()
  if (slug) return `${publicOrigin()}/en/business/${slug}`
  return `${publicOrigin()}/`
}

export async function ensureOwnerCard(admin: Admin, userId: string, label: string): Promise<QrCodeRow> {
  const { data } = await admin
    .from('qr_codes')
    .select('id, code, owner_id, kind, label, destination, scan_count, last_scanned_at, created_at')
    .eq('owner_id', userId)
    .eq('kind', 'card')
    .maybeSingle()
  if (data) return data as QrCodeRow
  const destination = await defaultCardDestination(admin, userId)
  try {
    return await insertCode(admin, {
      owner_id: userId,
      kind: 'card',
      label: label.slice(0, 80) || 'My card',
      destination,
    })
  } catch {
    const { data: again, error } = await admin
      .from('qr_codes')
      .select('id, code, owner_id, kind, label, destination, scan_count, last_scanned_at, created_at')
      .eq('owner_id', userId)
      .eq('kind', 'card')
      .single()
    if (error || !again) throw new Error(error?.message || 'Could not create the card QR code')
    return again as QrCodeRow
  }
}

export async function createExtraCode(
  admin: Admin,
  ownerId: string,
  label: string,
  destination: string
): Promise<QrCodeRow> {
  return insertCode(admin, { owner_id: ownerId, kind: 'extra', label, destination })
}

/** One card each for contractors, realtors, and installers who do not have one yet. */
export async function syncProfessionalCards(admin: Admin): Promise<number> {
  const { data: roles, error: roleError } = await admin
    .from('user_roles')
    .select('user_id, role')
    .in('role', ['contractor', 'realtor', 'installer'])
    .eq('is_active', true)
  if (roleError) throw new Error(roleError.message)

  const userIds = [...new Set((roles ?? []).map((role) => role.user_id))]
  const { data: existing } = await admin.from('qr_codes').select('owner_id').eq('kind', 'card')
  const have = new Set((existing ?? []).map((row) => row.owner_id))
  const missing = userIds.filter((id) => !have.has(id))
  if (missing.length === 0) return 0

  const [{ data: profiles }, { data: businesses }] = await Promise.all([
    admin.from('profiles').select('id, first_name, last_name').in('id', missing),
    admin.from('businesses').select('owner_id, slug').in('owner_id', missing).eq('is_active', true),
  ])
  const nameOf = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      [profile.first_name, profile.last_name].filter(Boolean).join(' ').slice(0, 80) || 'Card',
    ])
  )
  const slugOf = new Map<string, string>()
  for (const business of businesses ?? []) {
    if (!slugOf.has(business.owner_id) && business.slug) slugOf.set(business.owner_id, business.slug)
  }

  let created = 0
  for (const ownerId of missing) {
    const slug = slugOf.get(ownerId)
    try {
      await insertCode(admin, {
        owner_id: ownerId,
        kind: 'card',
        label: nameOf.get(ownerId) || 'Card',
        destination: slug ? `${publicOrigin()}/en/business/${slug}` : `${publicOrigin()}/`,
      })
      created += 1
    } catch {
      // A card created in the same moment is already enough.
    }
  }
  return created
}

export async function loadScanStats(admin: Admin, qrCodeId?: string): Promise<ScanStats> {
  const start = new Date()
  start.setUTCDate(start.getUTCDate() - 29)
  start.setUTCHours(0, 0, 0, 0)

  let query = admin
    .from('qr_scans')
    .select('scanned_at, device, visitor_hash, qr_code_id')
    .gte('scanned_at', start.toISOString())
  if (qrCodeId) query = query.eq('qr_code_id', qrCodeId)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const now = new Date()
  const todayKey = now.toISOString().slice(0, 10)
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000
  const byDevice: Record<QrDevice, number> = { phone: 0, tablet: 0, computer: 0 }
  const dayCounts = new Map<string, number>()
  const visitors = new Set<string>()
  let today = 0
  let days7 = 0

  for (let i = 0; i < 14; i++) {
    const day = new Date()
    day.setUTCDate(day.getUTCDate() - (13 - i))
    dayCounts.set(day.toISOString().slice(0, 10), 0)
  }

  for (const row of rows) {
    const when = new Date(row.scanned_at)
    const key = when.toISOString().slice(0, 10)
    if (key === todayKey) today += 1
    if (when.getTime() >= weekAgo) days7 += 1
    const device = row.device as QrDevice
    if (device in byDevice) byDevice[device] += 1
    if (dayCounts.has(key)) dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1)
    if (row.visitor_hash) visitors.add(row.visitor_hash)
  }

  let total = rows.length
  if (qrCodeId) {
    const { data: code } = await admin.from('qr_codes').select('scan_count').eq('id', qrCodeId).maybeSingle()
    total = code?.scan_count ?? total
  } else {
    const { data: codes } = await admin.from('qr_codes').select('scan_count')
    total = (codes ?? []).reduce((sum, code) => sum + (code.scan_count ?? 0), 0)
  }

  return {
    total,
    today,
    days7,
    days30: rows.length,
    unique30: visitors.size,
    byDevice,
    days: [...dayCounts.entries()].map(([date, count]) => ({ date, count })),
  }
}
