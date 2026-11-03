import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { deviceFromAgent, isScanBot, publicOrigin, visitorHash } from '@/lib/qr/store'

/** Count a scan, then send the phone to the code's current destination. */
export async function redirectForQrScan(request: NextRequest, code: string): Promise<NextResponse> {
  const admin = createServiceRoleClient()
  const userAgent = request.headers.get('user-agent') ?? ''
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || '0'

  let destination: string | null = null
  if (!isScanBot(userAgent)) {
    const { data, error } = await admin.rpc('record_qr_scan', {
      p_code: code,
      p_device: deviceFromAgent(userAgent),
      p_visitor: visitorHash(ip, userAgent),
    })
    if (!error && data) destination = data
  }

  if (!destination) {
    const { data } = await admin.from('qr_codes').select('destination').eq('code', code).maybeSingle()
    destination = data?.destination ?? null
  }

  if (!destination) {
    return NextResponse.redirect(`${publicOrigin()}/`, 302)
  }
  return NextResponse.redirect(destination, 302)
}
