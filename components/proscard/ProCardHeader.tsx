'use client';

import Image from 'next/image';
import { Share2 } from 'lucide-react';

interface ProCardHeaderProps {
  logo?: string;
  businessName: string;
  contractorType: string;
  onShare?: () => void;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(word => word.length > 0);
  
  if (words.length === 0) return '';
  
  if (words.length === 1) {
    // Single word: use first letter
    return words[0].charAt(0).toUpperCase();
  } else {
    // Two or more words: use first letter of first two words
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
}

export default function ProCardHeader({ 
  logo, 
  businessName, 
  contractorType,
  onShare 
}: ProCardHeaderProps) {
  const initials = getInitials(businessName);
  
  return (
    <div className="h-[60px] flex items-center justify-between p-2 lg:py-2 lg:px-2 border-b border-black">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center bg-white shrink-0 overflow-hidden">
          {logo ? (
            <Image
              src={logo}
              alt={businessName}
              width={48}
              height={48}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-lg font-bold text-black">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-black truncate">{businessName}</h3>
          <p className="text-sm text-gray-600">{contractorType}</p>
        </div>
      </div>
      <button
        onClick={onShare}
        className="w-10 h-10 rounded-full bg-transparent border-2 border-transparent flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors shrink-0"
        aria-label="Share"
      >
        <Share2 className="w-5 h-5 text-black" />
      </button>
    </div>
  );
}

