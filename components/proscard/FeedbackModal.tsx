'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ImagePlus, Send, Trash2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/ui/Modal';
import FeedbackPhotos from '@/components/feedback/FeedbackPhotos';
import { createLocalePath, createSignInUrl } from '@/lib/redirect';
import type { Locale } from '@/i18n';

interface PublicFeedback {
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

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  contractorType: string;
  logo?: string;
  businessId: string;
  businessSlug?: string;
  onCountChange?: (count: number) => void;
}

const MAX_IMAGES = 5;

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

/** Reviews saved for this pro. The same list is on the business feedback page. */
export default function FeedbackModal({
  isOpen,
  onClose,
  businessName,
  contractorType,
  logo,
  businessId,
  businessSlug,
  onCountChange,
}: FeedbackModalProps) {
  const t = useTranslations('businessFeedback');
  const locale = useLocale() as Locale;
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [items, setItems] = useState<PublicFeedback[]>([]);
  const totalRef = useRef(0);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyPreviews, setReplyPreviews] = useState<string[]>([]);
  const [replyKeptUrls, setReplyKeptUrls] = useState<string[]>([]);
  const [replying, setReplying] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [photosOpen, setPhotosOpen] = useState(false);

  const feedbackPath = `/business/${businessSlug || businessId}/feedback`;

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => {
    const urls = replyFiles.map((file) => URL.createObjectURL(file));
    setReplyPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [replyFiles]);

  useEffect(() => {
    if (!isOpen || !businessId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetch(`/api/businesses/${encodeURIComponent(businessId)}/feedback`, { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || t('failed'));
        return data as { isOwner: boolean; count: number; feedback: PublicFeedback[] };
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data.feedback);
        setIsOwner(data.isOwner);
        totalRef.current = data.count;
        onCountChange?.(data.count);
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
  }, [isOpen, businessId, onCountChange, t]);

  if (!isOpen) return null;

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
      const imageUrls = await uploadPhotos(files);
      const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: text, imageUrls }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('failed'));
      const created = data.feedback as PublicFeedback;
      setItems((current) => [created, ...current]);
      totalRef.current += 1;
      onCountChange?.(totalRef.current);
      setBody('');
      setFiles([]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('failed'));
    } finally {
      setPosting(false);
    }
  };

  const uploadPhotos = async (list: File[]) => {
    const imageUrls: string[] = [];
    for (const file of list) {
      const form = new FormData();
      form.append('file', file);
      const uploaded = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/feedback/images`, {
        method: 'POST',
        body: form,
        credentials: 'include',
      });
      const uploadData = await uploaded.json().catch(() => ({}));
      if (!uploaded.ok) throw new Error(uploadData.error || t('failed'));
      imageUrls.push(uploadData.imageUrl as string);
    }
    return imageUrls;
  };

  const saveReply = async (feedbackId: string) => {
    const text = replyText.trim();
    if (replying || (!text && replyFiles.length === 0 && replyKeptUrls.length === 0)) return;
    setReplying(true);
    setFormError(null);
    try {
      const uploaded = await uploadPhotos(replyFiles);
      const imageUrls = [...replyKeptUrls, ...uploaded].slice(0, MAX_IMAGES);
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/feedback/${feedbackId}/reply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ response: text, imageUrls }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('replyFailed'));
      setItems((current) =>
        current.map((item) =>
          item.id === feedbackId
            ? {
                ...item,
                proResponse: (data.proResponse as string | null) ?? null,
                proResponseImageUrls: (data.proResponseImageUrls as string[]) || [],
                proRespondedAt: data.proRespondedAt as string,
              }
            : item
        )
      );
      setReplyFor(null);
      setReplyText('');
      setReplyFiles([]);
      setReplyKeptUrls([]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('replyFailed'));
    } finally {
      setReplying(false);
    }
  };

  const removeFeedback = async (feedbackId: string) => {
    if (deletingId) return;
    setDeletingId(feedbackId);
    setFormError(null);
    try {
      const response = await fetch(
        `/api/businesses/${encodeURIComponent(businessId)}/feedback/${feedbackId}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('deleteFailed'));
      setItems((current) => current.filter((item) => item.id !== feedbackId));
      totalRef.current = Math.max(0, totalRef.current - 1);
      onCountChange?.(totalRef.current);
      setConfirmDeleteId(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t('deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      showHeader
      maxWidth="md"
      contentClassName="p-0"
      preventCloseOnOverlayClick={photosOpen}
    >
      <div className="flex max-h-[70vh] flex-col">
        <div className="flex items-center gap-3 border-b-2 border-black p-4">
          <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-black ${logo ? 'bg-white' : 'bg-black'}`}>
            {logo ? (
              <Image src={logo} alt={businessName} fill className="object-cover" sizes="48px" />
            ) : (
              <span className="text-lg font-bold text-white">{initials(businessName)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-black">{businessName}</h3>
            <p className="truncate text-sm text-gray-600">{contractorType}</p>
          </div>
        </div>

        <div className="border-b-2 border-black bg-gray-50 px-4 py-4">
          {isOwner ? (
            <p className="rounded-lg border-2 border-black bg-yellow-100 px-3 py-2 text-sm text-black">{t('ownBusiness')}</p>
          ) : !authLoading && !isAuthenticated ? (
            <Link
              href={createSignInUrl(locale, feedbackPath)}
              className="inline-flex rounded-lg border-2 border-black bg-black px-4 py-2 text-sm font-medium text-white"
            >
              {t('signIn')}
            </Link>
          ) : isAuthenticated ? (
            <div className="space-y-3">
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={t('placeholder')}
                className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm text-black outline-none"
              />
              <div className="flex flex-wrap gap-2">
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
                {files.length < MAX_IMAGES && (
                  <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-black bg-white text-[10px] font-medium text-black hover:bg-gray-50">
                    <ImagePlus className="mb-0.5 h-4 w-4" />
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
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <button
                type="button"
                onClick={() => void submit()}
                disabled={posting || !body.trim()}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {t('submit')}
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-sm text-gray-600">{t('title')}…</p>
          ) : loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-600">{t('empty')}</p>
          ) : (
            items.map((item) => {
              const posted = new Date(item.createdAt).toLocaleDateString(locale, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });
              return (
                <article key={item.id} className="rounded-lg border-2 border-black p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-600">{t('from')}</p>
                      <p className="font-semibold text-black">{item.authorName}</p>
                    </div>
                    <p className="shrink-0 text-xs text-gray-600">{posted}</p>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-black">{item.body}</p>
                  {item.imageUrls.length > 0 && (
                    <FeedbackPhotos urls={item.imageUrls} onOpenChange={setPhotosOpen} />
                  )}
                  {(item.proResponse || (item.proResponseImageUrls || []).length > 0) && replyFor !== item.id && (
                    <div className="mt-3 rounded-lg border-2 border-black bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-black">{t('proReply')}</p>
                      {item.proResponse && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-black">{item.proResponse}</p>
                      )}
                      {(item.proResponseImageUrls || []).length > 0 && (
                        <FeedbackPhotos urls={item.proResponseImageUrls} onOpenChange={setPhotosOpen} />
                      )}
                    </div>
                  )}
                  {isOwner && replyFor === item.id && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        maxLength={2000}
                        rows={3}
                        placeholder={t('replyPlaceholder')}
                        className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm text-black outline-none"
                      />
                      <div className="flex flex-wrap gap-2">
                        {replyKeptUrls.map((src) => (
                          <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg border-2 border-black">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setReplyKeptUrls((current) => current.filter((url) => url !== src))}
                              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-black bg-white"
                              aria-label={t('removePhoto')}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {replyPreviews.map((src, index) => (
                          <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg border-2 border-black">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setReplyFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-black bg-white"
                              aria-label={t('removePhoto')}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        {replyKeptUrls.length + replyFiles.length < MAX_IMAGES && (
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
                                  setReplyFiles((current) => {
                                    const next = [...current];
                                    for (const file of Array.from(list)) {
                                      if (replyKeptUrls.length + next.length >= MAX_IMAGES) break;
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
                      <button
                        type="button"
                        onClick={() => void saveReply(item.id)}
                        disabled={replying || (!replyText.trim() && replyFiles.length === 0 && replyKeptUrls.length === 0)}
                        className="rounded-lg border-2 border-black bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {t('saveReply')}
                      </button>
                    </div>
                  )}
                  {isOwner && replyFor !== item.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyFor(item.id);
                        setReplyText(item.proResponse || '');
                        setReplyKeptUrls(item.proResponseImageUrls || []);
                        setReplyFiles([]);
                        setConfirmDeleteId(null);
                      }}
                      className="mt-2 text-xs font-medium text-black underline"
                    >
                      {t('proReply')}
                    </button>
                  )}
                  {item.canDelete && confirmDeleteId === item.id && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm text-black">{t('confirmDelete')}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void removeFeedback(item.id)}
                          disabled={deletingId === item.id}
                          className="rounded-lg border-2 border-black bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {t('delete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-medium text-black"
                        >
                          {t('keep')}
                        </button>
                      </div>
                    </div>
                  )}
                  {item.canDelete && confirmDeleteId !== item.id && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-black underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('delete')}
                    </button>
                  )}
                </article>
              );
            })
          )}
          <Link href={createLocalePath(locale, feedbackPath)} className="inline-block text-sm font-medium text-black underline">
            {t('shareFeedback')}
          </Link>
        </div>
      </div>
    </Modal>
  );
}
