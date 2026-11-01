import { NextRequest, NextResponse } from 'next/server';
import {
  VISITOR_COOKIE_TTL_MS,
  readSignedVisitorId,
  signVisitorCapability,
} from '@/lib/utils/chatVisitorToken';

export const VISITOR_COOKIE_NAME = 'hph_visitor';

const COOKIE_MAX_AGE_SECONDS = Math.floor(VISITOR_COOKIE_TTL_MS / 1000);

export function readVisitorIdFromCookie(request: NextRequest): string | null {
  const raw = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
  if (!raw) return null;
  return readSignedVisitorId(raw);
}

export function attachVisitorCookie(response: NextResponse, visitorId: string): void {
  response.cookies.set(VISITOR_COOKIE_NAME, signVisitorCapability(visitorId, VISITOR_COOKIE_TTL_MS), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** Visitor chat actions require the httpOnly cookie issued for this visitor id. */
export function visitorCookieDenied(request: NextRequest, visitorId: string): NextResponse | null {
  const cookieVisitorId = readVisitorIdFromCookie(request);
  if (!cookieVisitorId || cookieVisitorId !== visitorId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
