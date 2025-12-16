'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import CategoryCarousel from '@/components/CategoryCarousel';

interface AuthFormLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AuthFormLayout({ children, title = 'Sign in or Sign Up to find your House Pro.' }: AuthFormLayoutProps) {
  return (
    <div className="w-full h-full md:h-auto">
      <div className="border-2 border-black md:rounded-lg bg-white overflow-hidden h-full md:h-auto flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="hidden md:block bg-white px-2 py-4 md:px-3 md:py-6 border-r-2 border-black">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">{title}</h2>
            <CategoryCarousel direction="right" />
            <CategoryCarousel direction="left" />
          </div>

          <div className="p-6 md:p-8 flex flex-col flex-1 md:flex-none justify-between">
            <div className="flex justify-center mb-6">
              <Logo width={200} height={50} className="h-12 w-auto" />
            </div>
            {children}
            <div className="mt-6 pt-6 border-t border-black">
              <p className="text-xs text-center text-gray-500">
                By signing in or signing up, you agree to our{' '}
                <Link href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
                  Privacy Policy
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

