const CAMERA_KEY = 'hph-job-camera';
const LOCATION_KEY = 'hph-job-location';

function readFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === '1';
}

function writeFlag(key: string, on: boolean) {
  window.localStorage.setItem(key, on ? '1' : '0');
}

/** Jobsite camera preference. The browser still asks the first time. */
export function jobCameraAllowed(): boolean {
  return readFlag(CAMERA_KEY);
}

export function setJobCameraAllowed(on: boolean) {
  writeFlag(CAMERA_KEY, on);
}

/** Stamp JOB photos with the device position when this is on. */
export function jobLocationAllowed(): boolean {
  return readFlag(LOCATION_KEY);
}

export function setJobLocationAllowed(on: boolean) {
  writeFlag(LOCATION_KEY, on);
}
