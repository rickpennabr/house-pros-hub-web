/**
 * Resizes an image to fit within a maximum width and height while maintaining aspect ratio.
 * Returns a base64 string of the resized image.
 */
export async function resizeImage(
  base64Str: string,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { 
        willReadFrequently: false,
        alpha: true 
      });

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Enable high-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(err);
  });
}

/**
 * Resizes and crops an image to a square format (centered crop).
 * Perfect for profile pictures and avatars.
 * Returns a base64 string of the resized square image.
 * @param zoom Scale factor for zoom (0.5 = zoom out, 1.0 = normal, 2.0 = zoom in)
 * @param verticalPosition Vertical position offset (0-100, where 50 is center)
 * @param horizontalPosition Horizontal position offset (0-100, where 50 is center)
 */
export async function resizeImageSquare(
  base64Str: string,
  size: number = 400,
  quality: number = 0.85,
  zoom: number = 1.0,
  verticalPosition: number = 50,
  horizontalPosition: number = 50
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { 
        willReadFrequently: false,
        alpha: true 
      });

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Enable high-quality image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Calculate source dimensions for square crop with zoom
      // Zoom affects the crop size: zoom > 1 means smaller crop (zoom in), zoom < 1 means larger crop (zoom out)
      const baseSourceSize = Math.min(img.width, img.height);
      const sourceSize = baseSourceSize / zoom;
      
      // Horizontal position: 0 = left, 50 = center, 100 = right
      // Calculate the horizontal offset based on position percentage
      const horizontalOffset = ((horizontalPosition - 50) / 100) * (img.width - sourceSize);
      const sourceX = Math.max(0, Math.min(img.width - sourceSize, (img.width - sourceSize) / 2 + horizontalOffset));
      
      // Vertical position: 0 = top, 50 = center, 100 = bottom
      // Calculate the vertical offset based on position percentage
      const verticalOffset = ((verticalPosition - 50) / 100) * (img.height - sourceSize);
      const sourceY = Math.max(0, Math.min(img.height - sourceSize, (img.height - sourceSize) / 2 + verticalOffset));

      // Draw the square crop, scaled to target size
      ctx.drawImage(
        img,
        sourceX, sourceY, sourceSize, sourceSize, // Source: square crop with zoom and position
        0, 0, size, size // Destination: full canvas
      );

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(err);
  });
}

/**
 * Validates file size (in MB)
 */
export function validateFileSize(file: File, maxSizeMB: number = 2): boolean {
  const byteSize = file.size;
  const mbSize = byteSize / (1024 * 1024);
  return mbSize <= maxSizeMB;
}

/**
 * Converts a base64 data URL to a File object
 * @param base64String - Base64 data URL (e.g., "data:image/jpeg;base64,...")
 * @param filename - Optional filename for the File object
 * @returns File object
 */
export function base64ToFile(base64String: string, filename: string = 'image.jpg'): File {
  // Remove data URL prefix if present
  const base64Data = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String;
  
  // Determine MIME type from data URL
  const mimeMatch = base64String.match(/data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  
  // Convert base64 to binary
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  
  // Create File object
  return new File([byteArray], filename, { type: mimeType });
}