'use client';

import { Button } from '@/components/ui/Button';

// Success message component displayed after successful signup

interface SignupSuccessMessageProps {
  onAddBusiness: () => void;
}

export function SignupSuccessMessage({ onAddBusiness }: SignupSuccessMessageProps) {
  return (
    <div className="space-y-6 flex-1 flex flex-col items-center justify-center text-center py-8">
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
        <h2 className="text-2xl font-semibold mb-4">Thanks for signing up for House Pros Hub!</h2>
        <p className="text-gray-700 mb-2">
          Now you can contact your pro.
        </p>
        <p className="text-gray-700">
          But if you are an invited contractor, feel free to create a business account.
        </p>
      </div>
      <div className="flex gap-4 w-full max-w-md">
        <Button
          type="button"
          variant="primary"
          onClick={onAddBusiness}
          className="flex-1"
        >
          Add Business
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.location.href = '/'}
          className="flex-1"
        >
          Go to Home
        </Button>
      </div>
    </div>
  );
}

