'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Folder, FileText, Upload, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProDriveMeter } from '@/components/drive/ProDriveMeter';
import { ProDriveQuotaModal } from '@/components/drive/ProDriveQuotaModal';
import { uploadProDriveFile, ProDriveQuotaClientError } from '@/lib/drive/upload-client';
import { formatDriveBytes } from '@/lib/drive/quota';
import type { DriveFile, DriveFolder, DriveListResult, DriveOwnerType, DriveUsage } from '@/lib/drive/types';

interface ProDriveBrowserProps {
  ownerType: DriveOwnerType;
  ownerId: string;
  selectionMode?: boolean;
  onSelectFile?: (file: DriveFile) => void;
}

export function ProDriveBrowser({ ownerType, ownerId, selectionMode = false, onSelectFile }: ProDriveBrowserProps) {
  const t = useTranslations('prodrive');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [listing, setListing] = useState<DriveListResult | null>(null);
  const [usage, setUsage] = useState<DriveUsage | null>(null);
  const [quota, setQuota] = useState<DriveUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [folderName, setFolderName] = useState('');
  const [rename, setRename] = useState<{ kind: 'file' | 'folder'; id: string; name: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const refresh = () => setReloadKey((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ ownerType, ownerId });
    if (folderId) params.set('folderId', folderId);
    void Promise.all([
      fetch(`/api/prodrive/folder?${params}`, { credentials: 'include' }),
      fetch('/api/prodrive/usage', { credentials: 'include' }),
    ]).then(async ([folderResponse, usageResponse]) => {
      if (cancelled) return;
      if (!folderResponse.ok) {
        const body = (await folderResponse.json()) as { error?: string };
        setError(body.error || t('loadFailed'));
        setLoading(false);
        return;
      }
      setListing((await folderResponse.json()) as DriveListResult);
      if (usageResponse.ok) {
        const body = (await usageResponse.json()) as { usage: DriveUsage };
        setUsage(body.usage);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerType, ownerId, folderId, reloadKey, t]);

  const uploadFiles = async (files: FileList | File[]) => {
    setError(null);
    for (const file of Array.from(files)) {
      try {
        await uploadProDriveFile({ file, ownerType, ownerId, folderId });
      } catch (uploadError) {
        if (uploadError instanceof ProDriveQuotaClientError) {
          setQuota(uploadError.usage);
          break;
        }
        setError(uploadError instanceof Error ? uploadError.message : t('uploadFailed'));
        break;
      }
    }
    refresh();
  };

  const moveFile = async (fileId: string, targetFolderId: string | null) => {
    const response = await fetch(`/api/prodrive/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ folderId: targetFolderId }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error || t('moveFailed'));
      return;
    }
    refresh();
  };

  const createFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    const response = await fetch('/api/prodrive/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ownerType, ownerId, parentId: folderId, name }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error || t('folderFailed'));
      return;
    }
    setFolderName('');
    refresh();
  };

  const saveRename = async () => {
    if (!rename) return;
    const path = rename.kind === 'file' ? `/api/prodrive/files/${rename.id}` : `/api/prodrive/folders/${rename.id}`;
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: rename.name }),
    });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error || t('renameFailed'));
      return;
    }
    setRename(null);
    refresh();
  };

  const remove = async (kind: 'file' | 'folder', id: string) => {
    const path = kind === 'file' ? `/api/prodrive/files/${id}` : `/api/prodrive/folders/${id}`;
    const response = await fetch(path, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      setError(body.error || t('deleteFailed'));
      return;
    }
    refresh();
  };

  const download = async (file: DriveFile) => {
    const response = await fetch(`/api/prodrive/files/${file.id}/url`, { credentials: 'include' });
    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !body.url) {
      setError(body.error || t('downloadFailed'));
      return;
    }
    window.open(body.url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {listing?.breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.id ?? 'root'}-${index}`} className="flex items-center gap-1">
              {index > 0 && <span>/</span>}
              <button
                type="button"
                className="underline cursor-pointer"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const fileId = event.dataTransfer.getData('text/prodrive-file');
                  if (fileId) void moveFile(fileId, crumb.id);
                }}
                onClick={() => setFolderId(crumb.id)}
              >
                {index === 0 ? t('root') : crumb.name}
              </button>
            </span>
          ))}
        </nav>
        {!selectionMode && <ProDriveMeter usage={usage} />}
      </div>

      {!selectionMode && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4 inline mr-2" />
            {t('upload')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void uploadFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <input
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder={t('newFolder')}
            className="border-2 border-black rounded-lg px-3 py-2 text-sm"
          />
          <Button type="button" variant="secondary" onClick={createFolder}>
            {t('createFolder')}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm">{t('loading')}</p>}

      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          if (event.dataTransfer.files?.length) void uploadFiles(event.dataTransfer.files);
        }}
      >
        {listing?.folders.map((folder) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            selectionMode={selectionMode}
            onOpen={() => setFolderId(folder.id)}
            onRename={() => setRename({ kind: 'folder', id: folder.id, name: folder.name })}
            onDelete={() => void remove('folder', folder.id)}
            onDropFile={(fileId) => void moveFile(fileId, folder.id)}
          />
        ))}
        {listing?.files.map((file) => (
          <FileCard
            key={file.id}
            file={file}
            selectionMode={selectionMode}
            onSelect={() => onSelectFile?.(file)}
            onRename={() => setRename({ kind: 'file', id: file.id, name: file.name })}
            onDelete={() => void remove('file', file.id)}
            onDownload={() => void download(file)}
          />
        ))}
      </div>

      {!loading && listing && listing.folders.length === 0 && listing.files.length === 0 && (
        <p className="text-sm text-gray-600">{t('empty')}</p>
      )}

      {rename && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={rename.name}
            onChange={(event) => setRename({ ...rename, name: event.target.value })}
            className="border-2 border-black rounded-lg px-3 py-2 text-sm"
          />
          <Button type="button" onClick={() => void saveRename()}>{t('rename')}</Button>
          <Button type="button" variant="secondary" onClick={() => setRename(null)}>{t('cancel')}</Button>
        </div>
      )}

      <ProDriveQuotaModal usage={quota} onClose={() => setQuota(null)} />
    </div>
  );
}

function FolderCard({
  folder,
  selectionMode,
  onOpen,
  onRename,
  onDelete,
  onDropFile,
}: {
  folder: DriveFolder;
  selectionMode: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDropFile: (fileId: string) => void;
}) {
  const t = useTranslations('prodrive');
  return (
    <div
      className="border-2 border-black rounded-lg p-3 bg-white"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const fileId = event.dataTransfer.getData('text/prodrive-file');
        if (fileId) onDropFile(fileId);
      }}
    >
      <button type="button" className="flex items-center gap-2 font-medium cursor-pointer text-left" onClick={onOpen}>
        <Folder className="w-5 h-5 shrink-0" />
        <span className="truncate">{folder.name}</span>
      </button>
      {!selectionMode && (
        <div className="mt-2 flex gap-2 text-xs">
          <button type="button" className="underline cursor-pointer" onClick={onRename}>{t('rename')}</button>
          <button type="button" className="underline cursor-pointer" onClick={onDelete}>{t('delete')}</button>
        </div>
      )}
    </div>
  );
}

function FileCard({
  file,
  selectionMode,
  onSelect,
  onRename,
  onDelete,
  onDownload,
}: {
  file: DriveFile;
  selectionMode: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const t = useTranslations('prodrive');
  return (
    <div
      className="border-2 border-black rounded-lg p-3 bg-white"
      draggable={!selectionMode}
      onDragStart={(event) => event.dataTransfer.setData('text/prodrive-file', file.id)}
    >
      <button type="button" className="w-full text-left cursor-pointer" onClick={selectionMode ? onSelect : onDownload}>
        {file.previewUrl ? (
          // Signed Supabase URLs are not in the Next image allowlist for every project.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.previewUrl} alt="" className="w-full h-24 object-cover rounded mb-2 bg-gray-100" />
        ) : (
          <FileText className="w-8 h-8 mb-2" />
        )}
        <span className="block truncate text-sm font-medium">{file.name}</span>
        <span className="text-xs text-gray-600">{formatDriveBytes(file.sizeBytes)}</span>
      </button>
      {!selectionMode && (
        <div className="mt-2 flex gap-2 text-xs">
          <button type="button" className="underline cursor-pointer" onClick={onDownload}><Download className="w-3 h-3 inline" /> {t('download')}</button>
          <button type="button" className="underline cursor-pointer" onClick={onRename}>{t('rename')}</button>
          <button type="button" className="underline cursor-pointer" onClick={onDelete}><Trash2 className="w-3 h-3 inline" /> {t('delete')}</button>
        </div>
      )}
    </div>
  );
}
