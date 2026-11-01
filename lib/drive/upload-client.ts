'use client';

import { createClient } from '@/lib/supabase/client';
import { PRO_DRIVE_BUCKET, buildProDriveStoragePath, isImageMime, isProDriveMime } from '@/lib/drive/constants';
import type { DriveFile, DriveOwnerType, DriveUsage } from '@/lib/drive/types';
import { optimizeImage } from '@/lib/utils/imageOptimization';

export class ProDriveQuotaClientError extends Error {
  usage: DriveUsage;
  constructor(usage: DriveUsage) {
    super('DRIVE_QUOTA_EXCEEDED');
    this.usage = usage;
  }
}

async function readError(response: Response): Promise<{ error?: string; usage?: DriveUsage }> {
  try {
    return (await response.json()) as { error?: string; usage?: DriveUsage };
  } catch {
    return {};
  }
}

/**
 * Upload into ProDrive. Quota is checked first. The catalog insert rolls the
 * blob back when it fails.
 */
export async function uploadProDriveFile(input: {
  file: File;
  ownerType: DriveOwnerType;
  ownerId: string;
  folderId?: string | null;
  ensureFolderNames?: string[];
}): Promise<DriveFile> {
  let file = input.file;
  if (isImageMime(file.type)) {
    file = await optimizeImage(file, { maxSizeMB: 2, maxWidthOrHeight: 1920 });
  }
  if (!isProDriveMime(file.type)) {
    throw new Error('File type is not allowed');
  }

  const quotaResponse = await fetch('/api/prodrive/quota', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ additionalBytes: file.size }),
  });
  if (quotaResponse.status === 402) {
    const body = await readError(quotaResponse);
    if (body.usage) throw new ProDriveQuotaClientError(body.usage);
    throw new Error('ProDrive is full');
  }
  if (!quotaResponse.ok) {
    const body = await readError(quotaResponse);
    throw new Error(body.error || 'Could not check storage');
  }

  let folderId = input.folderId ?? null;
  if (input.ensureFolderNames?.length) {
    const folderResponse = await fetch('/api/prodrive/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        names: input.ensureFolderNames,
      }),
    });
    if (!folderResponse.ok) {
      const body = await readError(folderResponse);
      throw new Error(body.error || 'Could not open the folder');
    }
    const created = (await folderResponse.json()) as { folderId: string | null };
    folderId = created.folderId;
  }

  const id = crypto.randomUUID();
  const storagePath = buildProDriveStoragePath(input.ownerType, input.ownerId, id, file.type);
  const supabase = createClient();
  const uploaded = await supabase.storage.from(PRO_DRIVE_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploaded.error) throw new Error(uploaded.error.message);

  const registerResponse = await fetch('/api/prodrive/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      id,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      folderId,
      name: file.name || 'photo.jpg',
      mimeType: file.type,
      sizeBytes: file.size,
      storagePath,
    }),
  });
  if (!registerResponse.ok) {
    await supabase.storage.from(PRO_DRIVE_BUCKET).remove([storagePath]);
    if (registerResponse.status === 402) {
      const body = await readError(registerResponse);
      if (body.usage) throw new ProDriveQuotaClientError(body.usage);
    }
    const body = await readError(registerResponse);
    throw new Error(body.error || 'Could not save the file');
  }
  const payload = (await registerResponse.json()) as { file: DriveFile };
  return payload.file;
}
