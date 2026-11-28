import { primeLiveCamera } from '@/lib/media/prime-camera';

export const QUICK_REPAIR_CAMERA_OPEN_EVENT = 'hph-quick-repair-camera-open';
export const QUICK_REPAIR_PHOTO_EVENT = 'hph-quick-repair-photo';

export interface QuickRepairCameraOpenDetail {
  /** Photos already on the repair form, so the camera stops at five total. */
  existingCount?: number;
}

export interface QuickRepairPhotoRequest {
  file: File;
  rejectReason?: 'full';
}

/** Quick FIX (header, menu, a place): opens the Quick Repair page, step 1 (take or upload a photo). No camera frame. */
export function openQuickRepairCamera(_existingCount?: number) {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.includes('/quick-repair')) return;
  const locale = window.location.pathname.split('/')[1] || 'en';
  window.location.assign(`/${locale}/quick-repair`);
}

/** Quick FIX step 1, Take photo: opens the Fix cam (full-screen ProCam). Pass how many photos are already chosen. */
export function openFixCam(existingCount?: number) {
  if (typeof window === 'undefined') return;
  // Must run in this click. A later effect is too late for the phone camera.
  primeLiveCamera('environment');
  window.dispatchEvent(new CustomEvent<QuickRepairCameraOpenDetail>(QUICK_REPAIR_CAMERA_OPEN_EVENT, {
    detail: { existingCount },
  }));
}
