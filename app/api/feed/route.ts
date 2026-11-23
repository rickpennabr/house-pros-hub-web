import { NextRequest, NextResponse } from 'next/server';
import { getFeedViewer, loadFeedPage } from '@/lib/feed/server';
import { FEED_FILTERS, type FeedFilter, type FeedScope } from '@/lib/feed/types';

/**
 * GET /api/feed?scope=local|all&filter=all|projects|estimates|repairs|reviews|members&cursor=
 * The public Hub Feed, newest first. Admins also get photo days waiting for approval.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const scope: FeedScope = params.get('scope') === 'all' ? 'all' : 'local';
  const rawFilter = params.get('filter') ?? 'all';
  const filter: FeedFilter = (FEED_FILTERS as readonly string[]).includes(rawFilter) ? (rawFilter as FeedFilter) : 'all';
  try {
    const viewer = await getFeedViewer();
    const page = await loadFeedPage({ viewer, scope, filter, cursor: params.get('cursor') });
    return NextResponse.json(page, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('GET /api/feed', err);
    return NextResponse.json({ error: 'Could not load the feed' }, { status: 500 });
  }
}
