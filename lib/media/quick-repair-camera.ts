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

/** The camera icon opens the shared ProCam. Pass how many photos are already chosen. */
export function openQuickRepairCamera(existingCount?: number) {
  if (typeof window === 'undefined') return;
  // Must run in this click. A later effect is too late for the phone camera.
  primeLiveCamera('environment');
  window.dispatchEvent(new CustomEvent<QuickRepairCameraOpenDetail>(QUICK_REPAIR_CAMERA_OPEN_EVENT, {
    detail: { existingCount },
  }));
}
