'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Share2, Phone, Globe, MapPin } from 'lucide-react';

const ShareSupplierModal = dynamic(
  () => import('@/components/suppliers/ShareSupplierModal'),
  { ssr: false, loading: () => null }
);

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
  onHoverChange?: (hovered: boolean) => void;
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

export default function SupplierCard({ supplier, isSelected, onClick, onHoverChange, isListMode = false }: SupplierCardProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [shareSupplierUrl, setShareSupplierUrl] = useState('');
  const { supplierName, branchName } = parseSupplierName(supplier.name);
  const initials = getInitials(supplierName);

  useEffect(() => {
    setShareSupplierUrl(`${window.location.origin}/prosuppliers?supplier=${supplier.id}`);
  }, [supplier.id]);

  const shouldShowImage = supplier.logo && !imageError;

  // List mode: Show only compact header (similar to ProCard list mode)
  if (isListMode) {
    const rightPadding = supplier.phone ? 'pr-16' : 'pr-10';
    
    return (
      <>
        <div 
          className="border-2 border-black rounded-lg md:bg-white overflow-hidden cursor-pointer hover:shadow-lg transition-shadow w-full"
          onClick={onClick}
          onMouseEnter={() => onHoverChange?.(true)}
          onMouseLeave={() => onHoverChange?.(false)}
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
          supplierUrl={shareSupplierUrl}
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
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
      >
        {/* Header Section - Logo, Supplier Name, Branch Name, Share Button */}
        <div className="relative flex items-center border-b border-black px-2 py-[3px]">
          <div className="flex items-center gap-2 flex-1 pr-10 min-w-0">
            <div className={`w-[35px] h-[35px] rounded-md border-2 border-black flex items-center justify-center shrink-0 overflow-hidden relative aspect-square ${shouldShowImage ? 'bg-white' : 'bg-black'}`}>
              {shouldShowImage ? (
                <Image
                  src={supplier.logo!}
                  alt={supplierName}
                  fill
                  className="object-contain p-0.5"
                  sizes="35px"
                  unoptimized
                  onError={() => setImageError(true)}
                />
              ) : (
                <span className="text-xs font-bold text-white">{initials}</span>
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
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg bg-transparent transition-colors hover:bg-gray-50"
            aria-label="Share"
          >
            <Share2 className="w-5 h-5 text-black" />
          </button>
        </div>

        <div className="flex items-center border-b border-black px-2 py-1.5">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex w-max min-w-full flex-nowrap items-center justify-center gap-1.5">
              {supplier.materials.map((material) => (
                <span
                  key={material}
                  className="whitespace-nowrap rounded bg-black px-2 py-1 text-xs font-medium text-white"
                >
                  {material}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1 px-2 py-1">
            {supplier.phone && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `tel:${supplier.phone}`;
                }}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-2 border-black bg-white transition-colors hover:bg-gray-50"
                aria-label="Phone"
              >
                <Phone className="h-4 w-4 text-black" />
              </button>
            )}
            {supplier.website && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(supplier.website, '_blank', 'noopener,noreferrer');
                }}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-2 border-black bg-white transition-colors hover:bg-gray-50"
                aria-label="Website"
              >
                <Globe className="h-4 w-4 text-black" />
              </button>
            )}
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
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-2 border-black bg-white transition-colors hover:bg-gray-50"
                aria-label="Get Directions"
              >
                <MapPin className="h-4 w-4 text-black" />
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
        supplierUrl={shareSupplierUrl}
      />
    </>
  );
}
