'use client';

import { ReactNode } from 'react';

export interface ConfirmationMessageProps {
  /** Main title (e.g. "Password reset link sent!") */
  title: string;
  /** Body text or custom content */
  message: string | ReactNode;
  /** Optional actions (links/buttons) rendered below the message */
  children?: ReactNode;
}

/**
 * Standard inline confirmation message used after success actions
 * (e.g. sign-up complete, password reset link sent). Matches the sign-up
 * success style: white box, black border, checkmark icon.
 */
export function ConfirmationMessage({ title, message, children }: ConfirmationMessageProps) {
  return (
    <div className="space-y-6 flex-1 flex flex-col min-h-[200px]">
      <div className="flex-1 flex flex-col justify-center">
        <div className="bg-white border-2 border-black rounded-lg p-6 flex flex-col justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-white"
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
          <h2 className="text-2xl font-semibold mb-4 text-black">{title}</h2>
          <div className="text-gray-700">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>
        </div>
      </div>
      {children ? <div className="flex flex-col gap-3 w-full">{children}</div> : null}
    </div>
  );
}
