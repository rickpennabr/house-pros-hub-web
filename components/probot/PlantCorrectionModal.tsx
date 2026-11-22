'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import type { ChatMessage } from '@/lib/types/chat';

export interface PlantCorrectionResult {
  correctedTo: string;
  /** ProBot's correction message, when it was posted in the chat. */
  posted: ChatMessage | null;
}

/**
 * Admin: correct ProBot's plant identification. The correction is saved for the plant identifier
 * (every later photo uses it) and, by default, ProBot posts it in the chat.
 */
export function PlantCorrectionModal({
  msg,
  onClose,
  onSaved,
}: {
  msg: ChatMessage | null;
  onClose: () => void;
  onSaved: (msg: ChatMessage, result: PlantCorrectionResult) => void;
}) {
  const t = useTranslations('probot');
  const [common, setCommon] = useState('');
  const [scientific, setScientific] = useState('');
  const [notes, setNotes] = useState('');
  const [post, setPost] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plant = msg?.payload?.plantId;

  const close = () => {
    setCommon('');
    setScientific('');
    setNotes('');
    setPost(true);
    setError(null);
    onClose();
  };

  async function save() {
    if (!msg || !common.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/plant-corrections', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: msg.id,
          correctCommonName: common,
          correctScientificName: scientific,
          notes,
          postInChat: post,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : t('plantCorrectFailed'));
      onSaved(msg, {
        correctedTo: typeof data.correctedTo === 'string' ? data.correctedTo : common.trim(),
        posted: data.posted && typeof data.posted === 'object' ? (data.posted as ChatMessage) : null,
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('plantCorrectFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={Boolean(msg && plant)} onClose={close} title={t('plantCorrectTitle')} showHeader maxWidth="md" contentClassName="p-4">
      {plant ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="flex items-center gap-3">
            {/* Chat photos live on the public storage host. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={plant.photoUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg border-2 border-black object-cover" />
            <p className="text-sm text-gray-700">
              {t('plantCorrectAiSaid', {
                name: [plant.commonName, plant.scientificName && `(${plant.scientificName})`].filter(Boolean).join(' '),
              })}
            </p>
          </div>
          <label className="block text-sm font-medium">
            {t('plantCorrectName')}
            <input
              autoFocus
              required
              maxLength={120}
              value={common}
              onChange={(event) => setCommon(event.target.value)}
              placeholder="Gray Leaf Cotoneaster"
              className="mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="block text-sm font-medium">
            {t('plantCorrectScientific')}
            <input
              maxLength={120}
              value={scientific}
              onChange={(event) => setScientific(event.target.value)}
              placeholder="Cotoneaster glaucophyllus"
              className="mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-sm font-normal italic"
            />
          </label>
          <label className="block text-sm font-medium">
            {t('plantCorrectNotes')}
            <textarea
              maxLength={600}
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t('plantCorrectNotesPlaceholder')}
              className="mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={post} onChange={(event) => setPost(event.target.checked)} />
            {t('plantCorrectPost')}
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={saving || !common.trim()}
            className="w-full rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? '…' : t('plantCorrectSave')}
          </button>
        </form>
      ) : null}
    </Modal>
  );
}
