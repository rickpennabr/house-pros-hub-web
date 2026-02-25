'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Share2, Phone } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LicenseInfo {
  license: string;
  licenseNumber: string;
  tradeName?: string;
  tradeIcon?: string;
}

interface ProCardHeaderProps {
  logo?: string;
  businessName: string;
  contractorType: string;
  tradeIcon?: string; // Deprecated - use licenses array
  category?: string;
  licenses?: LicenseInfo[];
  phone?: string;
  isListMode?: boolean;
  onShare?: () => void;
  onPhoneClick?: (e: React.MouseEvent) => void;
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
    'Home': 'text-red-500',
    'Grid3x3': 'text-slate-400',
    'Droplet': 'text-blue-400',
    'Zap': 'text-yellow-400',
    'Wind': 'text-cyan-400',
    'Paintbrush': 'text-purple-400',
    'Layers': 'text-amber-500',
    'DoorOpen': 'text-amber-600',
    'TreePine': 'text-green-500',
    'Square': 'text-amber-500',
    'Fence': 'text-gray-400',
    'Layout': 'text-orange-500',
  };
  return colorMap[iconName || ''] || 'text-gray-400';
}

// Convert trade name to translation key
// Returns the translation key if it exists, or null if not found
function getTradeTranslationKey(tradeName: string): string | null {
  if (!tradeName) return null;
  
  // Normalize the trade name to a translation key
  // First handle special characters like &, then normalize
  const normalized = tradeName
    .toLowerCase()
    .replace(/&/g, ' and ') // Replace & with ' and ' (with spaces)
    .replace(/[^a-z0-9\s]/g, '') // Remove remaining special characters
    .trim()
    .replace(/\s+/g, ' '); // Normalize multiple spaces to single space
  
  // Map specific trade names to their translation keys
  const tradeKeyMap: Record<string, string> = {
    'masonry': 'masonry',
    'finishing floors': 'finishingFloors',
    'glass and glazing': 'glassAndGlazing',
    'residential and small commercial': 'residentialAndSmallCommercial',
    'carpentry': 'carpentry',
    'carpentry, maintenance and minor repairs': 'carpentryMaintenanceAndMinorRepairs',
    'tiling': 'tiling',
    'residential remodeling': 'residentialRemodeling',
    'painting and decorating': 'paintingAndDecorating',
    'plumbing and heating contracting': 'plumbingAndHeatingContracting',
    'electrical contracting': 'electricalContracting',
    'concrete contracting': 'concreteContracting',
    'glass and glazing contracting': 'glassAndGlazingContracting',
    'landscape contracting': 'landscapeContracting',
    'roofing and siding': 'roofingAndSiding',
    'lathing and plastering': 'lathingAndPlastering',
    'installing terrazzo and marble': 'installingTerrazzoAndMarble',
    'refrigeration and air-conditioning': 'refrigerationAndAirConditioning',
    'fencing and equipping playgrounds': 'fencingAndEquippingPlaygrounds',
    'excavating and grading': 'excavatingAndGrading',
    'commercial and residential pools': 'commercialAndResidentialPools',
    'windows': 'windows',
    'window and door': 'windows', // Map "Window & Door" to windows
    'window door': 'windows', // Alternative normalization (if & is removed)
    'doors': 'doors',
    'door': 'doors', // Map singular "door" to doors
    'fencing': 'fencing',
    'ornamental iron': 'ornamental iron',
    'decking': 'decking',
    'general': 'general contractor',
    'general contractor': 'general contractor',
    'handyman': 'handyman',
    'landscape': 'landscape',
    'landscaping': 'landscape', // Map "Landscaping" to landscape
    'pavers': 'pavers',
    'paving': 'pavers', // Map "Paving" to pavers
    'concrete': 'concrete',
    'tile': 'tile',
    'roofing': 'roofing',
    'siding': 'siding',
    'gutters': 'gutters',
    'garage doors': 'garage doors',
    'plumbing': 'plumbing',
    'electrical': 'electrical',
    'smart home': 'smart home',
    'hvac': 'hvac',
    'painting': 'painting',
    'flooring': 'flooring',
    'foundation': 'foundation',
    'pools and spas': 'pools & spas',
    'pools & spas': 'pools & spas',
    'solar': 'solar',
    'fire protection': 'fire protection',
    'individual sewerage': 'individualSewerage',
    'water treatment': 'waterTreatment',
    'solar contracting': 'solarContracting',
    'heaters': 'heaters',
  };
  
  // Check if we have a direct mapping
  if (tradeKeyMap[normalized]) {
    return tradeKeyMap[normalized];
  }
  
  // Don't try to translate if we don't have a mapping - return null
  return null;
}

export default function ProCardHeader({ 
  logo, 
  businessName, 
  contractorType,
  tradeIcon,
  licenses,
  phone,
  isListMode = false,
  onShare,
  onPhoneClick
}: ProCardHeaderProps) {
  const t = useTranslations('estimate.options.trades');
  const initials = getInitials(businessName);
  const [imageErrorState, setImageErrorState] = useState<{ logo?: string; hasError: boolean }>(() => ({
    logo,
    hasError: false,
  }));
  const imageError = imageErrorState.logo === logo ? imageErrorState.hasError : false;
  
  // Use licenses array if available, otherwise fall back to contractorType/tradeIcon
  const displayLicenses: Array<{ tradeName: string; tradeIcon?: string }> = licenses && licenses.length > 0
    ? licenses.map(license => ({
        tradeName: license.tradeName || contractorType.replace(/\s*Contractor\s*/gi, '').trim(),
        tradeIcon: license.tradeIcon,
      }))
    : [{
        tradeName: contractorType.replace(/\s*Contractor\s*/gi, '').trim(),
        tradeIcon: tradeIcon,
      }];

  // Don't show category if we have licenses array - licenses should be the source of truth
  const showCategory = false;

  // Calculate right padding based on number of buttons
  // In list mode: always show share, phone only if exists
  // share (right-10) + phone (right-1) = need pr-16 if both, pr-10 if only share
  const rightPadding = isListMode ? (phone ? 'pr-16' : 'pr-10') : 'pr-10';

  return (
    <div className={`relative ${showCategory ? 'min-h-[60px]' : 'h-[60px]'} flex items-center p-2 ${isListMode ? '' : 'border-b border-black'}`}>
      <div className={`flex items-center gap-3 md:gap-2 flex-1 ${rightPadding} min-w-0`}>
        {/* Avatar Box - Shows only Logo or Initials */}
        <div className={`w-12 h-12 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden relative aspect-square ${logo && !imageError ? 'bg-white' : 'bg-black'}`}>
          {logo && !imageError ? (
            <Image
              src={logo}
              alt={businessName}
              fill
              className="object-cover"
              sizes="48px"
              unoptimized
              onError={() => {
                setImageErrorState({ logo, hasError: true });
              }}
              onLoad={() => {
                // Image loaded successfully
              }}
            />
          ) : (
            <span className="text-lg font-bold text-white">{initials}</span>
          )}
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-sm font-bold text-black truncate leading-tight">{businessName}</h3>
          <div className="flex flex-col gap-0.5 min-w-0 mt-0.5">
            {/* Licenses - Show all with icons, pipe-separated, with ellipsis on overflow */}
            <div className="min-w-0 overflow-hidden">
              <p className="text-sm md:text-xs font-medium text-gray-600 truncate">
                {displayLicenses.map((license, index) => {
                  const IconComponent = license.tradeIcon && license.tradeIcon in LucideIcons
                    ? (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[license.tradeIcon]
                    : null;
                  
                  return (
                    <React.Fragment key={index}>
                      {IconComponent && (
                        <IconComponent className={`inline-block w-3.5 h-3.5 align-middle mr-1.5 ${getIconColor(license.tradeIcon).replace('-400', '-600').replace('-500', '-700')}`} />
                      )}
                      <span>
                        {(() => {
                          if (!license.tradeName) {
                            return license.tradeName;
                          }
                          const translationKey = getTradeTranslationKey(license.tradeName);
                          if (!translationKey) {
                            return license.tradeName;
                          }
                          // Only translate if we have a valid key
                          try {
                            return t(translationKey as Parameters<typeof t>[0]);
                          } catch {
                            return license.tradeName;
                          }
                        })()}
                      </span>
                      {index < displayLicenses.length - 1 && (
                        <span className="text-gray-400 mx-1.5">|</span>
                      )}
                    </React.Fragment>
                  );
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Share button on left (closer to center) - always show in list mode */}
      {isListMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare?.();
          }}
          className={`absolute ${phone ? 'right-10' : 'right-1'} w-10 h-10 rounded-lg bg-transparent flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0`}
          aria-label="Share"
        >
          <Share2 className="w-5 h-5 text-black" />
        </button>
      )}
      {/* Phone button on right (farthest right) */}
      {isListMode && phone && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPhoneClick?.(e);
            if (phone) {
              window.location.href = `tel:${phone}`;
            }
          }}
          className="absolute right-1 w-10 h-10 rounded-lg bg-transparent flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
          aria-label="Phone"
        >
          <Phone className="h-10 w-5 text-black" />
        </button>
      )}
      {/* Share button for non-list mode */}
      {!isListMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare?.();
          }}
          className="absolute right-2 w-10 h-10 rounded-lg bg-transparent flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
          aria-label="Share"
        >
          <Share2 className="w-5 h-5 text-black" />
        </button>
      )}
    </div>
  );
}

