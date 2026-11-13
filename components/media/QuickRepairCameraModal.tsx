'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { JobCameraSession } from '@/components/media/JobCameraSession';
import {
  QUICK_REPAIR_CAMERA_OPEN_EVENT,
  QUICK_REPAIR_PHOTO_EVENT,
  type QuickRepairCameraOpenDetail,
  type QuickRepairPhotoRequest,
} from '@/lib/media/quick-repair-camera';
import {
  loadQuickRepairDraft,
  saveQuickRepairDraft,
  type QuickRepairDraft,
} from '@/lib/media/quick-repair-draft';
import type { Locale } from '@/i18n';

const MAX_PHOTOS = 5;

function blankDraft(): QuickRepairDraft {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    trade: '',
    description: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    latitude: null,
    longitude: null,
    accuracyM: null,
    photos: [],
  };
}

async function persistCapturedPhoto(file: File): Promise<'full' | 'saved'> {
  const existing = await loadQuickRepairDraft();
  const draft = existing ?? blankDraft();
  if (draft.photos.length >= MAX_PHOTOS) return 'full';
  await saveQuickRepairDraft({
    ...draft,
    photos: [
      ...draft.photos,
      { name: file.name, type: file.type || 'image/jpeg', blob: file, driveId: null },
    ],
  });
  return 'saved';
}

/**
 * Fix camera. Same full-screen ProCam as a job, without video, captions, or ProDrive.
 * Photos land on the repair form, up to five.
 */
export function QuickRepairCameraHost() {
  const t = useTranslations('procam');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [maxShots, setMaxShots] = useState(MAX_PHOTOS);
  const handedToPage = useRef(false);
  const didSave = useRef(false);

  const onRepair = pathname?.includes('/quick-repair') ?? false;

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<QuickRepairCameraOpenDetail>).detail;
      const known = detail?.existingCount;
      if (typeof known === 'number') {
        setMaxShots(Math.max(0, MAX_PHOTOS - known));
        setOpen(true);
        return;
      }
      void loadQuickRepairDraft().then((draft) => {
        setMaxShots(Math.max(0, MAX_PHOTOS - (draft?.photos.length ?? 0)));
        setOpen(true);
      });
    };
    window.addEventListener(QUICK_REPAIR_CAMERA_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(QUICK_REPAIR_CAMERA_OPEN_EVENT, onOpen);
  }, []);

  const goToForm = () => {
    setOpen(false);
    if (!onRepair) router.push(`/${locale}/quick-repair`);
  };

  return (
    <JobCameraSession
      open={open}
      mode="fix"
      title={t('brandTitle')}
      subtitle={t('captureHint')}
      maxShots={maxShots}
      onBack={() => setOpen(false)}
      onSkip={goToForm}
      onFinished={() => {
        setOpen(false);
        if (didSave.current && !handedToPage.current && !onRepair) {
          router.push(`/${locale}/quick-repair`);
        }
        didSave.current = false;
        handedToPage.current = false;
      }}
      onSave={async (items) => {
        handedToPage.current = false;
        let kept = 0;
        for (const item of items) {
          const detail: QuickRepairPhotoRequest = { file: item.file };
          const delivered = new CustomEvent<QuickRepairPhotoRequest>(QUICK_REPAIR_PHOTO_EVENT, {
            cancelable: true,
            detail,
          });
          window.dispatchEvent(delivered);
          if (detail.rejectReason === 'full') {
            if (kept === 0) throw new Error(t('maxPhotos'));
            break;
          }
          if (delivered.defaultPrevented) {
            handedToPage.current = true;
            kept += 1;
            continue;
          }
          try {
            const result = await persistCapturedPhoto(item.file);
            if (result === 'full') {
              if (kept === 0) throw new Error(t('maxPhotos'));
              break;
            }
          } catch (saveError) {
            if (saveError instanceof Error && (saveError.message === t('maxPhotos'))) throw saveError;
            throw new Error(t('draftFailed'));
          }
          kept += 1;
        }
        if (kept === 0) throw new Error(t('maxPhotos'));
        didSave.current = true;
      }}
    />
  );
}
