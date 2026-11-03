import { NextRequest } from 'next/server'
import { redirectForQrScan } from '@/lib/qr/handle-scan'

/**
 * GET /q/:code
 * Counts a scan, then sends the phone to the code's current destination.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params
  return redirectForQrScan(request, code)
}
