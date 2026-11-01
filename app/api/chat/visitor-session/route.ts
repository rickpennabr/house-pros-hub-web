import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { attachVisitorCookie, readVisitorIdFromCookie } from '@/lib/utils/chatVisitorCookie';

/**
 * POST /api/chat/visitor-session
 * Issues the httpOnly visitor cookie. The visitor id is chosen by the server.
 * Body: { rotate?: boolean } replaces an existing cookie with a new id.
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  const body = await request.json().catch(() => ({}));
  const rotate = body?.rotate === true;
  const existing = readVisitorIdFromCookie(request);

  if (existing && !rotate) {
    return NextResponse.json({ visitorId: existing });
  }

  const visitorId = crypto.randomUUID();
  const response = NextResponse.json({ visitorId });
  attachVisitorCookie(response, visitorId);
  return response;
}
