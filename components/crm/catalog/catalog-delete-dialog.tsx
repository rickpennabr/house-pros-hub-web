'use client';

import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { AlertTriangle } from 'lucide-react';

interface CatalogDeleteDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CatalogDeleteDialog({ title, message, confirmLabel, deleting, onCancel, onConfirm }: CatalogDeleteDialogProps) {
  return (
    <Modal isOpen onClose={() => !deleting && onCancel()} showHeader={false} showCloseButton maxWidth="sm" preventCloseOnOverlayClick={deleting}>
      <div className="p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">{title}</h2>
        <p className="mb-6 text-gray-600">{message}</p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={deleting}>Cancel</Button>
          <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={onConfirm} disabled={deleting}>
            {deleting ? 'Deleting…' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
