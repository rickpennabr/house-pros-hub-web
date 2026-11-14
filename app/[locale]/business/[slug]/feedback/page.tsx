'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ImagePlus, Trash2, X } from 'lucide-react';
import BusinessDetailsHeader from '@/components/businessdetails/BusinessDetailsHeader';
import FeedbackPhotos from '@/components/feedback/FeedbackPhotos';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import { createSignInUrl } from '@/lib/redirect';
import type { Locale } from '@/i18n';

interface FeedbackItem {
  id: string;
  authorName: string;
  body: string;
  imageUrls: string[];
  proResponse: string | null;
  proResponseImageUrls: string[];
  proRespondedAt: string | null;
  createdAt: string;
  canDelete: boolean;
}

const MAX_IMAGES = 5;

export default function BusinessFeedbackPage() {
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const locale = useLocale() as Locale;
  const t = useTranslations('businessFeedback');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [logo, setLogo] = useState<string | undefined>();
  const [isOwner, setIsOwner] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/businesses/${encodeURIComponent(slug)}/feedback`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || t('failed'));
        return data as {
          business: { name: string; logo: string | null };
          isOwner: boolean;
          feedback: FeedbackItem[];
        };
      })
      .then((data) => {
        if (cancelled) return;
        setBusinessName(data.business.name);
        setLogo(data.business.logo || undefined);
        setIsOwner(data.isOwner);
        setItems(data.feedback);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : t('failed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, t]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_IMAGES) break;
      if (!file.type.startsWith('image/')) continue;
      next.push(file);
    }
    setFiles(next);
  };

  const submit = async () => {
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    setFormError(null);
    try {
      const imageUrls: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        const uploaded = await fetch(`/api/businesses/${encodeURIComponent(slug)}/feedback/images`, {
          method: 'POST',
          body: form,
          credentials: 'include',
        });
        const uploadData = await uploaded.json().catch(() => ({}));
        if (!uploaded.ok) throw new Error(uploadData.error || t('failed'));
        imageUrls.push(uploadData.imageUrl as string);
      }
      const response = await fetch(`/api/businesses/${encodeURIComponent(slug)}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: text, imageUrls }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('failed'));
      setItems((current) => [data.feedback as FeedbackItem, ...current]);
      setBody('');
      setFiles([]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('failed'));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <BusinessDetailsHeader
        businessName={businessName || t('title')}
        logo={logo}
        shareTitle={t('title')}
      />
      <div className="mx-auto max-w-3xl px-2 py-4 md:p-6">
        <h1 className="text-xl font-bold text-black">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('intro')}</p>

        {loading ? (
          <p className="mt-6 text-sm text-gray-600">{t('title')}…</p>
        ) : loadError ? (
          <p className="mt-6 text-sm text-red-600">{loadError}</p>
        ) : (
          <>
            {isOwner ? (
              <p className="mt-4 rounded-lg border-2 border-black bg-yellow-100 px-3 py-2 text-sm text-black">
                {t('ownBusiness')}
              </p>
            ) : !authLoading && !isAuthenticated ? (
              <Link
                href={createSignInUrl(locale, `/business/${slug}/feedback`)}
                className="mt-4 inline-flex rounded-lg border-2 border-black bg-black px-4 py-2 text-sm font-medium text-white"
              >
                {t('signIn')}
              </Link>
            ) : isAuthenticated ? (
              <div className="mt-4 space-y-3">
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder={t('placeholder')}
                  className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm text-black outline-none"
                />
                <div>
                  <p className="mb-2 text-sm font-semibold text-black">
                    {t('photos')} ({files.length}/{MAX_IMAGES})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {previews.map((src, index) => (
                      <div key={src} className="relative h-20 w-20 overflow-hidden rounded-lg border-2 border-black">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-black bg-white"
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {files.length < MAX_IMAGES && (
                      <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-black bg-white text-center text-[11px] font-medium text-black hover:bg-gray-50">
                        <ImagePlus className="mb-1 h-4 w-4" />
                        {t('addPhotos')}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={(event) => {
                            addFiles(event.target.files);
                            event.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <Button type="button" onClick={submit} disabled={posting || !body.trim()} loading={posting}>
                  {t('submit')}
                </Button>
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-gray-600">{t('empty')}</p>
              ) : (
                items.map((item) => (
                  <FeedbackCard
                    key={item.id}
                    item={item}
                    slug={slug}
                    locale={locale}
                    isOwner={isOwner}
                    onReplied={(id, proResponse, proRespondedAt, proResponseImageUrls) =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.id === id
                            ? { ...entry, proResponse, proRespondedAt, proResponseImageUrls }
                            : entry
                        )
                      )
                    }
                    onDeleted={(id) => setItems((current) => current.filter((entry) => entry.id !== id))}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FeedbackCard({
  item,
  slug,
  locale,
  isOwner,
  onReplied,
  onDeleted,
}: {
  item: FeedbackItem;
  slug: string;
  locale: string;
  isOwner: boolean;
  onReplied: (
    id: string,
    proResponse: string | null,
    proRespondedAt: string,
    proResponseImageUrls: string[]
  ) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations('businessFeedback');
  const [reply, setReply] = useState(item.proResponse || '');
  const [keptUrls, setKeptUrls] = useState(item.proResponseImageUrls || []);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posted = new Date(item.createdAt).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const saveReply = async () => {
    const text = reply.trim();
    if (saving || (!text && files.length === 0 && keptUrls.length === 0)) return;
    setSaving(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        const upload = await fetch(`/api/businesses/${encodeURIComponent(slug)}/feedback/images`, {
          method: 'POST',
          body: form,
          credentials: 'include',
        });
        const uploadData = await upload.json().catch(() => ({}));
        if (!upload.ok) throw new Error(uploadData.error || t('replyFailed'));
        uploaded.push(uploadData.imageUrl as string);
      }
      const imageUrls = [...keptUrls, ...uploaded].slice(0, MAX_IMAGES);
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(slug)}/feedback/${item.id}/reply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ response: text, imageUrls }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('replyFailed'));
      const nextUrls = (data.proResponseImageUrls as string[]) || [];
      setKeptUrls(nextUrls);
      setFiles([]);
      onReplied(item.id, (data.proResponse as string | null) ?? null, data.proRespondedAt as string, nextUrls);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('replyFailed'));
    } finally {
      setSaving(false);
    }
  };

  const removeFeedback = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(slug)}/feedback/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('deleteFailed'));
      onDeleted(item.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t('deleteFailed'));
      setDeleting(false);
    }
  };

  const replyPhotos = item.proResponseImageUrls || [];

  return (
    <article className="rounded-lg border-2 border-black p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('from')}</p>
          <p className="font-semibold text-black">{item.authorName}</p>
        </div>
        <p className="shrink-0 text-xs text-gray-600">{posted}</p>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-black">{item.body}</p>
      {item.imageUrls.length > 0 && <FeedbackPhotos urls={item.imageUrls} thumbClassName="h-24 w-24" />}
      {(item.proResponse || replyPhotos.length > 0) && !isOwner && (
        <div className="mt-3 rounded-lg border-2 border-black bg-gray-50 p-3">
          <p className="text-xs font-semibold text-black">{t('proReply')}</p>
          {item.proResponse && <p className="mt-1 whitespace-pre-wrap text-sm text-black">{item.proResponse}</p>}
          {replyPhotos.length > 0 && <FeedbackPhotos urls={replyPhotos} thumbClassName="h-24 w-24" />}
        </div>
      )}
      {isOwner && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-black">{t('proReply')}</p>
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder={t('replyPlaceholder')}
            className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm text-black outline-none"
          />
          <div className="flex flex-wrap gap-2">
            {keptUrls.map((src) => (
              <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg border-2 border-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setKeptUrls((current) => current.filter((url) => url !== src))}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-black bg-white"
                  aria-label={t('removePhoto')}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {previews.map((src, index) => (
              <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg border-2 border-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-black bg-white"
                  aria-label={t('removePhoto')}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {keptUrls.length + files.length < MAX_IMAGES && (
              <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-black bg-white text-[10px] font-medium text-black hover:bg-gray-50">
                <ImagePlus className="mb-0.5 h-4 w-4" />
                {t('addPhotos')}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const list = event.target.files;
                    if (list) {
                      setFiles((current) => {
                        const next = [...current];
                        for (const file of Array.from(list)) {
                          if (keptUrls.length + next.length >= MAX_IMAGES) break;
                          if (!file.type.startsWith('image/')) continue;
                          next.push(file);
                        }
                        return next;
                      });
                    }
                    event.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="button"
            size="sm"
            onClick={saveReply}
            disabled={saving || (!reply.trim() && files.length === 0 && keptUrls.length === 0)}
            loading={saving}
          >
            {t('saveReply')}
          </Button>
        </div>
      )}
      {item.canDelete && (
        <div className="mt-3">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-sm text-black">{t('confirmDelete')}</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => void removeFeedback()} disabled={deleting} loading={deleting}>
                  {t('delete')}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
                  {t('keep')}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-black underline"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('delete')}
            </button>
          )}
          {error && !isOwner && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </article>
  );
}
