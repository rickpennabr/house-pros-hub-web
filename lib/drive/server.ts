import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/supabase';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  PRO_DRIVE_BUCKET,
  PRO_DRIVE_MAX_BYTES,
  PRO_DRIVE_SIGNED_URL_SECONDS,
  buildProDriveStoragePath,
  isImageMime,
  isProDriveMime,
} from '@/lib/drive/constants';
import {
  buildAccountDriveUsage,
  quotaAllows,
  type AccountDriveUsage,
} from '@/lib/drive/quota';
import type { DriveBreadcrumb, DriveFile, DriveFolder, DriveListResult, DriveOwnerType } from '@/lib/drive/types';
import { getResendClient, getResendFromEmail } from '@/lib/utils/resend';
import { logger } from '@/lib/utils/logger';

type Db = SupabaseClient<Database>;

export class DriveQuotaError extends Error {
  usage: AccountDriveUsage;
  constructor(usage: AccountDriveUsage) {
    super('DRIVE_QUOTA_EXCEEDED');
    this.usage = usage;
  }
}

export async function requireDriveUser(): Promise<{ supabase: Db; user: User }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new DriveAuthError();
  }
  return { supabase, user: data.user };
}

export class DriveAuthError extends Error {
  constructor() {
    super('Authentication required');
  }
}

export class DriveForbiddenError extends Error {
  constructor() {
    super('Forbidden');
  }
}

export async function assertOwner(supabase: Db, userId: string, ownerType: DriveOwnerType, ownerId: string) {
  if (ownerType === 'user') {
    if (ownerId !== userId) throw new DriveForbiddenError();
    return;
  }
  const { data, error } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', ownerId)
    .eq('owner_id', userId)
    .maybeSingle();
  if (error || !data) throw new DriveForbiddenError();
}

function mapFolder(row: Database['public']['Tables']['pro_drive_folders']['Row']): DriveFolder {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    parentId: row.parent_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function mapFile(row: Database['public']['Tables']['pro_drive_files']['Row'], previewUrl?: string | null): DriveFile {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    folderId: row.folder_id,
    name: row.name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    storagePath: row.storage_path,
    createdAt: row.created_at,
    previewUrl: previewUrl ?? null,
  };
}

/** Service-role usage for the billing cron. The request has no user session. */
export async function getAccountDriveUsageForUser(userId: string): Promise<AccountDriveUsage> {
  const service = createServiceRoleClient();
  return getAccountDriveUsage(service, userId);
}

export async function getAccountDriveUsage(supabase: Db, userId: string): Promise<AccountDriveUsage> {
  const { data: businesses } = await supabase.from('businesses').select('id').eq('owner_id', userId);
  const businessIds = (businesses ?? []).map((row) => row.id);

  const { data: personal } = await supabase
    .from('pro_drive_files')
    .select('size_bytes')
    .eq('owner_type', 'user')
    .eq('owner_id', userId);
  let used = (personal ?? []).reduce((sum, row) => sum + Number(row.size_bytes), 0);

  if (businessIds.length > 0) {
    const { data: businessFiles } = await supabase
      .from('pro_drive_files')
      .select('size_bytes')
      .eq('owner_type', 'business')
      .in('owner_id', businessIds);
    used += (businessFiles ?? []).reduce((sum, row) => sum + Number(row.size_bytes), 0);
  }

  const { data: subscription } = await supabase
    .from('hub_subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .maybeSingle();
  const plan = subscription?.plan === 'pro' && (subscription.status === 'active' || subscription.status === 'trialing')
    ? 'pro'
    : 'free';

  const { data: billing } = await supabase
    .from('pro_drive_billing')
    .select('overage_enabled, warned_at_80, warned_at_100')
    .eq('user_id', userId)
    .maybeSingle();

  const usage = buildAccountDriveUsage({
    usedBytes: used,
    plan,
    overageEnabled: Boolean(billing?.overage_enabled),
  });

  void noteDriveWarnings(userId, usage, billing?.warned_at_80 ?? null, billing?.warned_at_100 ?? null);
  return usage;
}

async function noteDriveWarnings(
  userId: string,
  usage: AccountDriveUsage,
  warnedAt80: string | null,
  warnedAt100: string | null
) {
  const now = new Date().toISOString();
  const patch: Database['public']['Tables']['pro_drive_billing']['Update'] = {};
  if (usage.isAtWarning && !warnedAt80) patch.warned_at_80 = now;
  if (usage.isAtLimit && !warnedAt100) patch.warned_at_100 = now;
  if (Object.keys(patch).length === 0) return;

  try {
    const service = createServiceRoleClient();
    await service.from('pro_drive_billing').upsert({ user_id: userId, ...patch });
    const { data } = await service.auth.admin.getUserById(userId);
    const email = data.user?.email;
    if (!email) return;
    const resend = getResendClient();
    const subject = usage.isAtLimit ? 'ProDrive storage is full' : 'ProDrive storage is almost full';
    const body = usage.isAtLimit
      ? 'ProDrive has reached the included storage. Upgrade to Hub Pro or turn on pay-as-you-go to keep uploading.'
      : 'ProDrive is past 90% of the included storage. Upgrade to Hub Pro or turn on pay-as-you-go before uploads stop.';
    await resend.emails.send({
      from: getResendFromEmail(),
      to: email,
      subject,
      text: body,
    });
  } catch (error) {
    logger.warn('ProDrive quota email skipped', { userId, error: error instanceof Error ? error.message : 'unknown' });
  }
}

export async function assertProDriveQuota(supabase: Db, userId: string, additionalBytes: number): Promise<AccountDriveUsage> {
  const usage = await getAccountDriveUsage(supabase, userId);
  if (!quotaAllows(usage, additionalBytes)) throw new DriveQuotaError(usage);
  return usage;
}

async function folderBelongs(
  supabase: Db,
  folderId: string,
  ownerType: DriveOwnerType,
  ownerId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('pro_drive_folders')
    .select('id')
    .eq('id', folderId)
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .maybeSingle();
  return Boolean(data);
}

export async function ensureFolderPath(
  supabase: Db,
  userId: string,
  ownerType: DriveOwnerType,
  ownerId: string,
  names: string[]
): Promise<string | null> {
  await assertOwner(supabase, userId, ownerType, ownerId);
  let parentId: string | null = null;
  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;
    let query = supabase
      .from('pro_drive_folders')
      .select('*')
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .ilike('name', name);
    query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null);
    const { data: existing } = await query.maybeSingle();
    if (existing) {
      parentId = existing.id;
      continue;
    }
    const inserted: {
      data: { id: string } | null;
      error: { message: string } | null;
    } = await supabase
      .from('pro_drive_folders')
      .insert({
        owner_type: ownerType,
        owner_id: ownerId,
        parent_id: parentId,
        name,
        created_by: userId,
      })
      .select('id')
      .single();
    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message || 'Could not create folder');
    parentId = inserted.data.id;
  }
  return parentId;
}

export async function registerProDriveFile(
  supabase: Db,
  userId: string,
  input: {
    id: string;
    ownerType: DriveOwnerType;
    ownerId: string;
    folderId: string | null;
    name: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
  }
): Promise<DriveFile> {
  await assertOwner(supabase, userId, input.ownerType, input.ownerId);
  if (!isProDriveMime(input.mimeType)) throw new Error('File type is not allowed');
  if (input.sizeBytes <= 0 || input.sizeBytes > PRO_DRIVE_MAX_BYTES) throw new Error('File is too large');
  const expected = buildProDriveStoragePath(input.ownerType, input.ownerId, input.id, input.mimeType);
  if (input.storagePath !== expected) throw new Error('Storage path does not match the owner');
  if (input.folderId && !(await folderBelongs(supabase, input.folderId, input.ownerType, input.ownerId))) {
    throw new Error('Folder not found');
  }
  await assertProDriveQuota(supabase, userId, input.sizeBytes);

  const { data, error } = await supabase
    .from('pro_drive_files')
    .insert({
      id: input.id,
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      folder_id: input.folderId,
      name: input.name.trim(),
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      storage_path: input.storagePath,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error || !data) {
    await supabase.storage.from(PRO_DRIVE_BUCKET).remove([input.storagePath]);
    throw new Error(error?.message || 'Could not save the file');
  }
  return mapFile(data);
}

export async function listDriveFolder(
  supabase: Db,
  userId: string,
  ownerType: DriveOwnerType,
  ownerId: string,
  folderId: string | null
): Promise<DriveListResult> {
  await assertOwner(supabase, userId, ownerType, ownerId);
  if (folderId && !(await folderBelongs(supabase, folderId, ownerType, ownerId))) {
    throw new Error('Folder not found');
  }

  let folderQuery = supabase.from('pro_drive_folders').select('*').eq('owner_type', ownerType).eq('owner_id', ownerId);
  folderQuery = folderId ? folderQuery.eq('parent_id', folderId) : folderQuery.is('parent_id', null);
  let fileQuery = supabase.from('pro_drive_files').select('*').eq('owner_type', ownerType).eq('owner_id', ownerId);
  fileQuery = folderId ? fileQuery.eq('folder_id', folderId) : fileQuery.is('folder_id', null);

  const [{ data: folders }, { data: files }] = await Promise.all([
    folderQuery.order('name'),
    fileQuery.order('created_at', { ascending: false }),
  ]);

  const mappedFiles: DriveFile[] = [];
  for (const row of files ?? []) {
    let previewUrl: string | null = null;
    if (isImageMime(row.mime_type)) {
      const signed = await supabase.storage.from(PRO_DRIVE_BUCKET).createSignedUrl(row.storage_path, PRO_DRIVE_SIGNED_URL_SECONDS);
      previewUrl = signed.data?.signedUrl ?? null;
    }
    mappedFiles.push(mapFile(row, previewUrl));
  }

  const breadcrumbs = await buildBreadcrumbs(supabase, folderId);
  return {
    folders: (folders ?? []).map(mapFolder),
    files: mappedFiles,
    breadcrumbs,
  };
}

async function buildBreadcrumbs(supabase: Db, folderId: string | null): Promise<DriveBreadcrumb[]> {
  const crumbs: DriveBreadcrumb[] = [{ id: null, name: 'ProDrive' }];
  if (!folderId) return crumbs;
  const chain: DriveBreadcrumb[] = [];
  let current: string | null = folderId;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    const folder: {
      data: { id: string; name: string; parent_id: string | null } | null;
    } = await supabase.from('pro_drive_folders').select('id, name, parent_id').eq('id', current).maybeSingle();
    if (!folder.data) break;
    chain.unshift({ id: folder.data.id, name: folder.data.name });
    current = folder.data.parent_id;
  }
  return crumbs.concat(chain);
}

export async function createDriveFolder(
  supabase: Db,
  userId: string,
  ownerType: DriveOwnerType,
  ownerId: string,
  parentId: string | null,
  name: string
): Promise<DriveFolder> {
  await assertOwner(supabase, userId, ownerType, ownerId);
  if (parentId && !(await folderBelongs(supabase, parentId, ownerType, ownerId))) throw new Error('Folder not found');
  const { data, error } = await supabase
    .from('pro_drive_folders')
    .insert({
      owner_type: ownerType,
      owner_id: ownerId,
      parent_id: parentId,
      name: name.trim(),
      created_by: userId,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(error?.message || 'Could not create folder');
  return mapFolder(data);
}

export async function renameDriveFolder(supabase: Db, userId: string, folderId: string, name: string) {
  const { data: folder } = await supabase.from('pro_drive_folders').select('*').eq('id', folderId).maybeSingle();
  if (!folder) throw new Error('Folder not found');
  await assertOwner(supabase, userId, folder.owner_type, folder.owner_id);
  const { error } = await supabase.from('pro_drive_folders').update({ name: name.trim() }).eq('id', folderId);
  if (error) throw new Error(error.message);
}

export async function deleteDriveFolder(supabase: Db, userId: string, folderId: string) {
  const { data: folder } = await supabase.from('pro_drive_folders').select('*').eq('id', folderId).maybeSingle();
  if (!folder) throw new Error('Folder not found');
  await assertOwner(supabase, userId, folder.owner_type, folder.owner_id);
  const [{ count: childFolders }, { count: childFiles }] = await Promise.all([
    supabase.from('pro_drive_folders').select('id', { count: 'exact', head: true }).eq('parent_id', folderId),
    supabase.from('pro_drive_files').select('id', { count: 'exact', head: true }).eq('folder_id', folderId),
  ]);
  if ((childFolders ?? 0) > 0 || (childFiles ?? 0) > 0) throw new Error('Folder is not empty');
  const { error } = await supabase.from('pro_drive_folders').delete().eq('id', folderId);
  if (error) throw new Error(error.message);
}

export async function renameDriveFile(supabase: Db, userId: string, fileId: string, name: string) {
  const file = await ownedFile(supabase, userId, fileId);
  const { error } = await supabase.from('pro_drive_files').update({ name: name.trim() }).eq('id', file.id);
  if (error) throw new Error(error.message);
}

export async function moveDriveFile(supabase: Db, userId: string, fileId: string, folderId: string | null) {
  const file = await ownedFile(supabase, userId, fileId);
  if (folderId && !(await folderBelongs(supabase, folderId, file.owner_type, file.owner_id))) {
    throw new Error('Folder not found');
  }
  const { error } = await supabase.from('pro_drive_files').update({ folder_id: folderId }).eq('id', file.id);
  if (error) throw new Error(error.message);
}

export async function deleteDriveFile(supabase: Db, userId: string, fileId: string) {
  const file = await ownedFile(supabase, userId, fileId);
  await supabase.storage.from(PRO_DRIVE_BUCKET).remove([file.storage_path]);
  const { error } = await supabase.from('pro_drive_files').delete().eq('id', file.id);
  if (error) throw new Error(error.message);
}

async function ownedFile(supabase: Db, userId: string, fileId: string) {
  const { data: file } = await supabase.from('pro_drive_files').select('*').eq('id', fileId).maybeSingle();
  if (!file) throw new Error('File not found');
  await assertOwner(supabase, userId, file.owner_type, file.owner_id);
  return file;
}

export async function getDriveSignedUrl(supabase: Db, userId: string, fileId: string): Promise<string> {
  const file = await ownedFile(supabase, userId, fileId);
  const { data, error } = await supabase.storage.from(PRO_DRIVE_BUCKET).createSignedUrl(file.storage_path, PRO_DRIVE_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not open the file');
  return data.signedUrl;
}

export async function listOwnedBusinesses(supabase: Db, userId: string) {
  const { data, error } = await supabase.from('businesses').select('id, business_name').eq('owner_id', userId).order('business_name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function signDriveFilesForStaff(
  fileIds: string[],
  expiresIn = PRO_DRIVE_SIGNED_URL_SECONDS
): Promise<{ id: string; url: string; name: string }[]> {
  if (fileIds.length === 0) return [];
  const service = createServiceRoleClient();
  const { data: files } = await service.from('pro_drive_files').select('id, name, storage_path').in('id', fileIds);
  const signed = [];
  for (const file of files ?? []) {
    const { data } = await service.storage.from(PRO_DRIVE_BUCKET).createSignedUrl(file.storage_path, expiresIn);
    if (data?.signedUrl) signed.push({ id: file.id, url: data.signedUrl, name: file.name });
  }
  return signed;
}
