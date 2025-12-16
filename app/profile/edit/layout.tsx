'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

interface EditProfileLayoutProps {
  children: ReactNode;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(word => word.length > 0);
  
  if (words.length === 0) return '';
  
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  } else {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
}

export default function EditProfileLayout({ children }: EditProfileLayoutProps) {
  const { getThemeClasses } = useTheme();
  const { user } = useAuth();
  const headerClass = getThemeClasses('header');
  const containerClass = getThemeClasses('container');
  
  const userInitials = user ? getInitials(`${user.firstName} ${user.lastName}`) : 'U';

  return (
    <div className="min-h-screen w-full bg-white">
      {/* Container with same max-width as other pages */}
      <div className={`w-full max-w-[960px] min-h-screen mx-auto ${containerClass} bg-white`}>
        {/* Header - Same height as other pages */}
        <header className={`w-full h-[60px] ${headerClass} p-2 md:px-2 md:py-4`}>
          <div className="relative w-full h-full flex items-center">
            {/* Left: Back button with logo */}
            <div className="flex items-center flex-shrink-0 z-10">
              <Link
                href="/profile"
                className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 hover:bg-gray-50 transition-colors overflow-hidden cursor-pointer"
                aria-label="Go back to profile"
              >
                <Image
                  src="/hph-logo-simble-sq-white-bg-2.2.png"
                  alt="House Pros Hub"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain"
                />
              </Link>
            </div>

            {/* Center: Edit Profile title */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-0">
              <h1 className="text-xl md:text-2xl font-bold text-black">
                Edit Profile
              </h1>
            </div>

            {/* Right: Profile picture */}
            <div className="flex items-center flex-shrink-0 ml-auto z-[100]">
              <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
                {user?.userPicture ? (
                  <Image
                    src={user.userPicture}
                    alt={`${user.firstName} ${user.lastName}`}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <span className="text-sm font-bold text-white">{userInitials}</span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}

