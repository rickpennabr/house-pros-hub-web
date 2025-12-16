'use client';

import { Button } from '@/components/ui/Button';
import { USER_TYPES, type UserType } from '@/lib/constants/auth';

// Success message component displayed after successful signup

interface SignupSuccessMessageProps {
  userType?: UserType;
  onAddBusiness?: () => void;
}

export function SignupSuccessMessage({ userType, onAddBusiness }: SignupSuccessMessageProps) {
  const isBusinessSignup = userType === USER_TYPES.CONTRACTOR;
  const isCustomerSignup = userType === USER_TYPES.CUSTOMER;

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
            Thanks for signing up for House Pros Hub!
          </h2>
          <p className="text-gray-700">
            {isBusinessSignup
              ? "Welcome to House Pros Hub! Your business account has been created. You can now manage your business profile and connect with customers."
              : "Now you can contact your pro. But if you are an invited contractor, feel free to create a business account."}
          </p>
        </div>
      </div>
      <div className="flex gap-4 w-full pt-4">
        {isCustomerSignup ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.location.href = '/'}
              className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
            >
              Go to Home
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={onAddBusiness}
              className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
            >
              Add Business
            </Button>
          </>
        ) : (
          <>
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
              Go to Home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

