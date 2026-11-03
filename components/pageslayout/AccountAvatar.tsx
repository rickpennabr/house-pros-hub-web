'use client';

import { useState } from 'react';
import Image from 'next/image';

export function accountInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

interface AccountAvatarProps {
  src?: string;
  name: string;
  className?: string;
  framed?: boolean;
  textClassName?: string;
}

export function AccountAvatar({
  src,
  name,
  className = 'w-8 h-8',
  framed = true,
  textClassName = 'text-xs',
}: AccountAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  const showImage = Boolean(src) && failedSrc !== src;

  return (
    <div
      className={`${className} ${framed ? 'rounded-lg border-2 border-black' : ''} relative flex items-center justify-center overflow-hidden bg-black shrink-0`}
    >
      {showImage && src ? (
        <Image
          src={src}
          alt={name}
          fill
          className="object-cover"
          sizes="40px"
          unoptimized={src.startsWith('data:') || src.startsWith('blob:')}
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <span className={`${textClassName} font-bold text-white leading-none`}>
          {accountInitials(name)}
        </span>
      )}
    </div>
  );
}
