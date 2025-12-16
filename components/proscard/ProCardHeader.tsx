'use client';

import Image from 'next/image';
import { Share2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface ProCardHeaderProps {
  logo?: string;
  businessName: string;
  contractorType: string;
  tradeIcon?: string;
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

function getIconColor(iconName?: string): string {
  const colorMap: Record<string, string> = {
    'Home': 'text-red-600',
    'Grid3x3': 'text-slate-600',
    'Droplet': 'text-blue-500',
    'Zap': 'text-yellow-500',
    'Wind': 'text-cyan-500',
    'Paintbrush': 'text-purple-600',
    'Layers': 'text-amber-800',
    'DoorOpen': 'text-amber-900',
    'TreePine': 'text-green-600',
    'Square': 'text-amber-700',
    'Fence': 'text-gray-600',
    'Layout': 'text-orange-700',
  };
  return colorMap[iconName || ''] || 'text-gray-600';
}

export default function ProCardHeader({ 
  logo, 
  businessName, 
  contractorType,
  tradeIcon,
  onShare 
}: ProCardHeaderProps) {
  const initials = getInitials(businessName);
  
  // Get icon component from lucide-react
  const IconComponent = tradeIcon && (LucideIcons as any)[tradeIcon] 
    ? (LucideIcons as any)[tradeIcon] 
    : null;
  
  return (
    <div className="relative h-[60px] flex items-center p-2 border-b border-black">
      <div className="flex items-center gap-3 md:gap-2 flex-1 pr-10 min-w-0">
        <div className="w-12 h-12 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black relative aspect-square">
          {logo ? (
            <Image
              src={logo}
              alt={businessName}
              fill
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <span className="text-lg font-bold text-white">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-black truncate">{businessName}</h3>
          <div className="flex items-center gap-2 min-w-0">
            {IconComponent && (
              <IconComponent className={`w-4 h-4 shrink-0 ${getIconColor(tradeIcon)}`} />
            )}
            <p className="text-sm text-gray-600 truncate">{contractorType.replace(/\s*Contractor\s*/gi, '')}</p>
          </div>
        </div>
      </div>
      <button
        onClick={onShare}
        className="absolute right-2 w-10 h-10 rounded-lg bg-transparent flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
        aria-label="Share"
      >
        <Share2 className="w-5 h-5 text-black" />
      </button>
    </div>
  );
}

