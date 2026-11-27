'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, FileText, FolderInput, Loader2, Mic, X } from 'lucide-react';
import type { ChatAttachment } from '@/lib/types/chat';

/** A file still uploading: shown from the device right away, with its progress. */
export interface UploadingAttachment {
  id: string;
  /** Local preview (object URL). */
  url: string;
  name: string;
  contentType: string;
  percent: number;
}

/** WhatsApp-style ring that closes as the file uploads, with the percentage inside. */
export function UploadProgressRing({ percent, size = 40 }: { percent: number; size?: number }) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <span className="relative flex items-center justify-center" style={{ width: size, height: size }} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.35)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#fff"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-200 ease-out"
        />
      </svg>
      <span className="absolute text-[10px] font-bold leading-none text-white">{value}%</span>
    </span>
  );
}

export interface JobProjectOption {
  id: string;
  name: string;
}

interface ChatPendingAttachmentsProps {
  attachments: ChatAttachment[];
  onRemove: (index: number) => void;
  /** Files still uploading: shown as spinner tiles after the finished ones. */
  uploading?: boolean;
  /** Files uploading now, shown from the device with a progress ring (replaces the spinner tile). */
  uploads?: UploadingAttachment[];
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
  uploads = [],
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

  if (attachments.length === 0 && !uploading && uploads.length === 0) return null;
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
      {uploads.map((file) => (
        <div key={file.id} className={TILE} title={file.name}>
          {file.contentType.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview while it uploads
            <img src={file.url} alt={file.name} className="h-full w-full object-cover opacity-70" />
          ) : file.contentType.startsWith('video/') ? (
            <video src={file.url} muted playsInline preload="metadata" className="h-full w-full object-cover opacity-70" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white px-1">
              <FileText className="h-5 w-5 text-red-600" />
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <UploadProgressRing percent={file.percent} />
          </span>
        </div>
      ))}
      {uploading && uploads.length === 0 ? (
        <div className={`${TILE} flex items-center justify-center`}>
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        </div>
      ) : null}
    </div>
  );
}
