'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ShareBusinessModal from './ShareBusinessModal';
import ProfileIcon from '@/components/pageslayout/ProfileIcon';

interface BusinessDetailsHeaderProps {
  logo?: string;
  businessName: string;
  contractorType?: string;
  secondaryLogo?: string;
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

export default function BusinessDetailsHeader({ 
  logo, 
  businessName,
  contractorType = '',
  secondaryLogo 
}: BusinessDetailsHeaderProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const businessInitials = getInitials(businessName);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareBusinessUrl, setShareBusinessUrl] = useState('');

  useEffect(() => {
    setShareBusinessUrl(window.location.href);
  }, []);

  const handleShare = () => {
    setIsShareModalOpen(true);
  };

  return (
    <div className="relative flex items-center h-[60px] p-2 md:px-2 md:py-4 border-b-2 border-black bg-white">
      <div className="flex items-center shrink-0">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 hover:bg-gray-50 transition-colors overflow-hidden cursor-pointer"
          aria-label="Go back"
        >
          <Image
            src="/house-pros-hub-logo-simble-bot.png"
            alt="House Pros Hub"
            width={40}
            height={40}
            className="w-full h-full object-contain"
          />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center gap-1 md:gap-1 pr-14 md:pr-16 min-w-0">
        <div className="flex-1 min-w-0 flex flex-col items-center">
          <h1 className="text-[19px] md:text-[18px] font-bold text-black truncate w-full text-center">{businessName}</h1>
          {contractorType && (
            <p className="text-sm text-gray-600 truncate w-full text-center">{contractorType}</p>
          )}
        </div>
      </div>
      <div className="absolute right-2 flex items-center gap-2">
        <button
          onClick={handleShare}
          className="w-10 h-10 rounded-lg bg-transparent flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
          aria-label="Share"
        >
          <Share2 className="w-5 h-5 text-black" />
        </button>
        {isAuthenticated ? (
          <ProfileIcon />
        ) : logo ? (
          <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 overflow-hidden relative aspect-square">
            <Image
              src={logo}
              alt={businessName}
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
        ) : secondaryLogo ? (
          <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 overflow-hidden relative aspect-square">
            <Image
              src={secondaryLogo}
              alt={businessName}
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-black shrink-0 overflow-hidden relative aspect-square">
            <span className="text-sm font-bold text-white">{businessInitials}</span>
          </div>
        )}
      </div>
      
      <ShareBusinessModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        businessName={businessName}
        contractorType={contractorType}
        logo={logo}
        businessUrl={shareBusinessUrl}
      />
    </div>
  );
}

