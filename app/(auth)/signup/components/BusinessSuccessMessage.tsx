'use client';

import { Button } from '@/components/ui/Button';

// Success message component displayed after successful business creation

export function BusinessSuccessMessage() {
  return (
    <div className="space-y-6 flex-1 flex flex-col min-h-[400px]">
      <div className="flex-1 flex flex-col justify-center">
        <div className="bg-white border-2 border-black rounded-lg p-6 h-full flex flex-col justify-center text-center">
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
          <h2 className="text-2xl font-semibold mb-4">
            Business Created Successfully!
          </h2>
          <p className="text-gray-700">
            Your business account has been created. You can now manage your business profile and connect with customers.
          </p>
        </div>
      </div>
      <div className="flex gap-4 w-full pt-4">
        <Button
          type="button"
          variant="primary"
          onClick={() => window.location.href = '/account-management'}
          className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
        >
          Manage Account
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.location.href = '/'}
          className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
        >
          Go Home
        </Button>
      </div>
    </div>
  );
}

