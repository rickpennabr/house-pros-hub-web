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
    <div className="md:sticky md:top-0 md:z-20 md:bg-white">
      <div className="flex flex-col gap-2 md:gap-4 md:pt-8 md:pb-0 md:mb-2">
        {/* Logo Section */}
        <section className="flex items-center justify-center pt-1 md:pt-0 pb-4 md:pb-0 md:w-full animate-slide-down w-full">
          <Link href={`/${locale}/businesslist`} className="cursor-pointer flex-shrink-0 w-full md:w-full">
            <Logo width={400} height={100} className="w-full md:w-full max-w-full object-contain h-auto md:pb-0" />
          </Link>
        </section>

        {/* Sign In / Sign Up Tabs Section */}
        <section className="animate-slide-in-right mb-2 md:mb-0">
          <AuthNavigationButtons isLoading={isLoading} />
        </section>
      </div>
    </div>
  );
}

