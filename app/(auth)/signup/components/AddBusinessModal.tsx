'use client';

import { useEffect } from 'react';

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

      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4 bg-black/50">
      <div className="bg-white md:rounded-lg border-2 border-black w-full h-full md:w-full md:h-auto md:max-w-md md:max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="space-y-4">
            <div className="mb-6">
              <svg
                className="w-16 h-16 mx-auto text-green-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 className="text-2xl font-semibold mb-4 text-black">
                Congratulations on your personal account on HouseProsHub
              </h2>
              <p className="text-lg text-gray-700">
                Now let's add your business.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

