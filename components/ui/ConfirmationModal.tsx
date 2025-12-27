'use client';

import { ReactNode } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string | ReactNode;
  primaryButton?: {
    label: string;
    onClick: () => void;
  };
  secondaryButton?: {
    label: string;
    onClick: () => void;
  };
  preventCloseOnOverlayClick?: boolean;
}

/**
 * Standard confirmation modal component with green checkmark icon.
 * Used for success confirmations like sign-up completions.
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  title,
  message,
  primaryButton,
  secondaryButton,
  preventCloseOnOverlayClick = true,
}: ConfirmationModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showHeader={false}
      showCloseButton={false}
      maxWidth="md"
      preventCloseOnOverlayClick={preventCloseOnOverlayClick}
    >
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="space-y-6 w-full">
          {/* Black circle with white checkmark icon */}
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mx-auto mb-4">
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
          </div>

          {/* Content */}
          <div className="bg-white border-2 border-black rounded-lg p-6">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-black">
              {title}
            </h2>
            <div className="text-lg md:text-xl text-gray-700">
              {typeof message === 'string' ? (
                <p>{message}</p>
              ) : (
                message
              )}
            </div>
          </div>

          {/* Action buttons */}
          {(primaryButton || secondaryButton) && (
            <div className="mt-8 flex flex-col gap-3">
              {primaryButton && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={primaryButton.onClick}
                  className="w-full px-8 py-3"
                >
                  {primaryButton.label}
                </Button>
              )}
              {secondaryButton && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={secondaryButton.onClick}
                  className="w-full px-8 py-3"
                >
                  {secondaryButton.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

