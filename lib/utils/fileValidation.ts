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
  chat: 10 * 1024 * 1024, // 10MB per chat attachment (images + PDF)
} as const;

/** Allowed chat attachment MIME types (images + PDF) */
export const ALLOWED_CHAT_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

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
  };
  return mimeToExt[mimeType] || '.bin';
}

/**
 * Validates chat attachment (images + PDF) using magic bytes.
 * PDF: magic is %PDF; allow one optional leading whitespace byte (some generators add it).
 */
export async function validateChatAttachmentMagicBytes(
  buffer: Buffer | ArrayBuffer | Uint8Array
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
      return { isValid: false, mimeType: null };
    }
    const isValid = (ALLOWED_CHAT_ATTACHMENT_TYPES as readonly string[]).includes(fileType.mime);
    return { isValid, mimeType: fileType.mime };
  } catch {
    return { isValid: false, mimeType: null };
  }
}

