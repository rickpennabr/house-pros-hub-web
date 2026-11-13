'use client';

import { ImageIcon, Paperclip } from 'lucide-react';
import type { ChatAttachment } from '@/lib/types/chat';

export interface JobProjectOption {
  id: string;
  name: string;
}

interface ChatPendingAttachmentsProps {
  attachments: ChatAttachment[];
  onRemove: (index: number) => void;
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

/** Files waiting to send, with an optional "save this shot to a project" choice. */
export function ChatPendingAttachments({
  attachments,
  onRemove,
  className = 'mb-2 flex flex-wrap gap-2',
  projects = [],
  savedToProject = {},
  savingUrl,
  onSaveToProject,
  saveLabel = 'Also save to a project',
  savedLabel = (name) => `Saved to ${name}`,
}: ChatPendingAttachmentsProps) {
  if (attachments.length === 0) return null;
  return (
    <div className={className}>
      {attachments.map((att, i) => {
        const savedName = savedToProject[att.url];
        const showJob = canSaveToJob(att) && onSaveToProject && projects.length > 0;
        return (
          <span
            key={`${att.url}-${i}`}
            className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-sm text-gray-700"
          >
            {att.contentType.startsWith('image/') ? (
              <ImageIcon className="h-4 w-4 shrink-0" />
            ) : (
              <Paperclip className="h-4 w-4 shrink-0" />
            )}
            <span className="max-w-[120px] truncate">{att.name}</span>
            {showJob && !savedName ? (
              <select
                aria-label={saveLabel}
                disabled={savingUrl === att.url}
                defaultValue=""
                onChange={(event) => {
                  const projectId = event.target.value;
                  if (projectId) onSaveToProject(att, projectId);
                  event.target.value = '';
                }}
                className="max-w-[140px] rounded border border-black bg-white px-1 py-0.5 text-xs text-black"
              >
                <option value="">{savingUrl === att.url ? '…' : saveLabel}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            ) : null}
            {savedName ? <span className="text-xs text-green-700">{savedLabel(savedName)}</span> : null}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="shrink-0 cursor-pointer text-gray-500 hover:text-red-600"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        );
      })}
    </div>
  );
}
