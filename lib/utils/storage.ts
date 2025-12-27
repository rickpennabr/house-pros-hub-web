import { createClient } from '@/lib/supabase/client';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * Extract file path from a Supabase Storage URL or return the path if already a path
 * @param filePathOrUrl - The file path or full URL
 * @param bucket - The storage bucket name
 * @returns The extracted file path or null if extraction fails
 */
function extractFilePath(filePathOrUrl: string, bucket: string): string | null {
  if (!filePathOrUrl) {
    return null;
  }

  // If it's already a path (doesn't start with http), return it
  if (!filePathOrUrl.startsWith('http')) {
    // Remove bucket prefix if present
    const bucketPrefix = `${bucket}/`;
    if (filePathOrUrl.startsWith(bucketPrefix)) {
      return filePathOrUrl.slice(bucketPrefix.length);
    }
    return filePathOrUrl;
  }

  // Extract path from URL
  // Supabase storage URLs look like: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
  try {
    const url = new URL(filePathOrUrl);
    const pathParts = url.pathname.split('/');
    const bucketIndex = pathParts.indexOf(bucket);
    
    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
      // Get everything after the bucket name
      return pathParts.slice(bucketIndex + 1).join('/');
    }
    
    // Fallback: try to extract from the end of the path
    const lastSlash = url.pathname.lastIndexOf('/');
    if (lastSlash !== -1) {
      return url.pathname.slice(lastSlash + 1);
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Upload profile picture to Supabase Storage
 * @param userId - The user's ID
 * @param file - The image file to upload
 * @returns The public URL of the uploaded image, or null if upload fails
 */
export async function uploadProfilePicture(userId: string, file: File): Promise<string | null> {
  try {
    const supabase = createClient();
    
    // Create bucket if it doesn't exist (this will be done via migration, but handle gracefully)
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const filePath = `profile-pictures/${fileName}`;

    const { data, error } = await supabase.storage
      .from('profile-pictures')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading profile picture:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadProfilePicture:', error);
    return null;
  }
}

/**
 * Upload business logo to Supabase Storage
 * @param businessId - The business ID
 * @param file - The image file to upload
 * @returns The public URL of the uploaded image, or null if upload fails
 */
export async function uploadBusinessLogo(businessId: string, file: File): Promise<string | null> {
  try {
    const supabase = createClient();
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${businessId}/logo-${Date.now()}.${fileExt}`;
    const filePath = `business-logos/${fileName}`;

    const { data, error } = await supabase.storage
      .from('business-logos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading business logo:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('business-logos')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadBusinessLogo:', error);
    return null;
  }
}

/**
 * Upload business background to Supabase Storage
 * @param businessId - The business ID
 * @param file - The image file to upload
 * @param businessName - Optional business name for filename
 * @returns The public URL of the uploaded image, or null if upload fails
 */
export async function uploadBusinessBackground(businessId: string, file: File, businessName?: string): Promise<string | null> {
  try {
    const supabase = createClient();
    
    // Sanitize company name for filename
    let fileName: string;
    if (businessName) {
      const sanitizedName = businessName
        .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters
        .replace(/\s+/g, '') // Remove spaces
        .substring(0, 50); // Limit length
      const fileExt = file.name.split('.').pop();
      fileName = sanitizedName ? `Background-${sanitizedName}.${fileExt}` : `Background-${Date.now()}.${fileExt}`;
    } else {
      const fileExt = file.name.split('.').pop();
      fileName = `Background-${Date.now()}.${fileExt}`;
    }
    
    const filePath = `${businessId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('business-backgrounds')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading business background:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('business-backgrounds')
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Error in uploadBusinessBackground:', error);
    return null;
  }
}

/**
 * Delete a file from Supabase Storage
 * Uses service role client to bypass RLS restrictions
 * @param bucket - The storage bucket name
 * @param filePath - The path or URL to the file to delete
 * @returns true if successful, false otherwise
 */
export async function deleteStorageFile(bucket: string, filePath: string): Promise<boolean> {
  try {
    if (!filePath) {
      return false;
    }

    // Extract path from URL if full URL is provided
    const path = extractFilePath(filePath, bucket);
    if (!path) {
      console.warn(`Could not extract path from ${filePath} for bucket ${bucket}`);
      return false;
    }

    // Use service role client for deletion to bypass RLS
    const serviceRoleClient = createServiceRoleClient();

    const { error } = await serviceRoleClient.storage
      .from(bucket)
      .remove([path]);

    if (error) {
      // Don't log if file doesn't exist (common when cleanup runs after deletion)
      if (error.message?.includes('not found')) {
        return true; // Consider "not found" as success for cleanup operations
      }
      console.error(`Error deleting file from ${bucket}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteStorageFile:', error);
    return false;
  }
}

/**
 * Delete old profile picture when user uploads a new one
 */
export async function deleteProfilePicture(imageUrl: string): Promise<boolean> {
  return deleteStorageFile('profile-pictures', imageUrl);
}

/**
 * Delete old business logo when user uploads a new one
 */
export async function deleteBusinessLogo(imageUrl: string): Promise<boolean> {
  return deleteStorageFile('business-logos', imageUrl);
}

/**
 * Delete old business background when user uploads a new one
 */
export async function deleteBusinessBackground(imageUrl: string): Promise<boolean> {
  return deleteStorageFile('business-backgrounds', imageUrl);
}

