import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { blogPostWriteSchema } from '@/lib/schemas/blog';
import { isMissingBlogStorage, requireAdmin } from '@/lib/blog/admin';

const idSchema = z.string().uuid();

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/blog/[id]
 * Load one blog post, including drafts. Admin only.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('blog_posts')
    .select('*')
    .eq('id', parsedId.data)
    .maybeSingle();

  if (error) {
    console.error('GET /api/admin/blog/[id]', error);
    if (isMissingBlogStorage(error)) {
      return NextResponse.json(
        { error: 'Blog storage is not ready. Apply supabase/migrations/082_blog_posts.sql.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to load blog post' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
  }

  return NextResponse.json({ post: data });
}

/**
 * PATCH /api/admin/blog/[id]
 * Update a blog post. Admin only.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
  }

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

  const service = createServiceRoleClient();
  const existing = await service
    .from('blog_posts')
    .select('id, published_at')
    .eq('id', parsedId.data)
    .maybeSingle();

  if (existing.error) {
    console.error('PATCH /api/admin/blog/[id] lookup', existing.error);
    if (isMissingBlogStorage(existing.error)) {
      return NextResponse.json(
        { error: 'Blog storage is not ready. Apply supabase/migrations/082_blog_posts.sql.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to update blog post' }, { status: 500 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
  }

  const publishedAt = parsed.data.published
    ? (existing.data.published_at ?? new Date().toISOString())
    : existing.data.published_at;

  const { data, error } = await service
    .from('blog_posts')
    .update({
      locale: parsed.data.locale,
      slug: parsed.data.slug,
      title: parsed.data.title,
      excerpt: parsed.data.excerpt,
      body: parsed.data.body,
      category: parsed.data.category,
      region: parsed.data.region,
      cover_image_url: parsed.data.cover_image_url ? parsed.data.cover_image_url : null,
      published: parsed.data.published,
      published_at: publishedAt,
    })
    .eq('id', parsedId.data)
    .select('*')
    .single();

  if (error || !data) {
    console.error('PATCH /api/admin/blog/[id]', error);
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'A post with this slug already exists for that language.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to update blog post' }, { status: 500 });
  }

  return NextResponse.json({ post: data });
}

/**
 * DELETE /api/admin/blog/[id]
 * Delete a blog post. Admin only.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id } = await context.params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: 'Invalid post id' }, { status: 400 });
  }

  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('blog_posts')
    .delete()
    .eq('id', parsedId.data)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('DELETE /api/admin/blog/[id]', error);
    if (isMissingBlogStorage(error)) {
      return NextResponse.json(
        { error: 'Blog storage is not ready. Apply supabase/migrations/082_blog_posts.sql.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Failed to delete blog post' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
