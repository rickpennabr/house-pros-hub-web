'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import { LogOut } from 'lucide-react';
import type { Profile } from '@/lib/types/supabase';

interface AdminAccountButtonProps {
  userEmail: string;
}

export function AdminAccountButton({ userEmail }: AdminAccountButtonProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const profilePictureUrl = profile?.user_picture ?? undefined;
  const [imageErrorState, setImageErrorState] = useState<{ url?: string; hasError: boolean }>(() => ({
    url: profilePictureUrl,
    hasError: false,
  }));
  const [dropdownImageErrorState, setDropdownImageErrorState] = useState<{ url?: string; hasError: boolean }>(() => ({
    url: profilePictureUrl,
    hasError: false,
  }));
  const imageError = imageErrorState.url === profilePictureUrl ? imageErrorState.hasError : false;
  const dropdownImageError =
    dropdownImageErrorState.url === profilePictureUrl ? dropdownImageErrorState.hasError : false;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (profileData) {
            setProfile(profileData);
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };
    fetchProfile();
  }, [supabase]);

  // Get user initials from email or profile
  const userInitials = profile?.first_name && profile?.last_name
    ? (profile.first_name.charAt(0) + profile.last_name.charAt(0)).toUpperCase()
    : userEmail
        .split('@')[0]
        .slice(0, 2)
        .toUpperCase()
        .replace(/[^A-Z]/g, '');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
    }
    setIsDropdownOpen(false);
  };

  return (
    <div className="relative z-[100]">
      <button
        ref={buttonRef}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative"
        aria-label="Admin account"
      >
        {profile?.user_picture && !imageError ? (
          profile.user_picture.startsWith('data:') ? (
            <Image
              src={profile.user_picture}
              alt="Admin profile"
              fill
              className="object-cover"
              sizes="40px"
              unoptimized
              onError={() => setImageErrorState({ url: profilePictureUrl, hasError: true })}
            />
          ) : (
            <Image
              src={profile.user_picture}
              alt="Admin profile"
              fill
              className="object-cover"
              sizes="40px"
              quality={90}
              priority={false}
              onError={() => setImageErrorState({ url: profilePictureUrl, hasError: true })}
            />
          )
        ) : (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <span className="text-xs font-bold text-white leading-none">
              {userInitials}
            </span>
          </div>
        )}
      </button>

      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-64 bg-white rounded-lg border-2 border-black shadow-lg z-[100] overflow-hidden"
        >
          {/* Account Section */}
          <div className="px-4 py-3 flex items-center gap-3 border-b-2 border-black bg-gray-50">
            <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
              {profile?.user_picture && !dropdownImageError ? (
                profile.user_picture.startsWith('data:') ? (
                  <Image
                    src={profile.user_picture}
                    alt="Admin profile"
                    fill
                    className="object-cover"
                    sizes="40px"
                    unoptimized
                    onError={() => setDropdownImageErrorState({ url: profilePictureUrl, hasError: true })}
                  />
                ) : (
                  <Image
                    src={profile.user_picture}
                    alt="Admin profile"
                    fill
                    className="object-cover"
                    sizes="40px"
                    quality={90}
                    priority={false}
                    onError={() => setDropdownImageErrorState({ url: profilePictureUrl, hasError: true })}
                  />
                )
              ) : (
                <span className="text-sm font-bold text-white">
                  {userInitials}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-black truncate">
                {profile?.first_name && profile?.last_name
                  ? `${profile.first_name} ${profile.last_name}`
                  : 'Admin'}
              </span>
              <span className="text-[10px] text-gray-600 truncate">
                {userEmail}
              </span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="border-t-2 border-black"></div>
          <div className="p-2">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-3 font-medium text-red-600 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

