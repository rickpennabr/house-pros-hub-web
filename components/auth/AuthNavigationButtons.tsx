'use client';

import { useRouter, usePathname } from 'next/navigation';

interface AuthNavigationButtonsProps {
  isLoading?: boolean;
}

/**
 * Navigation buttons for switching between sign in and sign up pages
 * Highlights the active page
 */
export function AuthNavigationButtons({ isLoading = false }: AuthNavigationButtonsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isSignInPage = pathname === '/signin';

  return (
    <div className="flex gap-0 border-2 border-black rounded-lg overflow-hidden w-full">
      <button
        type="button"
        onClick={() => !isSignInPage && router.push('/signin')}
        disabled={isLoading}
        className={`flex-1 px-4 md:px-5 py-2 md:py-2.5 text-sm md:text-base font-medium transition-all ${
          isSignInPage
            ? 'bg-black text-white cursor-default'
            : 'bg-white text-black hover:bg-gray-50 cursor-pointer active:bg-gray-100'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-current={isSignInPage ? 'page' : undefined}
      >
        Sign In
      </button>
      <button
        type="button"
        onClick={() => isSignInPage && router.push('/signup')}
        disabled={isLoading}
        className={`flex-1 px-4 md:px-5 py-2 md:py-2.5 text-sm md:text-base font-medium transition-all ${
          !isSignInPage
            ? 'bg-black text-white cursor-default'
            : 'bg-white text-black hover:bg-gray-50 cursor-pointer active:bg-gray-100'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-current={!isSignInPage ? 'page' : undefined}
      >
        Sign Up
      </button>
    </div>
  );
}

