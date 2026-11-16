import os from 'node:os';
import { NextResponse } from 'next/server';

/**
 * Dev-only helpers for phone Google OAuth.
 * Supabase ignores raw IP redirectTo values (falls back to Site URL / production).
 * Phones need a hostname. Prefer mDNS `.local` (no public DNS) then sslip/nip.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const port = process.env.PORT || '3000';
  const protocol = 'http';
  const hosts: string[] = [];

  const configured = process.env.NEXT_PUBLIC_DEV_LAN_ORIGIN?.trim();
  if (configured) hosts.push(configured.replace(/\/$/, ''));

  const machine = os.hostname().split('.')[0];
  if (machine) {
    hosts.push(`${protocol}://${machine}.local:${port}`);
  }

  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        const ip = addr.address;
        hosts.push(`${protocol}://${ip.replace(/\./g, '-')}.sslip.io:${port}`);
        hosts.push(`${protocol}://${ip}.nip.io:${port}`);
      }
    }
  }

  return NextResponse.json({
    origins: [...new Set(hosts)],
    hint: 'Add each origin under Google Authorized JavaScript origins and Supabase Redirect URLs (http://host:3000/**). Open the phone on a hostname URL, not a raw IP.',
  });
}
