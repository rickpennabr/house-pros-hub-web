'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Plus, SendHorizontal, Trash2, X } from 'lucide-react';
import type { ChatAttachment } from '@/lib/types/chat';
import { UploadProgressRing, type UploadingAttachment } from '@/components/probot/ChatPendingAttachments';
import { ChatImageEditor, type ChatImageEditorHandle } from '@/components/chat/ChatImageEditor';

/**
 * WhatsApp-style send screen for photos and videos, inside the chat window (the parent is
 * `relative`): big preview with edit tools on photos, caption, a strip of thumbnails
 * (tap to see, remove, + to add more) and Send with the count. An edited photo is uploaded
 * again and replaces the original before moving to another one or sending.
 */
interface Item {
  key: string;
  url: string;
  name: string;
  contentType: string;
  /** Index in the finished attachments, or null while uploading. */
  index: number | null;
  percent?: number;
}

export function ChatMediaComposer({
  open,
  attachments,
  uploads,
  caption,
  onCaptionChange,
  onRemove,
  onAddMore,
  onSend,
  onClose,
  sending,
  canAddMore,
  placeholder = 'Add a caption',
  onReplace,
  localFile,
}: {
  /** Upload the edited photo and put it in place of attachment `index`. */
  onReplace?: (index: number, file: File) => Promise<void>;
  /** The picked file for an attachment URL, so the editor needs no download. */
  localFile?: (url: string) => File | undefined;
  open: boolean;
  attachments: ChatAttachment[];
  uploads: UploadingAttachment[];
  caption: string;
  onCaptionChange: (value: string) => void;
  onRemove: (index: number) => void;
  onAddMore: () => void;
  onSend: () => void;
  onClose: () => void;
  sending: boolean;
  canAddMore: boolean;
  placeholder?: string;
}) {
  const items: Item[] = [
    ...attachments.map((att, index) => ({ key: att.url, url: att.url, name: att.name, contentType: att.contentType, index })),
    ...uploads.map((up) => ({ key: up.id, url: up.url, name: up.name, contentType: up.contentType, index: null, percent: up.percent })),
  ];
  const [selected, setSelected] = useState(0);
  const shown = Math.min(selected, items.length - 1);
  const current = items[shown];
  const uploading = uploads.length > 0;
  const editorRef = useRef<ChatImageEditorHandle>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  /** Send waits one render after a replace, so the parent sends the edited photo. */
  const sendQueued = useRef(false);
  const [sendTick, setSendTick] = useState(0);
  useEffect(() => {
    if (!sendQueued.current) return;
    sendQueued.current = false;
    onSend();
  }, [sendTick, onSend]);

  /** Save the current photo's edits (upload and replace). */
  const flushEdits = async (): Promise<'none' | 'replaced' | 'failed'> => {
    if (!current || current.index === null || !editorRef.current || !onReplace) return 'none';
    setEditError(null);
    try {
      const edited = await editorRef.current.exportIfEdited();
      if (!edited) return 'none';
      setSaving(true);
      await onReplace(current.index, edited);
      return 'replaced';
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save the edit');
      return 'failed';
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    if (uploading || sending || saving) return;
    const result = await flushEdits();
    if (result === 'failed') return;
    if (result === 'none') {
      onSend();
      return;
    }
    sendQueued.current = true;
    setSendTick((tick) => tick + 1);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || items.length === 0) return null;

  const preview = (item: Item) =>
    item.contentType.startsWith('image/') ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.url} alt={item.name} className="max-h-full max-w-full object-contain shadow-lg" />
    ) : item.contentType.startsWith('video/') ? (
      <video src={item.url} controls playsInline className="max-h-full max-w-full bg-black shadow-lg" />
    ) : (
      <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-black bg-white p-8">
        <FileText className="h-14 w-14 text-gray-500" />
        <span className="max-w-xs truncate text-sm font-medium">{item.name}</span>
      </div>
    );

  const editable = Boolean(onReplace && current && current.index !== null && current.contentType.startsWith('image/'));

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-white text-black" role="dialog" aria-modal="true" aria-label="Send photos">
      <div className="flex shrink-0 items-center justify-between px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100" aria-label="Close">
          <X className="h-6 w-6" />
        </button>
        <span className="truncate px-2 text-sm text-gray-600">{current?.name}</span>
        {current && current.index !== null ? (
          <button
            type="button"
            onClick={() => {
              onRemove(current.index as number);
              setSelected(Math.max(0, shown - (shown >= items.length - 1 ? 1 : 0)));
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 hover:text-red-600"
            aria-label="Remove this one"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        ) : (
          <span className="h-10 w-10" />
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-2">
        {editable && current ? (
          <ChatImageEditor key={current.key} ref={editorRef} url={current.url} name={current.name} file={localFile?.(current.url)} />
        ) : current ? (
          preview(current)
        ) : null}
        {current && current.index === null ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <UploadProgressRing percent={current.percent ?? 0} size={64} />
          </span>
        ) : null}
        {saving ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Loader2 className="h-8 w-8 animate-spin text-gray-700" />
          </span>
        ) : null}
      </div>
      {editError ? <p className="shrink-0 px-4 pb-1 text-center text-sm text-red-600">{editError}</p> : null}

      <div className="shrink-0 px-4 pb-3">
        <input
          value={caption}
          onChange={(event) => onCaptionChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !uploading && !sending) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={placeholder}
          maxLength={2000}
          className="mx-auto block w-full max-w-xl rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-black focus:bg-white focus:outline-none"
        />
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-gray-200 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex min-w-0 flex-1 justify-center">
          <div className="flex gap-2 overflow-x-auto p-1">
            {items.map((item, i) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (i === shown || saving) return;
                  void flushEdits().then((result) => {
                    if (result !== 'failed') setSelected(i);
                  });
                }}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${i === shown ? 'border-green-600' : 'border-gray-200'}`}
                aria-label={`See ${item.name}`}
              >
                {item.contentType.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                ) : item.contentType.startsWith('video/') ? (
                  <video src={item.url} muted playsInline className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gray-100">
                    <FileText className="h-6 w-6 text-gray-500" />
                  </span>
                )}
                {item.index === null ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <UploadProgressRing percent={item.percent ?? 0} size={30} />
                  </span>
                ) : null}
              </button>
            ))}
            {canAddMore ? (
              <button
                type="button"
                onClick={onAddMore}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border-2 border-gray-300 hover:border-black"
                aria-label="Add more"
              >
                <Plus className="h-6 w-6" />
              </button>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void send()}
          disabled={uploading || sending || saving}
          className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-black text-white hover:bg-gray-800 disabled:opacity-50"
          aria-label={`Send ${items.length}`}
        >
          <SendHorizontal className="h-6 w-6" />
          <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-xs font-bold">
            {items.length}
          </span>
        </button>
      </div>
    </div>
  );
}
