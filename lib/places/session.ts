import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PortalUser } from '@/lib/places/portal';

export function deny(error: NextResponse | null): NextResponse {
  return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export async function requirePortalUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null, supabase };
  }
  const portalUser: PortalUser = {
    id: user.id,
    email: user.email,
    email_confirmed_at: user.email_confirmed_at ?? null,
  };
  return { error: null, user: portalUser, supabase };
}

export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export function cleanDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}
