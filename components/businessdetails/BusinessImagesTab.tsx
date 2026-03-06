'use client';

import Image from 'next/image';

interface BusinessImagesTabProps {
  images?: string[];
  businessName: string;
}

export default function BusinessImagesTab({ images, businessName }: BusinessImagesTabProps) {
  const list = images && images.length > 0 ? images : [];

  if (list.length === 0) {
    return (
      <div className="bg-white py-12 text-center text-gray-500">
        <p>No gallery images yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {list.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className="relative aspect-square rounded-lg border-2 border-black overflow-hidden bg-gray-100"
          >
            <Image
              src={url}
              alt={`${businessName} gallery image ${index + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
              unoptimized={url.startsWith('data:')}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
