'use client';

import { useState } from 'react';
import Image from 'next/image';
import * as LucideIcons from 'lucide-react';
import { useTranslations } from 'next-intl';

interface LicenseInfo {
  license: string;
  licenseNumber: string;
  tradeName?: string;
  tradeIcon?: string;
}

interface BusinessAboutTabProps {
  businessName: string;
  contractorType: string;
  description?: string;
  logo?: string;
  licenses?: LicenseInfo[];
  ownerImage?: string;
  ownerName?: string;
  ownerTitle?: string;
  ownerDescription?: string;
  companyDescription?: string;
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
    'RectangleHorizontal': 'text-sky-400',
  };
  return colorMap[iconName || ''] || 'text-gray-400';
}

// Convert trade name to translation key
// Returns the translation key if it exists, or null if not found
function getTradeTranslationKey(tradeName: string): string | null {
  if (!tradeName) return null;
  
  // Normalize the trade name to a translation key
  const normalized = tradeName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .trim()
    .replace(/\s+/g, ' '); // Normalize spaces
  
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
    'doors': 'doors',
    'fencing': 'fencing',
    'decking': 'decking',
    'general': 'general',
    'landscape': 'landscape',
    'pavers': 'pavers',
    'tile': 'tile',
    'roofing': 'roofing',
    'plumbing': 'plumbing',
    'electrical': 'electrical',
    'hvac': 'hvac',
    'painting': 'painting',
    'flooring': 'flooring',
    'foundation': 'foundation',
  };
  
  // Check if we have a direct mapping
  if (tradeKeyMap[normalized]) {
    return tradeKeyMap[normalized];
  }
  
  // Don't try to translate if we don't have a mapping - return null
  return null;
}

export default function BusinessAboutTab({ 
  businessName, 
  contractorType,
  description,
  logo,
  licenses,
  ownerImage,
  ownerName,
  ownerTitle,
  ownerDescription,
  companyDescription
}: BusinessAboutTabProps) {
  const t = useTranslations('estimate.options.trades');
  const [logoError, setLogoError] = useState(false);
  const [ownerImageError, setOwnerImageError] = useState(false);
  const businessInitials = getInitials(businessName);
  const ownerInitials = ownerName ? getInitials(ownerName) : '';
  
  return (
    <div className="bg-white space-y-8">
      {/* About the Company */}
      <section>
        <h2 className="text-xl font-bold text-black mb-2 flex items-center gap-2">
          <span>About the Company</span>
        </h2>
        
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 flex-shrink-0">
            <div className={`aspect-square relative rounded-lg border-2 border-black overflow-hidden flex items-center justify-center p-4 ${logo && !logoError ? 'bg-gray-50' : 'bg-black'}`}>
              {logo && !logoError ? (
                <Image
                  src={logo}
                  alt={businessName}
                  width={200}
                  height={200}
                  className="max-w-full max-h-full object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span className="text-4xl font-bold text-white">{businessInitials}</span>
              )}
            </div>
          </div>
          
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Business Name</p>
              <p className="text-lg font-semibold text-black">{businessName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Contractor Type</p>
              <p className="text-lg font-semibold text-black">{contractorType}</p>
            </div>
            {licenses && licenses.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Licenses</p>
                <div className="space-y-2">
                  {licenses.map((license, index) => {
                    type LucideIconName = keyof typeof LucideIcons;
                    const iconName = license.tradeIcon as LucideIconName | undefined;
                    const IconComponent =
                      iconName && iconName in LucideIcons
                        ? (LucideIcons[iconName] as unknown as React.ComponentType<{ className?: string }>)
                        : null;
                    
                    return (
                      <div key={index} className="flex items-center gap-3 p-2 border border-gray-200 rounded-lg">
                        {IconComponent && (
                          <IconComponent className={`w-5 h-5 shrink-0 ${getIconColor(license.tradeIcon)}`} />
                        )}
                        <div className="flex-1">
                          <p className="text-base font-semibold text-black">
                            {(() => {
                              const tradeName = license.tradeName || 'General Contractor';
                              if (tradeName === 'General Contractor') return tradeName;
                              if (!tradeName) return 'General Contractor';
                              const translationKey = getTradeTranslationKey(tradeName);
                              if (!translationKey) {
                                return tradeName;
                              }
                              // Only translate if we have a valid key
                              try {
                                return t(translationKey);
                              } catch {
                                return tradeName;
                              }
                            })()}
                          </p>
                          <p className="text-sm text-gray-600">
                            {license.license} - {license.licenseNumber}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {(companyDescription || description) && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Company Description</p>
                <p className="text-base text-black leading-relaxed">
                  {companyDescription || description}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Individuals / Owner */}
      {(ownerImage || ownerName || ownerDescription) && (
        <section className="pt-8 border-t-2 border-black/10">
          <div className="flex flex-col md:flex-row-reverse gap-6">
            <div className="w-full md:w-1/3 flex-shrink-0">
              <h2 className="text-xl font-bold text-black mb-2">About the Owner</h2>
              <div className={`aspect-square relative rounded-lg border-2 border-black overflow-hidden flex items-center justify-center ${ownerImage && !ownerImageError ? 'bg-gray-50' : 'bg-black'}`}>
                {ownerImage && !ownerImageError ? (
                  <Image
                    src={ownerImage}
                    alt={ownerName || 'Owner'}
                    fill
                    className="object-cover"
                    onError={() => setOwnerImageError(true)}
                  />
                ) : (
                  <span className="text-4xl font-bold text-white">{ownerInitials}</span>
                )}
              </div>
            </div>
            
            <div className="flex-1 space-y-4 md:pt-[calc(1.5rem+0.5rem)]">
              {ownerName && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Owner&apos;s Name</p>
                  <p className="text-lg font-semibold text-black">{ownerName}</p>
                  {ownerTitle && (
                    <p className="text-md text-gray-700 font-medium">{ownerTitle}</p>
                  )}
                </div>
              )}
              
              {ownerDescription && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">About</p>
                  <p className="text-base text-black leading-relaxed">
                    {ownerDescription}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

