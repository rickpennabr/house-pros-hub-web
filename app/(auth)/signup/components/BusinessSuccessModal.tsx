'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface BusinessSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BusinessSuccessModal({ isOpen, onClose }: BusinessSuccessModalProps) {
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-black/50">
      <div className="bg-white md:rounded-lg border-2 border-black w-full h-full md:w-full md:h-auto max-w-md md:max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="space-y-6 w-full">
            <div className="mb-6">
              <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div className="bg-white border-2 border-black rounded-lg p-6">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 text-black">
                  Congratulations!
                </h2>
                <p className="text-lg md:text-xl text-gray-700 mb-2">
                  Your business has been successfully added to HouseProsHub.
                </p>
                <p className="text-base md:text-lg text-gray-600">
                  We wish you the best of luck with your business!
                </p>
                <p className="text-base md:text-lg text-gray-600 mt-4">
                  You will be redirected to manage accounts where you can manage your accounts personal and business.
                </p>
              </div>
            </div>
            <div className="mt-8">
              <Button
                variant="primary"
                onClick={onClose}
                className="w-full md:w-auto px-8 py-3"
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

