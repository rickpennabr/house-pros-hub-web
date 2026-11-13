'use client';

import { useState } from 'react';
import { ImageIcon, Paperclip } from 'lucide-react';
import type { ChatAttachment } from '@/lib/types/chat';

function isVoice(att: ChatAttachment): boolean {
  return att.name.startsWith('voice-note') || att.contentType.startsWith('audio/');
}

function ChatImage({ url, name }: { url: string; name: string }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <span className="flex items-center gap-2 py-2 text-sm">
        <ImageIcon className="w-5 h-5 shrink-0" />
        <span className="truncate">{name || 'Photo'}</span>
      </span>
    );
  }
  return (
    <img
      src={url}
      alt={name || 'Image'}
      className="block h-auto max-h-[320px] w-full object-cover"
      onError={() => setError(true)}
    />
  );
}

/** Photo, video, voice note, or file inside a chat bubble. */
export function ChatMediaAttachment({ att }: { att: ChatAttachment }) {
  if (isVoice(att)) {
    return <audio src={att.url} controls preload="none" className="mt-1 w-full max-w-[260px]" />;
  }
  if (att.contentType.startsWith('video/')) {
    return (
      <video
        src={att.url}
        controls
        playsInline
        preload="metadata"
        className="mt-1 max-h-[320px] w-full max-w-[280px] rounded-lg bg-black"
      />
    );
  }
  if (att.contentType.startsWith('image/')) {
    return (
      <a
        href={att.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block max-w-[280px] overflow-hidden rounded-xl border border-black/10"
      >
        <ChatImage url={att.url} name={att.name} />
      </a>
    );
  }
  return (
    <a href={att.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-sm underline">
      <Paperclip className="h-4 w-4 shrink-0" />
      {att.name}
    </a>
  );
}
