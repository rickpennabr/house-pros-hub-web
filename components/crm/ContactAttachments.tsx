'use client';

import { useEffect, useState } from 'react';
import { FileText, Image as ImageIcon, Paperclip, Trash2 } from 'lucide-react';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';

const MAX_MB = 20;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';

interface SavedAttachment {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  url: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Upload files to a contact; returns the first error, or null when all saved. */
export async function uploadContactAttachments(customerId: string, files: File[]): Promise<string | null> {
  for (const file of files) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/crm/customers/${encodeURIComponent(customerId)}/attachments`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return `${file.name}: ${data.error || 'could not upload'}`;
    }
  }
  return null;
}

interface ContactAttachmentsProps {
  /** Saved contact: files upload right away. Empty: files wait in `pending` until the contact is created. */
  customerId: string;
  pending: File[];
  onPendingChange: (files: File[]) => void;
  disabled?: boolean;
}

/** Files the pro keeps on a contact (not shown to the customer). Drag and drop or browse. */
export function ContactAttachments({ customerId, pending, onPendingChange, disabled = false }: ContactAttachmentsProps) {
  const [saved, setSaved] = useState<SavedAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<SavedAttachment | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    fetch(`/api/crm/customers/${encodeURIComponent(customerId)}/attachments`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.attachments)) setSaved(data.attachments);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const add = async (files: File[]) => {
    setError(null);
    if (!customerId) {
      onPendingChange([...pending, ...files]);
      return;
    }
    setBusy(true);
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch(`/api/crm/customers/${encodeURIComponent(customerId)}/attachments`, {
          method: 'POST',
          credentials: 'include',
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(`${file.name}: ${data.error || 'could not upload'}`);
        setSaved((current) => [...current, data.attachment as SavedAttachment]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload');
    } finally {
      setBusy(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      const res = await fetch(
        `/api/crm/customers/${encodeURIComponent(customerId)}/attachments?attachmentId=${encodeURIComponent(removing.id)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not remove the file');
      setSaved((current) => current.filter((row) => row.id !== removing.id));
      setRemoving(null);
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Could not remove the file');
    } finally {
      setRemoveBusy(false);
    }
  };

  const rowClass = 'flex items-center justify-between gap-2 text-sm';
  const removeClass = 'p-1.5 rounded-lg border-2 border-black hover:bg-gray-100 disabled:opacity-50 cursor-pointer';

  return (
    <div className="space-y-2">
      {saved.length > 0 || pending.length > 0 ? (
        <ul className="space-y-2">
          {saved.map((file) => (
            <li key={file.id} className={rowClass}>
              <a href={file.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 hover:underline">
                {file.contentType === 'application/pdf' ? (
                  <FileText className="h-4 w-4 shrink-0 text-red-600" />
                ) : (
                  <ImageIcon className="h-4 w-4 shrink-0 text-gray-500" />
                )}
                <span className="truncate">{file.fileName}</span>
                <span className="shrink-0 text-gray-400">({formatSize(file.fileSizeBytes)})</span>
              </a>
              <button type="button" disabled={disabled} onClick={() => setRemoving(file)} className={removeClass} aria-label={`Remove ${file.fileName}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {pending.map((file, index) => (
            <li key={`${file.name}-${index}`} className={rowClass}>
              <span className="flex min-w-0 items-center gap-2 text-gray-700">
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-gray-400">({formatSize(file.size)} · saved with the contact)</span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPendingChange(pending.filter((_, i) => i !== index))}
                className={removeClass}
                aria-label={`Remove ${file.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <FileDropZone
        onFiles={(files) => void add(files)}
        accept={ACCEPT}
        multiple
        maxSizeMb={MAX_MB}
        disabled={disabled || busy}
        label={busy ? 'Uploading…' : undefined}
        hint={`PDF, JPEG, PNG or WebP · up to ${MAX_MB} MB · only you see these`}
        error={error}
      />
      <DeleteConfirmModal
        isOpen={removing !== null}
        title="Remove attachment"
        message={removing ? `Remove ${removing.fileName} from this contact? This can't be undone.` : ''}
        onCancel={() => {
          setRemoving(null);
          setRemoveError(null);
        }}
        onConfirm={() => void confirmRemove()}
        busy={removeBusy}
        error={removeError}
        confirmLabel="Remove"
      />
    </div>
  );
}
