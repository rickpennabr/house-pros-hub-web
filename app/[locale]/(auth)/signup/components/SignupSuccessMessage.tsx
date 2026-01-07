'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { USER_TYPES, type UserType } from '@/lib/constants/auth';
import { createLocalePath } from '@/lib/redirect';
import { useAuth } from '@/contexts/AuthContext';

// Success message component displayed after successful signup

interface SignupSuccessMessageProps {
  userType?: UserType;
  onAddBusiness?: () => void | Promise<void>;
}

export function SignupSuccessMessage({ userType, onAddBusiness }: SignupSuccessMessageProps) {
  const router = useRouter();
  const locale = useLocale();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);
  const isBusinessSignup = userType === USER_TYPES.CONTRACTOR;
  const isCustomerSignup = userType === USER_TYPES.CUSTOMER;

  const ensureAuthAndNavigate = async (path: string) => {
    if (isNavigating) return;
    
    setIsNavigating(true);
    
    try {
      // Ensure user data is refreshed from database before navigating
      // This is especially important after OAuth signup to ensure session is loaded
      // checkAuth now has a fallback to API endpoint, so it should be more reliable
      const maxRetries = 3;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Call checkAuth - it will try client-side first, then fall back to API
          // Use a reasonable timeout (API calls should be faster than client-side getSession)
          const checkAuthPromise = checkAuth();
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Auth check timeout')), 5000)
          );
          
          await Promise.race([checkAuthPromise, timeoutPromise]);
          
          // Wait a bit for state to update after checkAuth
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // If we got here without error, session should be loaded
          break;
        } catch (authError) {
          const errorMessage = authError instanceof Error ? authError.message : 'Unknown auth error';
          console.warn(`Auth check attempt ${attempt + 1}/${maxRetries} failed:`, errorMessage);
          
          if (attempt < maxRetries - 1) {
            // Wait before retrying
            const delay = 800 * (attempt + 1); // 800ms, 1600ms
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // Final check - call checkAuth one more time to ensure session is loaded
      try {
        await checkAuth();
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (finalError) {
        console.warn('Final auth check failed, but continuing with navigation:', finalError);
      }
      
      // Navigate to the path
      // Even if auth check had issues, navigate anyway - the destination page will handle auth
      const targetPath = createLocalePath(locale as 'en' | 'es', path);
      router.push(targetPath);
      
      // Reset navigating state after a short delay to allow navigation to start
      setTimeout(() => {
        setIsNavigating(false);
      }, 500);
    } catch (error) {
      console.error('Error navigating:', error);
      // Still navigate - the destination page will handle auth check
      const targetPath = createLocalePath(locale as 'en' | 'es', path);
      router.push(targetPath);
      setIsNavigating(false);
    }
  };

  const handleGoToHome = () => {
    void ensureAuthAndNavigate('/');
  };

  const handleGetEstimate = () => {
    void ensureAuthAndNavigate('/estimate');
  };

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
              : "Now you can contact your pro."}
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 w-full">
        {isCustomerSignup ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGoToHome}
              disabled={isNavigating}
              className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
            >
              {isNavigating ? 'Loading...' : 'Go to Home'}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleGetEstimate}
              disabled={isNavigating}
              className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
            >
              {isNavigating ? 'Loading...' : 'Get Free Estimate'}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="primary"
              onClick={() => router.push(createLocalePath(locale as 'en' | 'es', '/account-management'))}
              className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
            >
              Manage Account
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGoToHome}
              disabled={isNavigating}
              className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
            >
              {isNavigating ? 'Loading...' : 'Go to Home'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

