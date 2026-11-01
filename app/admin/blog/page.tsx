'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import { AdminFloatingAddButton } from '@/components/admin/AdminFloatingAddButton';
import { slugifyBlogTitle } from '@/lib/blog/format';
import type { BlogPost } from '@/lib/blog/types';

interface BlogFormState {
  locale: 'en' | 'es' | 'pt';
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category: 'hardscape' | 'landscape';
  region: string;
  cover_image_url: string;
  published: boolean;
}

const emptyForm: BlogFormState = {
  locale: 'en',
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  category: 'hardscape',
  region: 'Las Vegas Valley',
  cover_image_url: '',
  published: false,
};

const fieldClass = 'mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-sm';

function postToForm(post: BlogPost): BlogFormState {
  return {
    locale: post.locale,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    category: post.category,
    region: post.region,
    cover_image_url: post.cover_image_url ?? '',
    published: post.published,
  };
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BlogFormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/blog', { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to load blog posts');
      setPosts(data.posts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSlugTouched(false);
    setError(null);
    setEditorOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm(postToForm(post));
    setSlugTouched(true);
    setError(null);
    setEditorOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editingId ? `/api/admin/blog/${editingId}` : '/api/admin/blog', {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to save blog post');
      setEditorOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save blog post');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/blog/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete blog post');
      setConfirmDeleteId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete blog post');
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-semibold text-black">Blog</h1>
          <p className="text-gray-600">
            Write ProsBlog articles. Published posts show up as cards on the public blog.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="cursor-pointer rounded-lg border-2 border-black bg-black px-4 py-2 font-medium text-white hover:bg-gray-800"
        >
          New article
        </button>
      </div>

      <AdminFloatingAddButton onClick={openCreate} ariaLabel="New article" />

      {error && !editorOpen && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-600">Loading…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-gray-600">No articles yet.</p>
      ) : (
        <ul className="divide-y-2 divide-black rounded-lg border-2 border-black bg-white">
          {posts.map((post) => (
            <li key={post.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-black">{post.title}</p>
                <p className="text-sm text-gray-600">
                  {post.category} · {post.region} · {post.locale}
                  {post.published ? ' · Published' : ' · Draft'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {post.published && (
                  <Link
                    href={`/${post.locale}/blog/${post.slug}`}
                    className="rounded-lg border-2 border-black px-3 py-1.5 text-sm font-medium"
                  >
                    View
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => openEdit(post)}
                  className="cursor-pointer rounded-lg border-2 border-black px-3 py-1.5 text-sm font-medium"
                >
                  Edit
                </button>
                {confirmDeleteId === post.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void remove(post.id)}
                      className="cursor-pointer rounded-lg border-2 border-black bg-black px-3 py-1.5 text-sm text-white"
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="cursor-pointer rounded-lg border-2 border-black px-3 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(post.id)}
                    className="cursor-pointer rounded-lg border-2 border-black px-3 py-1.5 text-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? 'Edit article' : 'New article'}
        maxWidth="2xl"
        contentClassName="p-4"
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-black">
              Language
              <select
                value={form.locale}
                onChange={(event) =>
                  setForm((current) => ({ ...current, locale: event.target.value as BlogFormState['locale'] }))
                }
                className={fieldClass}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="pt">Portuguese</option>
              </select>
            </label>
            <label className="text-sm font-medium text-black">
              Category
              <select
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value as BlogFormState['category'],
                  }))
                }
                className={fieldClass}
              >
                <option value="hardscape">Hardscape</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
          </div>

          <label className="text-sm font-medium text-black">
            Title
            <input
              value={form.title}
              required
              maxLength={180}
              onChange={(event) => {
                const title = event.target.value;
                setForm((current) => ({
                  ...current,
                  title,
                  slug: slugTouched ? current.slug : slugifyBlogTitle(title),
                }));
              }}
              className={fieldClass}
            />
          </label>

          <label className="text-sm font-medium text-black">
            Slug
            <input
              value={form.slug}
              required
              maxLength={160}
              onChange={(event) => {
                setSlugTouched(true);
                setForm((current) => ({ ...current, slug: event.target.value }));
              }}
              className={fieldClass}
            />
          </label>

          <label className="text-sm font-medium text-black">
            Region
            <input
              value={form.region}
              required
              maxLength={80}
              onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))}
              className={fieldClass}
            />
          </label>

          <label className="text-sm font-medium text-black">
            Excerpt
            <textarea
              value={form.excerpt}
              maxLength={400}
              rows={3}
              onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
              className={fieldClass}
            />
          </label>

          <label className="text-sm font-medium text-black">
            Article
            <textarea
              value={form.body}
              required
              rows={14}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              className={`${fieldClass} font-mono`}
            />
            <span className="mt-1 block text-xs font-normal text-gray-600">
              Blank line for a new paragraph. Start a line with ## for a heading, or - for a bullet. Use **bold** for emphasis.
            </span>
          </label>

          <label className="text-sm font-medium text-black">
            Cover image URL
            <input
              value={form.cover_image_url}
              placeholder="https://"
              onChange={(event) => setForm((current) => ({ ...current, cover_image_url: event.target.value }))}
              className={fieldClass}
            />
          </label>

          <label className="flex items-center gap-2 text-sm font-medium text-black">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(event) => setForm((current) => ({ ...current, published: event.target.checked }))}
              className="h-4 w-4"
            />
            Published
          </label>

          {error && editorOpen && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="cursor-pointer rounded-lg border-2 border-black px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="cursor-pointer rounded-lg border-2 border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
