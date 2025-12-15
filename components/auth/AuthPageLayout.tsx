'use client';

import { ReactNode } from 'react';
import CategoryCarousel from '@/components/CategoryCarousel';

interface AuthPageLayoutProps {
  children: ReactNode;
  title?: string;
}

/**
 * Shared layout component for authentication pages (signin/signup)
 * Provides consistent two-column layout with carousel on left and form on right
 */
export function AuthPageLayout({ 
  children, 
  title = 'Sign In or Sign up to find your House Pro.' 
}: AuthPageLayoutProps) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-2 md:p-8">
      <div className="w-full md:w-[90%] h-[calc(100vh-1rem)] md:max-h-[90vh] bg-white rounded-lg overflow-hidden border-2 border-black flex flex-col">
        <div className="relative grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0 overflow-hidden">
          {/* Left Side - Carousel */}
          <div className="hidden md:flex flex-col bg-white px-6 py-12 border-r-2 border-black h-full relative z-10">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-6 text-center">
              {title}
            </h1>
            <div className="flex-1 flex flex-col justify-center">
              <CategoryCarousel direction="right" />
              <CategoryCarousel direction="left" />
              <CategoryCarousel direction="right" />
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="flex flex-col bg-white transition-all duration-500 ease-in-out flex-1 min-h-0 overflow-y-auto pt-2 md:pt-6 px-3 md:px-12 pb-3 md:pb-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

