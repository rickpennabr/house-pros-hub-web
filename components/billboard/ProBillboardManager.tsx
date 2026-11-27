'use client';
import { uploadWithProgress } from '@/lib/upload/uploadWithProgress';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Eraser, Sparkles } from 'lucide-react';
import { dateInputValue, promoExampleFor } from '@/lib/billboard/promo-examples';
import { ChevronDown, ChevronUp, Eye, EyeOff, ImageIcon, Megaphone, Pencil, Trash2, Video } from 'lucide-react';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { ProBillboardPlayer } from '@/components/billboard/ProBillboardPlayer';
import { liveSlides } from '@/lib/billboard/live';
import { BILLBOARD_MAX_SLIDES, type BillboardKind, type BillboardSlide } from '@/lib/billboard/types';
import { getCsrfToken } from '@/lib/utils/csrf';

interface ProBillboardManagerProps {
  businessId: string;
  businessName: string;
  publicHref: string;
  /** What the business says it does (trade, licenses, services, name): picks the example promotion. */
  tradeHints?: Array<string | null | undefined>;
}

interface Draft {
  id?: string;
  kind: BillboardKind;
  mediaUrl: string | null;
  headline: string;
  body: string;
  badge: string;
  ctaLabel: string;
  ctaUrl: string;
  isActive: boolean;
  durationSeconds: number;
  startsOn: string;
  endsOn: string;
}

const DURATIONS = [5, 8, 12, 20];

function emptyDraft(kind: BillboardKind = 'image'): Draft {
  return {
    kind,
    mediaUrl: null,
    headline: '',
    body: '',
    badge: '',
    ctaLabel: '',
    ctaUrl: '',
    isActive: true,
    durationSeconds: 8,
    startsOn: '',
    endsOn: '',
  };
}

function draftFromSlide(slide: BillboardSlide): Draft {
  return {
    id: slide.id,
    kind: slide.kind,
    mediaUrl: slide.mediaUrl,
    headline: slide.headline ?? '',
    body: slide.body ?? '',
    badge: slide.badge ?? '',
    ctaLabel: slide.ctaLabel ?? '',
    ctaUrl: slide.ctaUrl ?? '',
    isActive: slide.isActive,
    durationSeconds: slide.durationSeconds,
    startsOn: slide.startsOn ?? '',
    endsOn: slide.endsOn ?? '',
  };
}

function payloadFromDraft(draft: Draft) {
  return {
    kind: draft.kind,
    mediaUrl: draft.mediaUrl,
    headline: draft.headline.trim() || null,
    body: draft.body.trim() || null,
    badge: draft.badge.trim() || null,
    ctaLabel: draft.ctaLabel.trim() || null,
    ctaUrl: draft.ctaUrl.trim() || null,
    isActive: draft.isActive,
    durationSeconds: draft.durationSeconds,
    startsOn: draft.startsOn || null,
    endsOn: draft.endsOn || null,
  };
}

const iconButton =
  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-2 border-black bg-white text-black hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';

export function ProBillboardManager({ businessId, businessName, publicHref, tradeHints = [] }: ProBillboardManagerProps) {
  const t = useTranslations('proBillboard');
  const [slides, setSlides] = useState<BillboardSlide[]>([]);
  const [stillPhoto, setStillPhoto] = useState<{ url: string | null; position: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BillboardSlide | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** The example filled the form: show "Clear all" next to the example button. */
  const [exampleShown, setExampleShown] = useState(false);
  const example = useMemo(() => promoExampleFor([...tradeHints, businessName]), [tradeHints, businessName]);

  /** Fill the promotion with an example for this business's trade (painting when unknown). */
  function showExample() {
    if (!draft) return;
    const today = new Date();
    setDraft({
      ...draft,
      kind: 'promotion',
      headline: example.headline,
      body: example.body,
      badge: example.badge,
      ctaLabel: example.ctaLabel,
      ctaUrl: typeof window === 'undefined' ? '' : `${window.location.origin}${publicHref}`,
      durationSeconds: 8,
      startsOn: dateInputValue(today),
      endsOn: dateInputValue(today, example.days),
    });
    setExampleShown(true);
    setError(null);
  }

  /** Empty every field again (keeps the slide type and any photo already added). */
  function clearAll() {
    if (!draft) return;
    setDraft({ ...emptyDraft(draft.kind), id: draft.id, mediaUrl: draft.mediaUrl });
    setExampleShown(false);
    setError(null);
  }
  const playing = useMemo(() => liveSlides(slides), [slides]);

  const explain = useCallback(
    (code: string) => {
      const known: Record<string, string> = {
        headline_required: t('errors.headline_required'),
        media_required: t('errors.media_required'),
        media_invalid: t('errors.media_invalid'),
        link_invalid: t('errors.link_invalid'),
        dates_invalid: t('errors.dates_invalid'),
        cta_incomplete: t('errors.cta_incomplete'),
        too_many: t('errors.too_many'),
        unavailable: t('errors.unavailable'),
        reorder_invalid: t('errors.reorder_invalid'),
        invalid: t('errors.invalid'),
        video_too_big: t('errors.video_too_big'),
        image_too_big: t('errors.image_too_big'),
        upload_failed: t('errors.upload_failed'),
        generic: t('errors.generic'),
      };
      return known[code] ?? t('errors.generic');
    },
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/businesses/${businessId}/billboard?manage=1`, { credentials: 'include' });
      const data = (await response.json().catch(() => ({}))) as {
        slides?: BillboardSlide[];
        stillPhoto?: { url: string | null; position: string | null };
        error?: string;
      };
      if (!response.ok) {
        setError(explain(data.error || 'generic'));
        setSlides([]);
        return;
      }
      setSlides(data.slides ?? []);
      setStillPhoto(data.stillPhoto ?? null);
      setError(null);
    } catch {
      setError(explain('generic'));
    } finally {
      setLoading(false);
    }
  }, [businessId, explain]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function authed(path: string, method: string, body?: unknown) {
    const csrf = await getCsrfToken();
    const response = await fetch(path, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrf,
      },
      body: JSON.stringify(body ? { ...(body as object), csrfToken: csrf } : { csrfToken: csrf }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; slide?: BillboardSlide; slides?: BillboardSlide[] };
    if (!response.ok) throw new Error(data.error || 'generic');
    return data;
  }

  async function upload(file: File) {
    if (!draft) return;
    setUploading(true);
    setError(null);
    try {
      const csrf = await getCsrfToken();
      const form = new FormData();
      form.set('file', file);
      form.set('businessId', businessId);
      const response = await uploadWithProgress('/api/storage/upload-pro-billboard', {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrf },
        body: form,
      });
      const data = (await response.json().catch(() => ({}))) as { url?: string; kind?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(explain(data.error || 'upload_failed'));
        return;
      }
      const expectVideo = draft.kind === 'video';
      if (expectVideo && data.kind !== 'video') {
        setError(explain('media_invalid'));
        return;
      }
      if (!expectVideo && data.kind === 'video') {
        setError(explain('media_invalid'));
        return;
      }
      setDraft({ ...draft, mediaUrl: data.url });
    } catch {
      setError(explain('upload_failed'));
    } finally {
      setUploading(false);
    }
  }

  function localProblem(draftToSave: Draft): string | null {
    if (draftToSave.kind === 'promotion' && !draftToSave.headline.trim()) return explain('headline_required');
    if ((draftToSave.kind === 'image' || draftToSave.kind === 'video') && !draftToSave.mediaUrl) return explain('media_required');
    const hasLabel = Boolean(draftToSave.ctaLabel.trim());
    const hasUrl = Boolean(draftToSave.ctaUrl.trim());
    if (hasLabel !== hasUrl) return explain('cta_incomplete');
    if (draftToSave.startsOn && draftToSave.endsOn && draftToSave.endsOn < draftToSave.startsOn) return explain('dates_invalid');
    return null;
  }

  async function save() {
    if (!draft) return;
    const problem = localProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const path = draft.id
        ? `/api/businesses/${businessId}/billboard/${draft.id}`
        : `/api/businesses/${businessId}/billboard`;
      await authed(path, draft.id ? 'PATCH' : 'POST', payloadFromDraft(draft));
      setExampleShown(false); setDraft(null);
      await load();
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : 'generic'));
    } finally {
      setSaving(false);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const next = slides.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setSlides(next);
    try {
      const data = await authed(`/api/businesses/${businessId}/billboard`, 'PATCH', {
        orderedIds: next.map((slide) => slide.id),
      });
      if (data.slides) setSlides(data.slides);
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : 'generic'));
      await load();
    }
  }

  async function toggle(slide: BillboardSlide) {
    try {
      await authed(`/api/businesses/${businessId}/billboard/${slide.id}`, 'PATCH', {
        ...payloadFromDraft(draftFromSlide(slide)),
        isActive: !slide.isActive,
      });
      await load();
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : 'generic'));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await authed(`/api/businesses/${businessId}/billboard/${pendingDelete.id}`, 'DELETE');
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(explain(err instanceof Error ? err.message : 'generic'));
    } finally {
      setDeleting(false);
    }
  }

  function changeKind(kind: BillboardKind) {
    if (!draft) return;
    const mediaStillFits = kind === 'promotion' || kind === draft.kind;
    setDraft({ ...draft, kind, mediaUrl: mediaStillFits ? draft.mediaUrl : null });
  }

  const kindMeta: Record<BillboardKind, { label: string; icon: typeof ImageIcon }> = {
    image: { label: t('kinds.image'), icon: ImageIcon },
    video: { label: t('kinds.video'), icon: Video },
    promotion: { label: t('kinds.promotion'), icon: Megaphone },
  };

  return (
    <div className="space-y-4 p-3 md:p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-gray-600">{t('intro', { name: businessName })}</p>
          <Link href={publicHref} className="cursor-pointer text-sm font-medium text-black underline">
            {t('viewPage')}
          </Link>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setError(null);
            setExampleShown(false);
            setDraft(emptyDraft());
          }}
          disabled={slides.length >= BILLBOARD_MAX_SLIDES || draft !== null}
        >
          {t('add')}
        </Button>
      </div>

      {playing.length > 0 ? (
        <ProBillboardPlayer slides={playing} businessName={businessName} />
      ) : (
        <div className="relative flex h-[200px] items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-black px-4 text-center text-sm text-white md:h-[300px]">
          {stillPhoto?.url ? (
            // The current still photo: what the public page shows while nothing is scheduled.
            <Image
              src={stillPhoto.url}
              alt={businessName}
              fill
              unoptimized
              className="object-cover"
              style={{ objectPosition: stillPhoto.position || '50% 50%' }}
              sizes="(max-width: 1200px) 100vw, 1200px"
            />
          ) : null}
          <span className={stillPhoto?.url ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8 text-left' : ''}>
            {t('nothingLive')}
          </span>
        </div>
      )}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-500">{t('loading')}</p> : null}

      {!loading && slides.length === 0 ? <p className="text-sm text-gray-600">{t('empty')}</p> : null}

      <ul className="space-y-2">
        {slides.map((slide, index) => {
          const meta = kindMeta[slide.kind];
          const Icon = meta.icon;
          return (
            <li key={slide.id} className="flex gap-2 rounded-lg border-2 border-black p-2">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-black">
                {slide.mediaUrl && slide.kind !== 'video' ? (
                  <Image src={slide.mediaUrl} alt="" fill unoptimized className="object-cover" sizes="64px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white">
                    <Icon className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-black">{meta.label}</p>
                <p className="truncate text-sm text-gray-700">{slide.headline || slide.badge || t('noCaption')}</p>
                <p className="text-xs text-gray-500">
                  {slide.isActive ? t('onBoard') : t('hidden')}
                  {slide.kind !== 'video' ? ` · ${t('seconds', { count: slide.durationSeconds })}` : ''}
                  {slide.startsOn || slide.endsOn ? ` · ${slide.startsOn || '…'} – ${slide.endsOn || '…'}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" className={iconButton} aria-label={t('moveUp')} disabled={index === 0} onClick={() => void move(index, -1)}>
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className={iconButton}
                  aria-label={t('moveDown')}
                  disabled={index === slides.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button type="button" className={iconButton} aria-label={slide.isActive ? t('hide') : t('show')} onClick={() => void toggle(slide)}>
                  {slide.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button type="button" className={iconButton} aria-label={t('edit')} onClick={() => { setError(null); setExampleShown(false); setDraft(draftFromSlide(slide)); }}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" className={iconButton} aria-label={t('delete')} onClick={() => setPendingDelete(slide)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {draft ? (
        <div className="space-y-3 rounded-lg border-2 border-black p-3">
          <h2 className="text-base font-bold text-black">{draft.id ? t('edit') : t('add')}</h2>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(kindMeta) as BillboardKind[]).map((kind) => {
              const Icon = kindMeta[kind].icon;
              const selected = draft.kind === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => changeKind(kind)}
                  className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 text-xs font-medium ${
                    selected ? 'border-black bg-black text-white' : 'border-black bg-white text-black hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {kindMeta[kind].label}
                </button>
              );
            })}
          </div>

          <FileDropZone
            accept={draft.kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp'}
            maxSizeMb={draft.kind === 'video' ? 25 : 5}
            disabled={uploading}
            label={uploading ? t('uploading') : draft.kind === 'video' ? t('uploadVideo') : draft.kind === 'promotion' ? t('uploadImageOptional') : t('uploadImage')}
            hint={draft.kind === 'video' ? t('videoHint') : t('imageHint')}
            onFiles={(files) => {
              const file = files[0];
              if (file) void upload(file);
            }}
          />
          {draft.mediaUrl ? (
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs text-gray-600">{t('fileReady')}</p>
              <button type="button" className="cursor-pointer text-sm font-medium underline" onClick={() => setDraft({ ...draft, mediaUrl: null })}>
                {t('removeFile')}
              </button>
            </div>
          ) : null}

          {draft.kind === 'promotion' ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={showExample}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-50"
              >
                <Sparkles className="h-4 w-4 text-red-600" aria-hidden />
                {t('example.show')}
              </button>
              {exampleShown ? (
                <>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-50"
                  >
                    <Eraser className="h-4 w-4" aria-hidden />
                    {t('example.clear')}
                  </button>
                  <span className="text-xs text-gray-600">{t('example.note', { trade: example.trade })}</span>
                </>
              ) : null}
            </div>
          ) : null}

          <label className="block text-sm font-medium text-black">
            {t('headline')}
            {draft.kind === 'promotion' ? ' *' : ''}
            <Input className="mt-1" value={draft.headline} maxLength={80} onChange={(event) => setDraft({ ...draft, headline: event.target.value })} />
          </label>

          {draft.kind === 'promotion' ? (
            <>
              <label className="block text-sm font-medium text-black">
                {t('body')}
                <textarea
                  value={draft.body}
                  maxLength={240}
                  rows={3}
                  onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                  className="mt-1 w-full rounded-lg border-2 border-black bg-white p-2 text-black focus:outline-none"
                />
              </label>
              <label className="block text-sm font-medium text-black">
                {t('badge')}
                <Input className="mt-1" value={draft.badge} maxLength={24} placeholder={t('badgePlaceholder')} onChange={(event) => setDraft({ ...draft, badge: event.target.value })} />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium text-black">
                  {t('ctaLabel')}
                  <Input className="mt-1" value={draft.ctaLabel} maxLength={32} onChange={(event) => setDraft({ ...draft, ctaLabel: event.target.value })} />
                </label>
                <label className="block text-sm font-medium text-black">
                  {t('ctaUrl')}
                  <Input className="mt-1" value={draft.ctaUrl} placeholder="https://" onChange={(event) => setDraft({ ...draft, ctaUrl: event.target.value })} />
                </label>
              </div>
            </>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            {draft.kind !== 'video' ? (
              <label className="block text-sm font-medium text-black">
                {t('duration')}
                <Select className="mt-1" value={String(draft.durationSeconds)} onChange={(event) => setDraft({ ...draft, durationSeconds: Number(event.target.value) })}>
                  {DURATIONS.map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {t('seconds', { count: seconds })}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <p className="text-sm text-gray-600 md:col-span-1">{t('videoPlaysOnce')}</p>
            )}
            <label className="block text-sm font-medium text-black">
              {t('starts')}
              <Input className="mt-1" type="date" value={draft.startsOn} onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })} />
            </label>
            <label className="block text-sm font-medium text-black">
              {t('ends')}
              <Input className="mt-1" type="date" value={draft.endsOn} onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })} />
            </label>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-black">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })}
              className="h-4 w-4 accent-black"
            />
            {t('onBoard')}
          </label>

          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving || uploading}>
              {saving ? t('saving') : t('save')}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => { setExampleShown(false); setDraft(null); }} disabled={saving}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      <DeleteConfirmModal
        isOpen={pendingDelete !== null}
        title={t('deleteTitle')}
        message={t('deleteMessage')}
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => void confirmDelete()}
        confirmLabel={t('delete')}
        busyLabel={t('deleting')}
        cancelLabel={t('cancel')}
      />
    </div>
  );
}
