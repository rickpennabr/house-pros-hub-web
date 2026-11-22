'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, FileText, FolderInput, Loader2, Mic, X } from 'lucide-react';
import type { ChatAttachment } from '@/lib/types/chat';

export interface JobProjectOption {
  id: string;
  name: string;
}

interface ChatPendingAttachmentsProps {
  attachments: ChatAttachment[];
  onRemove: (index: number) => void;
  /** Files still uploading: shown as spinner tiles after the finished ones. */
  uploading?: boolean;
  className?: string;
  projects?: JobProjectOption[];
  savedToProject?: Record<string, string>;
  savingUrl?: string | null;
  onSaveToProject?: (attachment: ChatAttachment, projectId: string) => void;
  saveLabel?: string;
  savedLabel?: (name: string) => string;
}

function canSaveToJob(att: ChatAttachment): boolean {
  if (att.name.startsWith('voice-note') || att.contentType.startsWith('audio/')) return false;
  return att.contentType.startsWith('image/') || att.contentType.startsWith('video/');
}

const TILE = 'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-black/15 bg-gray-100';

/** Files waiting to send, shown as thumbnails inside the chat box (like Gemini and Grok). */
export function ChatPendingAttachments({
  attachments,
  onRemove,
  uploading = false,
  className = 'flex flex-wrap gap-2 px-1.5 pb-1.5 pt-1',
  projects = [],
  savedToProject = {},
  savingUrl,
  onSaveToProject,
  saveLabel = 'Also save to a project',
  savedLabel = (name) => `Saved to ${name}`,
}: ChatPendingAttachmentsProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setMenuFor(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuFor]);

  if (attachments.length === 0 && !uploading) return null;
  return (
    <div ref={root} className={className}>
      {attachments.map((att, i) => {
        const savedName = savedToProject[att.url];
        const showJob = canSaveToJob(att) && onSaveToProject && projects.length > 0;
        const isImage = att.contentType.startsWith('image/');
        const isVideo = att.contentType.startsWith('video/');
        const isAudio = att.contentType.startsWith('audio/') || att.name.startsWith('voice-note');
        return (
          <div key={`${att.url}-${i}`} className="relative">
            <div className={TILE} title={att.name}>
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded chat file preview
                <img src={att.url} alt={att.name} className="h-full w-full object-cover" />
              ) : isVideo ? (
                <video src={att.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-white px-1 text-gray-700">
                  {isAudio ? <Mic className="h-5 w-5" /> : <FileText className="h-5 w-5 text-red-600" />}
                  <span className="w-full truncate text-center text-[10px] leading-tight">{att.name}</span>
                </div>
              )}
              {savedName ? (
                <span
                  className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-md bg-green-600 text-white"
                  title={savedLabel(savedName)}
                >
                  <Check className="h-3 w-3" />
                </span>
              ) : showJob ? (
                <button
                  type="button"
                  onClick={() => setMenuFor((open) => (open === att.url ? null : att.url))}
                  disabled={savingUrl === att.url}
                  className="absolute bottom-1 left-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md bg-black/70 text-white hover:bg-black disabled:cursor-wait"
                  aria-label={saveLabel}
                  title={saveLabel}
                >
                  {savingUrl === att.url ? <Loader2 className="h-3 w-3 animate-spin" /> : <FolderInput className="h-3 w-3" />}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border border-black/15 bg-white text-gray-700 shadow-sm hover:bg-red-600 hover:text-white"
              aria-label="Remove"
            >
              <X className="h-3 w-3" />
            </button>
            {menuFor === att.url && showJob ? (
              <div className="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border-2 border-black bg-white text-sm shadow-lg">
                <p className="border-b border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500">{saveLabel}</p>
                <ul className="max-h-48 overflow-y-auto">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuFor(null);
                          onSaveToProject(att, project.id);
                        }}
                        className="w-full cursor-pointer truncate px-3 py-1.5 text-left hover:bg-gray-100"
                      >
                        {project.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
      {uploading ? (
        <div className={`${TILE} flex items-center justify-center`}>
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        </div>
      ) : null}
    </div>
  );
}
