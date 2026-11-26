'use client';

import { useState } from 'react';
import { ImageIcon, Paperclip } from 'lucide-react';
import { VoiceNotePlayer } from '@/components/chat/VoiceNotePlayer';
import type { ChatAttachment } from '@/lib/types/chat';
import { ImageLightbox } from '@/components/ui/ImageLightbox';

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
  const [gallery, setGallery] = useState<{ images: { url: string; name: string }[]; index: number } | null>(null);
  const openGallery = (button: HTMLElement) => {
    const scope = button.closest('[data-chat-thread]') ?? document;
    const nodes = Array.from(scope.querySelectorAll<HTMLElement>('[data-chat-image-url]'));
    const images = nodes.map((node) => ({ url: node.dataset.chatImageUrl ?? '', name: node.dataset.chatImageName ?? '' }));
    const index = Math.max(0, nodes.indexOf(button));
    setGallery(images.length ? { images, index } : { images: [{ url: att.url, name: att.name }], index: 0 });
  };
  if (isVoice(att)) {
    return <VoiceNotePlayer url={att.url} />;
  }
  // Browsers cannot play AVI inline; it falls through to the download link.
  if (att.contentType.startsWith('video/') && att.contentType !== 'video/vnd.avi') {
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
      <>
        {/* Opens in the Hub's photo viewer, not a new tab. */}
        <button
          type="button"
          data-chat-image-url={att.url}
          data-chat-image-name={att.name}
          onClick={(event) => openGallery(event.currentTarget)}
          className="mt-1 block w-full max-w-[280px] cursor-zoom-in overflow-hidden rounded-xl border border-black/10 text-left"
          aria-label={att.name ? 'Open ' + att.name : 'Open photo'}
        >
          <ChatImage url={att.url} name={att.name} />
        </button>
        {gallery ? <ImageLightbox images={gallery.images} index={gallery.index} onClose={() => setGallery(null)} /> : null}
      </>
    );
  }
  return (
    <a href={att.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-sm underline">
      <Paperclip className="h-4 w-4 shrink-0" />
      {att.name}
    </a>
  );
}
