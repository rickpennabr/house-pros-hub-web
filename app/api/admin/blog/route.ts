import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { blogPostWriteSchema } from '@/lib/schemas/blog';
import { isMissingBlogStorage, requireAdmin } from '@/lib/blog/admin';

/**
 * GET /api/admin/blog
 * List every blog post, including drafts. Admin only.
 */
export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('blog_posts')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('GET /api/admin/blog', error);
    if (isMissingBlogStorage(error)) {
      return NextResponse.json(
        { error: 'Blog storage is not ready. Apply supabase/migrations/082_blog_posts.sql.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to load blog posts' }, { status: 500 });
  }

  return NextResponse.json({ posts: data ?? [] });
}

/**
 * POST /api/admin/blog
 * Create a blog post. Admin only.
 */
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = blogPostWriteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid blog post' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('blog_posts')
    .insert({
      locale: parsed.data.locale,
      slug: parsed.data.slug,
      title: parsed.data.title,
      excerpt: parsed.data.excerpt,
      body: parsed.data.body,
      category: parsed.data.category,
      region: parsed.data.region,
      cover_image_url: parsed.data.cover_image_url ? parsed.data.cover_image_url : null,
      published: parsed.data.published,
      published_at: parsed.data.published ? now : null,
    })
    .select('*')
    .single();

  if (error || !data) {
    console.error('POST /api/admin/blog', error);
    if (isMissingBlogStorage(error)) {
      return NextResponse.json(
        { error: 'Blog storage is not ready. Apply supabase/migrations/082_blog_posts.sql.' },
        { status: 503 }
      );
    }
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'A post with this slug already exists for that language.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to create blog post' }, { status: 500 });
  }

  return NextResponse.json({ post: data }, { status: 201 });
}
