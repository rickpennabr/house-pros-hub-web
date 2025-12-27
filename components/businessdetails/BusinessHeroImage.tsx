'use client';

import { useState } from 'react';
import Image from 'next/image';

interface BusinessHeroImageProps {
  imageUrl?: string;
  businessName: string;
}

export default function BusinessHeroImage({ imageUrl, businessName }: BusinessHeroImageProps) {
  const [imageErrorState, setImageErrorState] = useState<{
    imageUrl?: string;
    hasError: boolean;
  }>(() => ({ imageUrl, hasError: false }));

  const imageError = imageErrorState.imageUrl === imageUrl ? imageErrorState.hasError : false;
  
  // Normalize URL to fix double bucket name issue
  const normalizeImageUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    
    // Fix double business-backgrounds in URL
    // Pattern: .../business-backgrounds/business-backgrounds/... should be .../business-backgrounds/...
    const normalized = url.replace(
      /\/business-backgrounds\/business-backgrounds\//g,
      '/business-backgrounds/'
    );
    
    return normalized;
  };
  
  const normalizedImageUrl = normalizeImageUrl(imageUrl);
  const hasValidImage = normalizedImageUrl && !imageError;
  
  return (
    <div className="w-full h-[200px] md:h-[300px] lg:h-[350px] relative bg-white overflow-hidden">
      {!hasValidImage ? (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 10px,
                rgba(255, 255, 255, 0.05) 10px,
                rgba(255, 255, 255, 0.05) 20px
              )`
            }}></div>
          </div>
          {/* Placeholder with business name */}
          <div className="w-full h-full flex items-center justify-center relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white drop-shadow-2xl text-center px-4">
              {businessName}
            </h2>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0">
          <Image
            src={normalizedImageUrl}
            alt={businessName}
            fill
            className="object-cover"
            sizes="100vw"
            unoptimized
            onError={() => {
              console.error('Failed to load business background image:', normalizedImageUrl);
              setImageErrorState({ imageUrl, hasError: true });
            }}
          />
        </div>
      )}
    </div>
  );
}

