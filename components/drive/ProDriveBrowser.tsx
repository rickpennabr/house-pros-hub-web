'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Folder, FileText, Upload, Trash2, Download, FolderPlus, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProDriveMeter } from '@/components/drive/ProDriveMeter';
import { ProDriveQuotaModal } from '@/components/drive/ProDriveQuotaModal';
import { ProDriveUploadStatus, type ProDriveUploadItem } from '@/components/drive/ProDriveUploadStatus';
import { uploadProDriveFile, ProDriveQuotaClientError } from '@/lib/drive/upload-client';
import { formatDriveBytes } from '@/lib/drive/quota';
import type { DriveFile, DriveFolder, DriveListResult, DriveOwnerType, DriveUsage } from '@/lib/drive/types';

interface ProDriveBrowserProps {
  ownerType: DriveOwnerType;
  ownerId: string;
  selectionMode?: boolean;
  onSelectFile?: (file: DriveFile) => void;
  /** Full-screen drive canvas. The picker modal keeps the compact grid. */
  variant?: 'picker' | 'workspace';
  filterQuery?: string;
  onUsageChange?: (usage: DriveUsage | null) => void;
}

export function ProDriveBrowser({
  ownerType,
  ownerId,
  selectionMode = false,
  onSelectFile,
  variant = 'picker',
  filterQuery = '',
  onUsageChange,
}: ProDriveBrowserProps) {
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
  const dragDepth = useRef(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<ProDriveUploadItem[]>([]);
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

  useEffect(() => {
    onUsageChange?.(usage);
  }, [usage, onUsageChange]);

  const uploadFiles = async (files: FileList | File[]) => {
    setError(null);
    const batch = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name || 'file',
      file,
    }));
    setUploads((current) => [
      ...batch.map((item) => ({ id: item.id, name: item.name, status: 'uploading' as const })),
      ...current,
    ]);

    let stopped = false;
    let savedAny = false;
    for (const item of batch) {
      if (stopped) {
        setUploads((current) => current.filter((row) => row.id !== item.id));
        continue;
      }
      try {
        await uploadProDriveFile({ file: item.file, ownerType, ownerId, folderId });
        savedAny = true;
        setUploads((current) => current.map((row) => (row.id === item.id ? { ...row, status: 'done' } : row)));
        refresh();
      } catch (uploadError) {
        const message = uploadError instanceof Error ? uploadError.message : t('uploadFailed');
        if (uploadError instanceof ProDriveQuotaClientError) {
          setQuota(uploadError.usage);
          stopped = true;
        }
        setError(message);
        setUploads((current) => current.map((row) => (
          row.id === item.id ? { ...row, status: 'error', error: message } : row
        )));
      }
    }
    if (savedAny) refresh();
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

  const query = filterQuery.trim().toLowerCase();
  const folders = (listing?.folders ?? []).filter((folder) => !query || folder.name.toLowerCase().includes(query));
  const files = (listing?.files ?? []).filter((file) => !query || file.name.toLowerCase().includes(query));
  const atRoot = !listing || listing.breadcrumbs.length <= 1;
  const heading = atRoot ? t('myDrive') : listing.breadcrumbs[listing.breadcrumbs.length - 1]?.name ?? t('myDrive');

  const beginExternalDrag = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  };

  const endExternalDrag = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  };

  if (variant === 'workspace') {
    return (
      <div className="flex h-full min-h-[70vh] flex-1 flex-col md:min-h-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black px-4 py-3 md:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-black">{heading}</h2>
            <nav className="mt-1 flex flex-wrap items-center gap-1 text-sm text-black">
              {listing?.breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.id ?? 'root'}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <span className="text-gray-500">/</span>}
                  <button
                    type="button"
                    className="cursor-pointer underline"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      const fileId = event.dataTransfer.getData('text/prodrive-file');
                      if (fileId) void moveFile(fileId, crumb.id);
                    }}
                    onClick={() => setFolderId(crumb.id)}
                  >
                    {index === 0 ? t('myDrive') : crumb.name}
                  </button>
                </span>
              ))}
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" className="inline-flex h-10 items-center gap-2 py-0" onClick={() => inputRef.current?.click()}>
              <Upload className="h-4 w-4" />
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
              onKeyDown={(event) => {
                if (event.key === 'Enter') void createFolder();
              }}
              placeholder={t('newFolder')}
              className="h-10 w-40 rounded-lg border-2 border-black px-3 text-sm"
            />
            <Button type="button" variant="secondary" className="inline-flex h-10 items-center gap-2 py-0" onClick={createFolder}>
              <FolderPlus className="h-4 w-4" />
              {t('createFolder')}
            </Button>
          </div>
        </div>

        {error && <p className="px-4 py-2 text-sm text-red-600 md:px-6">{error}</p>}

        <div
          className="relative min-h-0 flex-1 overflow-y-auto"
          onDragEnter={beginExternalDrag}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={endExternalDrag}
          onDrop={(event) => {
            dragDepth.current = 0;
            setDragOver(false);
            if (event.dataTransfer.files?.length) void uploadFiles(event.dataTransfer.files);
          }}
        >
          {loading && <p className="px-4 py-6 text-sm md:px-6">{t('loading')}</p>}

          {!loading && folders.length === 0 && files.length === 0 && (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg border-2 border-black">
                <HardDrive className="h-8 w-8 text-red-600" />
              </div>
              <p className="text-lg font-semibold text-black">{query ? t('noMatches') : t('dropTitle')}</p>
              {!query && <p className="mt-2 max-w-sm text-sm text-gray-600">{t('empty')}</p>}
            </div>
          )}

          {(folders.length > 0 || files.length > 0) && (
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b-2 border-black text-xs font-medium uppercase tracking-wide text-gray-600">
                  <th className="px-4 py-2 font-medium md:px-6">{t('nameColumn')}</th>
                  <th className="hidden w-28 px-2 py-2 font-medium md:table-cell">{t('typeColumn')}</th>
                  <th className="hidden w-44 px-2 py-2 font-medium md:table-cell">{t('modifiedColumn')}</th>
                  <th className="w-28 px-2 py-2 font-medium">{t('sizeColumn')}</th>
                  <th className="w-32 px-2 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {folders.map((folder) => (
                  <WorkspaceFolderRow
                    key={folder.id}
                    folder={folder}
                    renaming={rename?.kind === 'folder' && rename.id === folder.id ? rename.name : null}
                    onRenameChange={(name) => setRename({ kind: 'folder', id: folder.id, name })}
                    onOpen={() => setFolderId(folder.id)}
                    onStartRename={() => setRename({ kind: 'folder', id: folder.id, name: folder.name })}
                    onSaveRename={() => void saveRename()}
                    onCancelRename={() => setRename(null)}
                    onDelete={() => void remove('folder', folder.id)}
                    onDropFile={(fileId) => void moveFile(fileId, folder.id)}
                  />
                ))}
                {files.map((file) => (
                  <WorkspaceFileRow
                    key={file.id}
                    file={file}
                    renaming={rename?.kind === 'file' && rename.id === file.id ? rename.name : null}
                    onRenameChange={(name) => setRename({ kind: 'file', id: file.id, name })}
                    onStartRename={() => setRename({ kind: 'file', id: file.id, name: file.name })}
                    onSaveRename={() => void saveRename()}
                    onCancelRename={() => setRename(null)}
                    onDelete={() => void remove('file', file.id)}
                    onDownload={() => void download(file)}
                  />
                ))}
              </tbody>
            </table>
          )}

          {dragOver && (
            <div className="pointer-events-none absolute inset-4 flex items-center justify-center rounded-lg border-2 border-dashed border-black bg-white/90">
              <p className="text-lg font-semibold text-black">{t('dropTitle')}</p>
            </div>
          )}
        </div>

        <ProDriveQuotaModal usage={quota} onClose={() => setQuota(null)} />
        <ProDriveUploadStatus
          items={uploads}
          onDismiss={() => setUploads((current) => current.filter((item) => item.status === 'uploading'))}
        />
      </div>
    );
  }

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
      <ProDriveUploadStatus
        items={uploads}
        onDismiss={() => setUploads((current) => current.filter((item) => item.status === 'uploading'))}
      />
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

function formatDriveDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fileTypeLabel(mime: string, labels: { image: string; video: string; audio: string; text: string; file: string }): string {
  if (mime === 'image/png') return 'PNG';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'JPEG';
  if (mime === 'image/webp') return 'WebP';
  if (mime === 'image/gif') return 'GIF';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return labels.image;
  if (mime.startsWith('video/')) return labels.video;
  if (mime.startsWith('audio/')) return labels.audio;
  if (mime.startsWith('text/')) return labels.text;
  const subtype = mime.split('/')[1];
  return subtype ? subtype.replace(/[^a-z0-9]+/gi, ' ').toUpperCase() : labels.file;
}

function WorkspaceFolderRow({
  folder,
  renaming,
  onRenameChange,
  onOpen,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
  onDropFile,
}: {
  folder: DriveFolder;
  renaming: string | null;
  onRenameChange: (name: string) => void;
  onOpen: () => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onDropFile: (fileId: string) => void;
}) {
  const t = useTranslations('prodrive');
  const locale = useLocale();
  return (
    <tr
      className="border-b border-black/10 hover:bg-gray-50"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        const fileId = event.dataTransfer.getData('text/prodrive-file');
        if (fileId) {
          event.stopPropagation();
          onDropFile(fileId);
        }
      }}
    >
      <td className="overflow-hidden px-4 py-2 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Folder className="h-5 w-5 shrink-0 text-red-600" />
          {renaming !== null ? (
            <input
              value={renaming}
              autoFocus
              onChange={(event) => onRenameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSaveRename();
                if (event.key === 'Escape') onCancelRename();
              }}
              className="h-8 min-w-0 flex-1 rounded-lg border-2 border-black px-2 text-sm"
            />
          ) : (
            <button type="button" className="min-w-0 truncate text-left text-sm font-medium cursor-pointer" onClick={onOpen}>
              {folder.name}
            </button>
          )}
        </div>
      </td>
      <td className="hidden px-2 py-2 text-gray-700 md:table-cell">{t('folderType')}</td>
      <td className="hidden px-2 py-2 text-gray-700 md:table-cell">{formatDriveDate(folder.updatedAt || folder.createdAt, locale)}</td>
      <td className="px-2 py-2 text-gray-500">—</td>
      <td className="px-2 py-2">
        <div className="flex justify-end gap-1">
          {renaming !== null ? (
            <>
              <TextAction label={t('rename')} onClick={onSaveRename} />
              <TextAction label={t('cancel')} onClick={onCancelRename} />
            </>
          ) : (
            <>
              <TextAction label={t('rename')} onClick={onStartRename} />
              <TextAction label={t('delete')} onClick={onDelete} />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function WorkspaceFileRow({
  file,
  renaming,
  onRenameChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
  onDownload,
}: {
  file: DriveFile;
  renaming: string | null;
  onRenameChange: (name: string) => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const t = useTranslations('prodrive');
  const locale = useLocale();
  const typeLabel = fileTypeLabel(file.mimeType, {
    image: t('typeImage'),
    video: t('typeVideo'),
    audio: t('typeAudio'),
    text: t('typeText'),
    file: t('typeFile'),
  });
  return (
    <tr
      className="border-b border-black/10 hover:bg-gray-50"
      draggable={renaming === null}
      onDragStart={(event) => event.dataTransfer.setData('text/prodrive-file', file.id)}
    >
      <td className="overflow-hidden px-4 py-2 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {file.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded border-2 border-black object-cover" />
          ) : (
            <FileText className="h-5 w-5 shrink-0 text-red-600" />
          )}
          {renaming !== null ? (
            <input
              value={renaming}
              autoFocus
              onChange={(event) => onRenameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSaveRename();
                if (event.key === 'Escape') onCancelRename();
              }}
              className="h-8 min-w-0 flex-1 rounded-lg border-2 border-black px-2 text-sm"
            />
          ) : (
            <button type="button" className="min-w-0 truncate text-left text-sm font-medium cursor-pointer" onClick={onDownload}>
              {file.name}
            </button>
          )}
        </div>
      </td>
      <td className="hidden px-2 py-2 text-gray-700 md:table-cell">{typeLabel}</td>
      <td className="hidden whitespace-nowrap px-2 py-2 text-gray-700 md:table-cell">{formatDriveDate(file.updatedAt || file.createdAt, locale)}</td>
      <td className="px-2 py-2 text-gray-700">{formatDriveBytes(file.sizeBytes)}</td>
      <td className="px-2 py-2">
        <div className="flex justify-end gap-1">
          {renaming !== null ? (
            <>
              <TextAction label={t('rename')} onClick={onSaveRename} />
              <TextAction label={t('cancel')} onClick={onCancelRename} />
            </>
          ) : (
            <>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-transparent cursor-pointer hover:border-black" title={t('download')} onClick={onDownload}>
                <Download className="h-4 w-4" />
              </button>
              <TextAction label={t('rename')} onClick={onStartRename} />
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-transparent cursor-pointer hover:border-black" title={t('delete')} onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function TextAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="cursor-pointer px-2 text-xs underline" onClick={onClick}>
      {label}
    </button>
  );
}
