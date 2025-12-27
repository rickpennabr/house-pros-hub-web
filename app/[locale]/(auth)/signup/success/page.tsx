'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { SignupHeader } from '../components/SignupHeader';
import { SignupSuccessMessage } from '../components/SignupSuccessMessage';
import { USER_TYPES } from '@/lib/constants/auth';
import { useAuth } from '@/contexts/AuthContext';

function SignupSuccessPage() {
  const searchParams = useSearchParams();
  const { checkAuth, isAuthenticated, isLoading } = useAuth();
  const role = searchParams.get('role') as 'customer' | 'contractor' | 'both' | null;
  
  // Determine user type for form display
  const userType = role === 'both' ? USER_TYPES.CONTRACTOR : (role === 'customer' ? USER_TYPES.CUSTOMER : USER_TYPES.CONTRACTOR);

  // Ensure user session is loaded after OAuth redirect
  useEffect(() => {
    let retryTimer: NodeJS.Timeout | null = null;
    
    // Check auth immediately
    checkAuth().catch(() => {
      // Silent fail on first attempt
    });
    
    // Retry after a delay to ensure session cookies have propagated
    // This handles cases where OAuth callback just set the session
    retryTimer = setTimeout(() => {
      checkAuth().catch(() => {
        // Silent fail - user can still see success message
      });
    }, 500);
    
    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [checkAuth]); // Only run once on mount

  return (
    <AuthPageLayout>
      <div className="w-full max-w-md mx-auto flex flex-col text-black pt-3 md:pt-0">
        <SignupHeader isLoading={false} />
        <SignupSuccessMessage userType={userType} />
      </div>
    </AuthPageLayout>
  );
}

export default function SignupSuccess() {
  return (
    <Suspense fallback={
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-gray-600">Loading...</p>
        </div>
      </AuthPageLayout>
    }>
      <SignupSuccessPage />
    </Suspense>
  );
}

