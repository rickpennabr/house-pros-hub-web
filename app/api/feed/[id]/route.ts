import { NextRequest, NextResponse } from 'next/server';
import { getFeedViewer, setFeedVisibility } from '@/lib/feed/server';

const VISIBILITIES = ['public', 'pending', 'hidden'] as const;
type Visibility = (typeof VISIBILITIES)[number];

/**
 * PATCH /api/feed/[id]  { visibility }
 * Admin: approve (public), send back (pending) or hide. Anyone in the item: hide only.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { visibility?: unknown } | null;
  const visibility = body?.visibility;
  if (typeof visibility !== 'string' || !(VISIBILITIES as readonly string[]).includes(visibility)) {
    return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 });
  }
  try {
    const viewer = await getFeedViewer();
    const status = await setFeedVisibility(viewer, id, visibility as Visibility);
    if (status === 200) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: 'Not allowed' }, { status });
  } catch (err) {
    console.error('PATCH /api/feed/[id]', err);
    return NextResponse.json({ error: 'Could not update' }, { status: 500 });
  }
}
