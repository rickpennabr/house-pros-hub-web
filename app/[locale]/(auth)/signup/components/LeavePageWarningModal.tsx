'use client';

import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface LeavePageWarningModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LeavePageWarningModal({ isOpen, onConfirm, onCancel }: LeavePageWarningModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      showHeader={false}
      showCloseButton={false}
      maxWidth="md"
    >
        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-6 md:p-8 text-center">
          <div className="space-y-6 w-full">
            <div className="mb-6">
              <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-3 text-black">
                Leave Page?
              </h2>
              <p className="text-base md:text-lg text-gray-700 mb-2">
                You have unsaved changes. If you leave now, all the data you entered will be lost.
              </p>
              <p className="text-sm md:text-base text-gray-600">
                Are you sure you want to leave this page?
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-3 mt-8">
              <Button
                variant="secondary"
                onClick={onCancel}
                className="w-full md:w-auto flex-1 px-6 py-2.5"
              >
                Stay on Page
              </Button>
              <Button
                variant="primary"
                onClick={onConfirm}
                className="w-full md:w-auto flex-1 px-6 py-2.5"
              >
                Leave Page
              </Button>
            </div>
          </div>
        </div>
    </Modal>
  );
}

