export const QUICK_REPAIR_CAMERA_OPEN_EVENT = 'hph-quick-repair-camera-open';
export const QUICK_REPAIR_PHOTO_EVENT = 'hph-quick-repair-photo';

export interface QuickRepairPhotoRequest {
  file: File;
  rejectReason?: 'full';
}

/** The camera icon asks the browser for the camera. No separate Allow button. */
export function openQuickRepairCamera() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(QUICK_REPAIR_CAMERA_OPEN_EVENT));
}
