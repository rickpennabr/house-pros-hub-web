import { NextRequest } from 'next/server'
import { redirectForQrScan } from '@/lib/qr/handle-scan'

/**
 * GET /:locale/q/:code
 * The locale middleware sends /q/:code here. Same scan and redirect as /q/:code.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params
  return redirectForQrScan(request, code)
}
