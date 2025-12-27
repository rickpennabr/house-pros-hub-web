'use client';

import { useEffect } from 'react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

interface AddBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddBusinessModal({ isOpen, onClose }: AddBusinessModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Auto-close after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [isOpen, onClose]);

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      title="Congratulations on your personal account on HouseProsHub"
      message="Now let's add your business."
    />
  );
}

