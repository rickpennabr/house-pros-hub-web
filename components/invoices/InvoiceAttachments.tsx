'use client';

import { useRef, useState } from 'react';
import { Paperclip, Trash2, FileText, Image } from 'lucide-react';
import { MAX_FILE_SIZES } from '@/lib/utils/fileValidation';

const MAX_MB = 20;
const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

export interface PendingAttachment {
  id: string;
  file: File;
}

export interface SavedAttachment {
  id: string;
  fileName: string;
  url: string;
  fileSizeBytes: number;
  contentType: string;
}

interface InvoiceAttachmentsProps {
  /** When set, load/save/delete via API. When null, only pending files (for new invoice). */
  invoiceId: string | null;
  /** Saved attachments (from API). When invoiceId is set, pass from parent state. */
  saved: SavedAttachment[];
  /** Pending files (new invoice flow). Controlled by parent if needed. */
  pending: PendingAttachment[];
  onPendingAdd: (list: PendingAttachment[]) => void;
  onPendingRemove: (id: string) => void;
  onSavedRemove?: (id: string) => void;
  disabled?: boolean;
  /** Allow adding more (e.g. only for draft) */
  allowAdd?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InvoiceAttachments({
  invoiceId,
  saved,
  pending,
  onPendingAdd,
  onPendingRemove,
  onSavedRemove,
  disabled = false,
  allowAdd = true,
}: InvoiceAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const files = e.target.files;
    if (!files?.length) return;
    const next: PendingAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZES.invoiceAttachment) {
        setUploadError(`"${file.name}" exceeds ${MAX_MB} MB.`);
        continue;
      }
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) {
        setUploadError(`"${file.name}": only PDF, JPEG, PNG, WebP allowed.`);
        continue;
      }
      next.push({ id: `pending-${Date.now()}-${i}`, file });
    }
    if (next.length) onPendingAdd([...pending, ...next]);
    e.target.value = '';
  };

  const removeSaved = (id: string) => {
    if (!invoiceId || disabled) return;
    setUploadError(null);
    onSavedRemove?.(id);
  };

  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50/50">
      <p className="text-xs font-semibold uppercase text-gray-600 mb-2">Attachments</p>
      <p className="text-xs text-gray-500 mb-2">Max file size: {MAX_MB} MB. PDF, JPEG, PNG, WebP.</p>

      {/* Saved (from API) */}
      {saved.length > 0 && (
        <ul className="space-y-2 mb-3">
          {saved.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-800 hover:underline truncate min-w-0"
              >
                {a.contentType === 'application/pdf' ? (
                  <FileText className="w-4 h-4 shrink-0 text-red-600" />
                ) : (
                  <Image className="w-4 h-4 shrink-0 text-gray-500" />
                )}
                <span className="truncate">{a.fileName}</span>
                <span className="text-gray-400 shrink-0">({formatSize(a.fileSizeBytes)})</span>
              </a>
              {allowAdd && onSavedRemove && (
                <button
                  type="button"
                  onClick={() => removeSaved(a.id)}
                  disabled={disabled}
                  className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 text-gray-600 disabled:opacity-50"
                  aria-label="Remove attachment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Pending (new invoice) */}
      {pending.length > 0 && (
        <ul className="space-y-2 mb-3">
          {pending.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm text-gray-700">
              <span className="flex items-center gap-2 truncate min-w-0">
                <Paperclip className="w-4 h-4 shrink-0" />
                <span className="truncate">{p.file.name}</span>
                <span className="text-gray-400 shrink-0">({formatSize(p.file.size)})</span>
              </span>
              <button
                type="button"
                onClick={() => onPendingRemove(p.id)}
                disabled={disabled}
                className="p-1.5 rounded border border-gray-300 hover:bg-gray-100 text-gray-600 disabled:opacity-50"
                aria-label="Remove"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploadError && <p className="text-red-600 text-sm mb-2">{uploadError}</p>}

      {allowAdd && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="text-sm font-medium text-gray-700 hover:text-black hover:underline"
        >
          Add attachment
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}

/**
 * Upload pending attachments to an invoice (call after creating the invoice).
 */
export async function uploadPendingAttachments(
  invoiceId: string,
  pending: PendingAttachment[]
): Promise<void> {
  for (const p of pending) {
    const form = new FormData();
    form.append('file', p.file);
    const res = await fetch(`/api/crm/invoices/${invoiceId}/attachments`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to upload attachment');
    }
  }
}
