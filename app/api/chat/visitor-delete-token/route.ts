import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { getUnreadCountQuerySchema } from '@/lib/schemas/chat';
import { signVisitorDeleteToken } from '@/lib/utils/chatVisitorToken';

/**
 * POST /api/chat/visitor-delete-token
 * Body: { visitorId }
 * Returns a short-lived token that can be sent with DELETE /api/chat/conversations/delete for extra verification.
 * Optional: when token is sent with delete, it is verified so possession of visitorId alone is not enough.
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = getUnreadCountQuerySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'visitorId is required' }, { status: 400 });
    }
    const { visitorId } = parsed.data;

    const token = signVisitorDeleteToken(visitorId);
    return NextResponse.json({ token, expiresInSeconds: 300 }, { status: 200 });
  } catch (e) {
    console.error('ProBot visitor-delete-token error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
