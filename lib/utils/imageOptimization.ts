/**
 * Client-side image optimization utilities
 * Compresses and resizes images before upload to reduce bandwidth and storage
 */

import imageCompression from 'browser-image-compression';

export interface ImageOptimizationOptions {
  maxSizeMB?: number; // Maximum file size in MB
  maxWidthOrHeight?: number; // Maximum width or height in pixels
  useWebWorker?: boolean; // Use web worker for compression (default: true)
  quality?: number; // Image quality 0-1 (default: 0.8)
}

const DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
  maxSizeMB: 2,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  quality: 0.8,
};

/**
 * Optimize image file before upload
 * 
 * @param file - Image file to optimize
 * @param options - Optimization options
 * @returns Optimized File object
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB: opts.maxSizeMB,
      maxWidthOrHeight: opts.maxWidthOrHeight,
      useWebWorker: opts.useWebWorker,
      initialQuality: opts.quality,
    });

    return compressedFile;
  } catch (error) {
    // If compression fails, return original file
    console.error('Image compression failed:', error);
    return file;
  }
}

/**
 * Optimize image for profile picture
 * Smaller size and dimensions for profile pictures
 */
export async function optimizeProfilePicture(file: File): Promise<File> {
  return optimizeImage(file, {
    maxSizeMB: 1, // 1MB max for profile pictures
    maxWidthOrHeight: 800, // 800px max dimension
    quality: 0.85,
  });
}

/**
 * Optimize image for business logo
 * Medium size for logos
 */
export async function optimizeBusinessLogo(file: File): Promise<File> {
  return optimizeImage(file, {
    maxSizeMB: 1.5, // 1.5MB max for logos
    maxWidthOrHeight: 1200, // 1200px max dimension
    quality: 0.85,
  });
}

/**
 * Optimize image for business background
 * Larger size allowed for backgrounds
 */
export async function optimizeBusinessBackground(file: File): Promise<File> {
  return optimizeImage(file, {
    maxSizeMB: 4, // 4MB max for backgrounds (server will enforce 5MB)
    maxWidthOrHeight: 1920, // 1920px max dimension
    quality: 0.8,
  });
}

/**
 * Convert File to base64 data URL
 * Useful for preview or direct upload
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Validate image file before optimization
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  // Check file size (before optimization)
  const maxSize = 10 * 1024 * 1024; // 10MB absolute max
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  return { valid: true };
}

