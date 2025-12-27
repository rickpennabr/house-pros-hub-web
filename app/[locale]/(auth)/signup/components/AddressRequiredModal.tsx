'use client';

import { Button } from '@/components/ui/Button';
import { MapPin } from 'lucide-react';
import Modal from '@/components/ui/Modal';

interface AddressRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddressRequiredModal({ isOpen, onClose }: AddressRequiredModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showHeader={false}
      showCloseButton={false}
      maxWidth="md"
    >
        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-8 text-center">
          <div className="space-y-6 w-full">
            <div className="mb-6">
              <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-yellow-600" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-3 text-black">
                Address Required
              </h2>
              <p className="text-base md:text-lg text-gray-700 mb-2">
                To add a location link, please complete your business address in Step 2 first.
              </p>
            </div>
            <div className="flex justify-center mt-8">
              <Button
                variant="primary"
                onClick={onClose}
                className="w-full md:w-auto px-6 py-2.5"
              >
                Go Back
              </Button>
            </div>
          </div>
        </div>
    </Modal>
  );
}

