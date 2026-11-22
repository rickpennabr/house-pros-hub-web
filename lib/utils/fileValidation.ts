import { fileTypeFromBuffer } from 'file-type';

/**
 * Allowed image MIME types
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/**
 * Allowed image file extensions
 */
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

/**
 * Maximum file sizes in bytes
 */
export const MAX_FILE_SIZES = {
  profile: 5 * 1024 * 1024, // 5MB
  logo: 5 * 1024 * 1024, // 5MB
  background: 5 * 1024 * 1024, // 5MB
  gallery: 5 * 1024 * 1024, // 5MB per gallery image
  chat: 10 * 1024 * 1024, // 10MB per chat photo, PDF, or voice note
  chatVideo: 25 * 1024 * 1024, // 25MB per chat video
  invoiceAttachment: 20 * 1024 * 1024, // 20MB per invoice attachment (QuickBooks-style)
} as const;

/**
 * Allowed chat attachment MIME types, as sniffed from the file's bytes (never its name or the
 * browser's claim). Close to what AI chat apps accept (photos incl. iPhone HEIC, PDF and Office
 * documents, common video and audio), minus anything that can run code:
 *   never SVG, HTML, XML or scripts (they run in the browser from our storage domain),
 *   never macro-enabled Office (.docm/.xlsm/.pptm) or old binary Office (.doc/.xls/.ppt),
 *   never archives (.zip/.rar/.7z) or executables.
 * Keep in sync with the chat-attachments bucket (migration 150).
 */
export const ALLOWED_CHAT_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/matroska',
  'video/vnd.avi',
  'video/3gpp',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/aac',
  'audio/flac',
] as const;

/** What the upload error lists as allowed. */
export const CHAT_ATTACHMENT_ALLOWED_LABEL =
  'photos (JPEG, PNG, WebP, GIF, HEIC), PDF, Word, Excel, PowerPoint, TXT, CSV, video (MP4, MOV, WebM, MKV, AVI, 3GP) and audio (MP3, M4A, WAV, OGG, AAC, FLAC)';

export type FileType = keyof typeof MAX_FILE_SIZES;

/**
 * Validates file using magic bytes (actual file content)
 * This is more secure than relying on MIME type or file extension
 * 
 * @param buffer - File buffer to validate
 * @returns Object with isValid flag and detected MIME type
 */
export async function validateFileMagicBytes(
  buffer: Buffer | ArrayBuffer | Uint8Array
): Promise<{ isValid: boolean; mimeType: string | null }> {
  try {
    const fileType = await fileTypeFromBuffer(buffer);
    
    if (!fileType) {
      return { isValid: false, mimeType: null };
    }

    const isValid = ALLOWED_IMAGE_TYPES.includes(fileType.mime as typeof ALLOWED_IMAGE_TYPES[number]);
    
    return {
      isValid,
      mimeType: fileType.mime,
    };
  } catch (error) {
    return { isValid: false, mimeType: null };
  }
}

/**
 * Validates file size
 * 
 * @param size - File size in bytes
 * @param type - Type of file (profile, logo, background)
 * @returns true if size is within limits
 */
export function validateFileSize(size: number, type: FileType): boolean {
  return size <= MAX_FILE_SIZES[type];
}

/**
 * Validates base64 image string
 * 
 * @param base64String - Base64 encoded image string
 * @returns Object with isValid flag and buffer if valid
 */
export async function validateBase64Image(
  base64String: string
): Promise<{ isValid: boolean; buffer?: Buffer; mimeType?: string }> {
  try {
    // Remove data URL prefix if present
    const base64Data = base64String.includes(',') 
      ? base64String.split(',')[1] 
      : base64String;
    
    const buffer = Buffer.from(base64Data, 'base64');
    const validation = await validateFileMagicBytes(buffer);
    
    if (!validation.isValid) {
      return { isValid: false };
    }
    
    return {
      isValid: true,
      buffer,
      mimeType: validation.mimeType || undefined,
    };
  } catch (error) {
    return { isValid: false };
  }
}

/**
 * Gets file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'audio/webm': '.webm',
    'audio/mp4': '.m4a',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'image/gif': '.gif',
    'image/heic': '.heic',
    'image/heif': '.heif',
    'image/avif': '.avif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'video/matroska': '.mkv',
    'video/vnd.avi': '.avi',
    'video/3gpp': '.3gp',
    'audio/x-m4a': '.m4a',
    'audio/aac': '.aac',
    'audio/flac': '.flac',
  };
  return mimeToExt[mimeType] || '.bin';
}

/**
 * A .txt or .csv file has no magic bytes: accept it only when it is plain UTF-8 text (no NUL
 * bytes, no binary) and does not look like HTML, SVG or XML, which a browser could run.
 */
function sniffPlainText(buf: Buffer, fileName: string): string | null {
  const ext = fileName.toLowerCase().match(/\.(txt|csv)$/)?.[1];
  if (!ext || buf.length === 0) return null;
  if (buf.includes(0)) return null;
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, 64 * 1024));
  } catch {
    return null;
  }
  // Control characters other than tab, newline and carriage return mean binary.
  if (/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) return null;
  if (/^\s*(<!doctype|<html|<svg|<\?xml|<script)/i.test(text) || /<script[\s>]/i.test(text)) return null;
  return ext === 'csv' ? 'text/csv' : 'text/plain';
}

/** An Office file that carries a VBA macro project, whatever its extension says. */
function hasOfficeMacros(buf: Buffer): boolean {
  return buf.includes('vbaProject.bin') || buf.includes('vbaData.xml');
}

/**
 * Validates chat attachment (images + PDF) using magic bytes.
 * PDF: magic is %PDF; allow one optional leading whitespace byte (some generators add it).
 */
export async function validateChatAttachmentMagicBytes(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  /** Only used for .txt/.csv, which have no magic bytes. */
  fileName = ''
): Promise<{ isValid: boolean; mimeType: string | null }> {
  try {
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as ArrayBuffer);
    const fileType = await fileTypeFromBuffer(buf);
    if (!fileType) {
      const pdfMagic = [0x25, 0x50, 0x44, 0x46]; // %PDF
      const at = buf[0] === 0x20 || buf[0] === 0x0a || buf[0] === 0x0d || buf[0] === 0x09 ? 1 : 0;
      const hasPdfMagic =
        buf.length >= at + 4 && pdfMagic.every((byte, i) => buf[at + i] === byte);
      if (hasPdfMagic) {
        return { isValid: true, mimeType: 'application/pdf' };
      }
      const text = sniffPlainText(buf, fileName);
      return text ? { isValid: true, mimeType: text } : { isValid: false, mimeType: null };
    }
    const isOffice = fileType.mime.startsWith('application/vnd.openxmlformats-officedocument.');
    if (isOffice && hasOfficeMacros(buf)) return { isValid: false, mimeType: fileType.mime };
    const isValid = (ALLOWED_CHAT_ATTACHMENT_TYPES as readonly string[]).includes(fileType.mime);
    return { isValid, mimeType: fileType.mime };
  } catch {
    return { isValid: false, mimeType: null };
  }
}

/** Allowed invoice attachment MIME types (images + PDF), same as chat. */
export const ALLOWED_INVOICE_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

/**
 * Validates invoice attachment (images + PDF) using magic bytes. Same logic as chat attachments.
 */
export async function validateInvoiceAttachmentMagicBytes(
  buffer: Buffer | ArrayBuffer | Uint8Array
): Promise<{ isValid: boolean; mimeType: string | null }> {
  return validateChatAttachmentMagicBytes(buffer);
}


