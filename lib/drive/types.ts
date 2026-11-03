export type DriveOwnerType = 'user' | 'business';

export interface DriveOwnerScope {
  ownerType: DriveOwnerType;
  ownerId: string;
}

export interface DriveFolder {
  id: string;
  ownerType: DriveOwnerType;
  ownerId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriveFile {
  id: string;
  ownerType: DriveOwnerType;
  ownerId: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
  updatedAt: string;
  previewUrl?: string | null;
}

export interface DriveBreadcrumb {
  id: string | null;
  name: string;
}

export interface DriveUsage {
  usedBytes: number;
  freeBytes: number;
  overageBytes: number;
  plan: 'free' | 'pro';
  overageEnabled: boolean;
  percentUsed: number;
  isAtWarning: boolean;
  isAtLimit: boolean;
}

export interface DriveListResult {
  folders: DriveFolder[];
  files: DriveFile[];
  breadcrumbs: DriveBreadcrumb[];
}
