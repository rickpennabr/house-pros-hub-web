'use client';

import Link from 'next/link';
import Logo from '@/components/Logo';
import { AuthNavigationButtons } from '@/components/auth/AuthNavigationButtons';

interface SignupHeaderProps {
  isLoading: boolean;
}

export function SignupHeader({ isLoading }: SignupHeaderProps) {
  return (
    <div className="flex flex-col mb-2 gap-4">
      <div className="flex items-center justify-center">
        <Link href="/" className="cursor-pointer flex-shrink-0">
          <Logo width={300} height={75} className="h-16 md:h-20 w-auto" />
        </Link>
      </div>
      <AuthNavigationButtons isLoading={isLoading} />
    </div>
  );
}

