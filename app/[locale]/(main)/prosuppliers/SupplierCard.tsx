'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Share2, Phone, Globe, MapPin } from 'lucide-react';
import ShareSupplierModal from '@/components/suppliers/ShareSupplierModal';

export interface Supplier {
  id: number;
  name: string;
  type: string;
  materials: string[];
  address: string;
  phone: string;
  website: string;
  logo?: string;
  coordinates?: { lat: number; lng: number };
}

interface SupplierCardProps {
  supplier: Supplier;
  isSelected: boolean;
  onClick: () => void;
  isListMode?: boolean;
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

// Parse supplier name to extract supplier name and branch
function parseSupplierName(fullName: string): { supplierName: string; branchName?: string } {
  const parts = fullName.split(' - ');
  if (parts.length > 1) {
    return {
      supplierName: parts[0],
      branchName: parts.slice(1).join(' - '),
    };
  }
  return { supplierName: fullName };
}

export default function SupplierCard({ supplier, isSelected, onClick, isListMode = false }: SupplierCardProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { supplierName, branchName } = parseSupplierName(supplier.name);
  const initials = getInitials(supplierName);
  
  const supplierUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/prosuppliers?supplier=${supplier.id}`
    : '';

  const shouldShowImage = supplier.logo && !imageError;

  // List mode: Show only compact header (similar to ProCard list mode)
  if (isListMode) {
    const rightPadding = supplier.phone ? 'pr-16' : 'pr-10';
    
    return (
      <>
        <div 
          className="border-2 border-black rounded-lg md:bg-white overflow-hidden cursor-pointer hover:shadow-lg transition-shadow w-full"
          onClick={onClick}
        >
          <div className={`relative h-[60px] flex items-center p-2`}>
            <div className={`flex items-center gap-3 md:gap-2 flex-1 ${rightPadding} min-w-0`}>
              {/* Avatar Box */}
              <div className={`w-12 h-12 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden relative aspect-square ${shouldShowImage ? 'bg-white' : 'bg-black'}`}>
                {shouldShowImage ? (
                  <Image
                    src={supplier.logo!}
                    alt={supplierName}
                    fill
                    className="object-cover"
                    sizes="48px"
                    unoptimized
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <span className="text-lg font-bold text-white">{initials}</span>
                )}
              </div>

              {/* Text Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xl md:text-base font-bold text-black truncate leading-tight">{supplierName}</h3>
                {branchName && (
                  <p className="text-base md:text-xs font-medium text-gray-600 truncate mt-0.5">{branchName}</p>
                )}
              </div>
            </div>

            {/* Share button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsShareModalOpen(true);
              }}
              className={`absolute ${supplier.phone ? 'right-10' : 'right-1'} w-10 h-10 rounded-lg bg-transparent flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0`}
              aria-label="Share"
            >
              <Share2 className="w-5 h-5 text-black" />
            </button>

            {/* Phone button */}
            {supplier.phone && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `tel:${supplier.phone}`;
                }}
                className="absolute right-1 w-10 h-10 rounded-lg bg-transparent flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
                aria-label="Phone"
              >
                <Phone className="h-10 w-5 text-black" />
              </button>
            )}
          </div>
        </div>

        <ShareSupplierModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          supplierName={supplierName}
          branchName={branchName}
          supplierType={supplier.type}
          logo={supplier.logo}
          supplierUrl={supplierUrl}
        />
      </>
    );
  }

  // Full card mode (existing implementation)
  return (
    <>
      <div
        className={`border-2 ${
          isSelected ? 'border-black md:bg-gray-50' : 'border-black md:bg-white'
        } rounded-lg hover:shadow-lg transition-shadow cursor-pointer w-full`}
        onClick={onClick}
      >
        {/* Header Section - Logo, Supplier Name, Branch Name, Share Button */}
        <div className="relative h-[60px] flex items-center p-2 border-b border-black">
          <div className="flex items-center gap-3 md:gap-2 flex-1 pr-10 min-w-0">
            {/* Avatar Box - Shows only Logo or Initials */}
            <div className={`w-12 h-12 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden relative aspect-square ${shouldShowImage ? 'bg-white' : 'bg-black'}`}>
              {shouldShowImage ? (
                <Image
                  src={supplier.logo!}
                  alt={supplierName}
                  fill
                  className="object-cover"
                  sizes="48px"
                  unoptimized
                  onError={() => setImageError(true)}
                />
              ) : (
                <span className="text-lg font-bold text-white">{initials}</span>
              )}
            </div>

            {/* Text Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-black truncate leading-tight">{supplierName}</h3>
              {branchName && (
                <p className="text-xs font-medium text-gray-600 truncate mt-0.5">{branchName}</p>
              )}
            </div>
          </div>

          {/* Share button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsShareModalOpen(true);
            }}
            className="absolute right-2 w-10 h-10 rounded-lg bg-transparent flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
            aria-label="Share"
          >
            <Share2 className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Icons Section - Phone, Website, Location */}
        <div className="h-[60px] flex items-center p-2 border-b border-black">
          <div className="flex items-center gap-4 w-full">
            {/* Phone Icon */}
            {supplier.phone && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `tel:${supplier.phone}`;
                }}
                className="w-10 h-10 lg:w-9 lg:h-9 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
                aria-label="Phone"
              >
                <Phone className="w-5 h-5 lg:w-[18px] lg:h-[18px] text-black" />
              </button>
            )}

            {/* Website Icon */}
            {supplier.website && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(supplier.website, '_blank', 'noopener,noreferrer');
                }}
                className="w-10 h-10 lg:w-9 lg:h-9 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
                aria-label="Website"
              >
                <Globe className="w-5 h-5 lg:w-[18px] lg:h-[18px] text-black" />
              </button>
            )}

            {/* Location/Directions Icon */}
            {supplier.address && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supplier.address)}`,
                    '_blank',
                    'noopener,noreferrer'
                  );
                }}
                className="w-10 h-10 lg:w-9 lg:h-9 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
                aria-label="Get Directions"
              >
                <MapPin className="w-5 h-5 lg:w-[18px] lg:h-[18px] text-black" />
              </button>
            )}
          </div>
        </div>

        {/* Materials Section - Display materials instead of reactions */}
        <div className="h-[60px] p-2 flex items-center justify-center overflow-hidden">
          <div className="flex items-center flex-wrap gap-2 justify-center w-full">
            {supplier.materials.map((material) => (
              <span
                key={material}
                className="px-2 py-1 bg-black text-white text-xs rounded font-medium"
              >
                {material}
              </span>
            ))}
          </div>
        </div>
      </div>

      <ShareSupplierModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        supplierName={supplierName}
        branchName={branchName}
        supplierType={supplier.type}
        logo={supplier.logo}
        supplierUrl={supplierUrl}
      />
    </>
  );
}

