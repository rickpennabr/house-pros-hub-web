'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import Logo from '@/components/Logo';
import { AuthNavigationButtons } from '@/components/auth/AuthNavigationButtons';

interface SignupHeaderProps {
  isLoading: boolean;
}

export function SignupHeader({ isLoading }: SignupHeaderProps) {
  const locale = useLocale();
  return (
    <div className="flex flex-col md:gap-2 md:py-0 md:pt-4">
      {/* Logo Section */}
      <div className="flex items-center justify-center md:mt-0 md:mb-0 pb-2 md:pb-0 animate-slide-down w-full">
        <Link href={`/${locale}/businesslist`} className="cursor-pointer flex-shrink-0 w-full md:w-auto">
          <Logo width={400} height={100} className="w-full md:w-auto max-w-full object-contain h-auto" />
        </Link>
      </div>

      {/* Sign In / Sign Up Tabs Section */}
      <div className="animate-slide-in-right mb-2 md:pb-0">
        <AuthNavigationButtons isLoading={isLoading} />
      </div>
    </div>
  );
}

