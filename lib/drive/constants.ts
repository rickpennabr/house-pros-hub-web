export const PRO_DRIVE_BUCKET = 'pro-drive';
export const PRO_DRIVE_MAX_BYTES = 25 * 1024 * 1024;
export const PRO_DRIVE_SIGNED_URL_SECONDS = 60 * 60;

export const PRO_DRIVE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

export type ProDriveMimeType = (typeof PRO_DRIVE_MIME_TYPES)[number];

const EXT_BY_MIME: Record<ProDriveMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

export function isProDriveMime(mime: string): mime is ProDriveMimeType {
  return (PRO_DRIVE_MIME_TYPES as readonly string[]).includes(mime);
}

export function extensionForMime(mime: string): string {
  if (isProDriveMime(mime)) return EXT_BY_MIME[mime];
  return 'bin';
}

export function buildProDriveStoragePath(ownerType: 'user' | 'business', ownerId: string, fileId: string, mime: string): string {
  return `${ownerType}/${ownerId}/${fileId}.${extensionForMime(mime)}`;
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}
