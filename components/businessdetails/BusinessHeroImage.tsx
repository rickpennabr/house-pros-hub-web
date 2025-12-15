'use client';

interface BusinessHeroImageProps {
  imageUrl?: string;
  businessName: string;
}

export default function BusinessHeroImage({ imageUrl, businessName }: BusinessHeroImageProps) {
  // Only show placeholder if user has not uploaded an image
  if (!imageUrl) {
    return (
      <div className="w-full h-64 md:h-80 relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 overflow-hidden">
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
    );
  }

  // If user has uploaded an image, show it without the business name
  return (
    <div className="w-full h-64 md:h-80 relative overflow-hidden">
      <img
        src={imageUrl}
        alt={businessName}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

