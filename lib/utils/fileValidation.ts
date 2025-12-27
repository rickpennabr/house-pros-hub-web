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
  profile: 2 * 1024 * 1024, // 2MB
  logo: 2 * 1024 * 1024, // 2MB
  background: 5 * 1024 * 1024, // 5MB
} as const;

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
  };
  
  return mimeToExt[mimeType] || '.jpg';
}

