'use client';

import { useRouter } from 'next/navigation';

interface ProfileIconProps {
  className?: string;
}

export default function ProfileIcon({ className = '' }: ProfileIconProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push('/signin')}
      className={`w-10 h-10 rounded-full bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors ${className}`}
      aria-label="Account"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="black"
        className="w-6 h-6"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    </button>
  );
}
