'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { MapPin } from 'lucide-react';

interface AddressRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddressRequiredModal({ isOpen, onClose }: AddressRequiredModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-black/50"
      onClick={handleOverlayClick}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-white md:rounded-lg border-2 border-black w-full h-full md:w-auto md:h-auto max-w-md md:max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
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
      </div>
    </div>
  );
}

