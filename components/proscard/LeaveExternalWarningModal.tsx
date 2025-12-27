'use client';

import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface LeaveExternalWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  websiteUrl: string;
}

export function LeaveExternalWarningModal({ isOpen, onConfirm, onCancel, websiteUrl }: LeaveExternalWarningModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      showHeader={false}
      showCloseButton={false}
      maxWidth="md"
    >
        <div className="flex-1 flex items-center justify-center p-6 md:p-8 text-center">
          <div className="space-y-6 w-full">
            <div className="mb-6">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-3 text-black">
                Leaving House Pros Hub?
              </h2>
              <p className="text-base md:text-lg text-gray-700 mb-2">
                You are about to visit an external website:
              </p>
              <p className="text-sm md:text-base font-medium text-blue-600 break-all mb-4">
                {websiteUrl}
              </p>
              <p className="text-sm md:text-base text-gray-600">
                Are you sure you want to proceed?
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-3 mt-8">
              <Button
                variant="secondary"
                onClick={onCancel}
                className="w-full md:w-auto flex-1 px-6 py-2.5"
              >
                Go Back
              </Button>
              <Button
                variant="primary"
                onClick={onConfirm}
                className="w-full md:w-auto flex-1 px-6 py-2.5"
              >
                Visit Website
              </Button>
            </div>
          </div>
        </div>
    </Modal>
  );
}
