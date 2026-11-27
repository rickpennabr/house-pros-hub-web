import { createServiceRoleClient } from '@/lib/supabase/server';
import { isSlideLive, utcToday } from '@/lib/billboard/live';
import { billboardStoragePath } from '@/lib/billboard/media';
import {
  BILLBOARD_BUCKET,
  BILLBOARD_MAX_SLIDES,
  type BillboardSlide,
  type BillboardSlideInput,
} from '@/lib/billboard/types';

export class BillboardError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

interface SlideRow {
  id: string;
  business_id: string;
  kind: BillboardSlide['kind'];
  media_url: string | null;
  headline: string | null;
  body: string | null;
  badge: string | null;
  cta_label: string | null;
  cta_url: string | null;
  sort_order: number;
  is_active: boolean;
  duration_seconds: number;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
  updated_at: string;
}

function mapSlide(row: SlideRow): BillboardSlide {
  return {
    id: row.id,
    businessId: row.business_id,
    kind: row.kind,
    mediaUrl: row.media_url,
    headline: row.headline,
    body: row.body,
    badge: row.badge,
    ctaLabel: row.cta_label,
    ctaUrl: row.cta_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    durationSeconds: row.duration_seconds,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isMissingBillboardTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('pro_billboard_slides');
}

function assertContent(input: BillboardSlideInput, businessId: string) {
  const headline = input.headline?.trim() || null;
  const mediaUrl = input.mediaUrl?.trim() || null;
  if (input.kind === 'promotion' && !headline) {
    throw new BillboardError('headline_required', 400);
  }
  if ((input.kind === 'image' || input.kind === 'video') && !mediaUrl) {
    throw new BillboardError('media_required', 400);
  }
  if (mediaUrl && !billboardStoragePath(mediaUrl, businessId)) {
    throw new BillboardError('media_invalid', 400);
  }
  if (input.kind === 'video' && mediaUrl) {
    const path = billboardStoragePath(mediaUrl, businessId) ?? '';
    const lower = path.toLowerCase();
    if (!lower.endsWith('.mp4') && !lower.endsWith('.webm') && !lower.endsWith('.mov')) {
      throw new BillboardError('media_invalid', 400);
    }
  }
  if ((input.kind === 'image' || input.kind === 'promotion') && mediaUrl) {
    const path = (billboardStoragePath(mediaUrl, businessId) ?? '').toLowerCase();
    if (!path.endsWith('.jpg') && !path.endsWith('.jpeg') && !path.endsWith('.png') && !path.endsWith('.webp')) {
      throw new BillboardError('media_invalid', 400);
    }
  }
  const ctaLabel = input.ctaLabel?.trim() || null;
  const ctaUrl = input.ctaUrl?.trim() || null;
  if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) {
    throw new BillboardError('cta_incomplete', 400);
  }
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) {
    throw new BillboardError('dates_invalid', 400);
  }
}

function toRow(input: BillboardSlideInput) {
  return {
    kind: input.kind,
    media_url: input.mediaUrl?.trim() || null,
    headline: input.headline?.trim() || null,
    body: input.body?.trim() || null,
    badge: input.badge?.trim() || null,
    cta_label: input.ctaLabel?.trim() || null,
    cta_url: input.ctaUrl?.trim() || null,
    is_active: input.isActive !== false,
    duration_seconds: input.durationSeconds ?? 8,
    starts_on: input.startsOn || null,
    ends_on: input.endsOn || null,
    updated_at: new Date().toISOString(),
  };
}

async function removeStoredFile(url: string | null, businessId: string) {
  const path = billboardStoragePath(url, businessId);
  if (!path) return;
  const service = createServiceRoleClient();
  await service.storage.from(BILLBOARD_BUCKET).remove([path]);
}

export async function listBillboardSlides(businessId: string, mode: 'live' | 'all'): Promise<BillboardSlide[]> {
  const service = createServiceRoleClient();
  const { data, error } = await service
    .from('pro_billboard_slides')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingBillboardTable(error)) throw new BillboardError('unavailable', 503);
    throw error;
  }
  const slides = ((data ?? []) as SlideRow[]).map(mapSlide);
  if (mode === 'all') return slides;
  const today = utcToday();
  return slides.filter((slide) => isSlideLive(slide, today));
}

export async function createBillboardSlide(businessId: string, input: BillboardSlideInput): Promise<BillboardSlide> {
  assertContent(input, businessId);
  const service = createServiceRoleClient();
  const { count, error: countError } = await service
    .from('pro_billboard_slides')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId);
  if (countError) {
    if (isMissingBillboardTable(countError)) throw new BillboardError('unavailable', 503);
    throw countError;
  }
  if ((count ?? 0) >= BILLBOARD_MAX_SLIDES) throw new BillboardError('too_many', 400);

  const { data: last, error: lastError } = await service
    .from('pro_billboard_slides')
    .select('sort_order')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw lastError;

  const { data, error } = await service
    .from('pro_billboard_slides')
    .insert({
      business_id: businessId,
      ...toRow(input),
      sort_order: (last?.sort_order ?? -1) + 1,
    })
    .select('*')
    .single();
  if (error) {
    if (isMissingBillboardTable(error)) throw new BillboardError('unavailable', 503);
    throw error;
  }
  return mapSlide(data as SlideRow);
}

export async function updateBillboardSlide(
  businessId: string,
  slideId: string,
  input: BillboardSlideInput,
): Promise<BillboardSlide> {
  assertContent(input, businessId);
  const service = createServiceRoleClient();
  const { data: existing, error: existingError } = await service
    .from('pro_billboard_slides')
    .select('*')
    .eq('id', slideId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new BillboardError('not_found', 404);

  const previous = existing as SlideRow;
  const { data, error } = await service
    .from('pro_billboard_slides')
    .update(toRow(input))
    .eq('id', slideId)
    .eq('business_id', businessId)
    .select('*')
    .single();
  if (error) throw error;

  const nextUrl = input.mediaUrl?.trim() || null;
  if (previous.media_url && previous.media_url !== nextUrl) {
    await removeStoredFile(previous.media_url, businessId);
  }
  return mapSlide(data as SlideRow);
}

export async function deleteBillboardSlide(businessId: string, slideId: string): Promise<void> {
  const service = createServiceRoleClient();
  const { data: existing, error: existingError } = await service
    .from('pro_billboard_slides')
    .select('media_url')
    .eq('id', slideId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (existingError) {
    if (isMissingBillboardTable(existingError)) throw new BillboardError('unavailable', 503);
    throw existingError;
  }
  if (!existing) throw new BillboardError('not_found', 404);

  const { error } = await service.from('pro_billboard_slides').delete().eq('id', slideId).eq('business_id', businessId);
  if (error) throw error;
  await removeStoredFile(existing.media_url, businessId);
}

export async function reorderBillboardSlides(businessId: string, orderedIds: string[]): Promise<BillboardSlide[]> {
  const current = await listBillboardSlides(businessId, 'all');
  const currentIds = new Set(current.map((slide) => slide.id));
  if (orderedIds.length !== current.length || orderedIds.some((id) => !currentIds.has(id))) {
    throw new BillboardError('reorder_invalid', 400);
  }
  const service = createServiceRoleClient();
  const updates = await Promise.all(
    orderedIds.map((id, index) =>
      service
        .from('pro_billboard_slides')
        .update({ sort_order: index, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('business_id', businessId),
    ),
  );
  const failed = updates.find((result) => result.error);
  if (failed?.error) throw failed.error;
  return listBillboardSlides(businessId, 'all');
}
