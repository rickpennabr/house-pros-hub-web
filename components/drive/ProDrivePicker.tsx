'use client';

import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { ProDriveBrowser } from '@/components/drive/ProDriveBrowser';
import type { DriveFile, DriveOwnerType } from '@/lib/drive/types';

interface ProDrivePickerProps {
  isOpen: boolean;
  onClose: () => void;
  ownerType: DriveOwnerType;
  ownerId: string;
  onSelect: (file: DriveFile) => void;
}

export function ProDrivePicker({ isOpen, onClose, ownerType, ownerId, onSelect }: ProDrivePickerProps) {
  const t = useTranslations('prodrive');
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('pickTitle')} showHeader showCloseButton maxWidth="6xl">
      {isOpen && (
        <ProDriveBrowser
          ownerType={ownerType}
          ownerId={ownerId}
          selectionMode
          onSelectFile={(file) => {
            onSelect(file);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
