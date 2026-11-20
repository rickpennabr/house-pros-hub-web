'use client';

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  /** While true the buttons are disabled and the confirm label reads busyLabel. */
  busy?: boolean;
  error?: string | null;
  confirmLabel?: string;
  busyLabel?: string;
  cancelLabel?: string;
}

/** Ask before deleting something. Use it instead of the browser's confirm(). */
export function DeleteConfirmModal({
  isOpen,
  title,
  message,
  onCancel,
  onConfirm,
  busy = false,
  error = null,
  confirmLabel = 'Delete',
  busyLabel = 'Deleting…',
  cancelLabel = 'Cancel',
}: DeleteConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onCancel()}
      showHeader={false}
      showCloseButton
      maxWidth="sm"
      preventCloseOnOverlayClick={busy}
    >
      <div className="p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
        <div className="text-sm text-gray-600 mb-6">{message}</div>
        {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
