'use client';

import Link from 'next/link';
import { Phone, Globe, MessageCircle } from 'lucide-react';
import { SiInstagram } from 'react-icons/si';
import { useLocale } from 'next-intl';

interface BusinessContactIconsProps {
  phone?: string;
  website?: string;
  instagram?: string;
  /** When set, show a ProBot/chat icon linking to the ProBot page with this business pre-selected */
  businessSlug?: string;
  businessId?: string;
}

export default function BusinessContactIcons({
  phone,
  website,
  instagram,
  businessSlug,
  businessId,
}: BusinessContactIconsProps) {
  const locale = useLocale();
  const probotContact = businessSlug || businessId;
  const probotHref = probotContact ? `/${locale}/probot?contact=${encodeURIComponent(probotContact)}` : null;
  const handlePhoneClick = () => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const handleWebsiteClick = () => {
    if (website) {
      window.open(website, '_blank', 'noopener,noreferrer');
    }
  };

  const handleInstagramClick = () => {
    if (instagram) {
      window.open(instagram, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="w-full flex items-center justify-center gap-4 bg-white">
      {probotHref && (
        <Link
          href={probotHref}
          className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
          aria-label="ProBot"
        >
          <MessageCircle className="w-5 h-5 text-black" />
        </Link>
      )}
      {phone && (
        <button
          onClick={handlePhoneClick}
          className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
          aria-label="Phone"
        >
          <Phone className="w-5 h-5 text-black" />
        </button>
      )}
      {website && (
        <button
          onClick={handleWebsiteClick}
          className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
          aria-label="Website"
        >
          <Globe className="w-5 h-5 text-black" />
        </button>
      )}
      {instagram && (
        <button
          onClick={handleInstagramClick}
          className="w-10 h-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
          aria-label="Instagram"
        >
          <SiInstagram className="w-5 h-5 text-black" />
        </button>
      )}
    </div>
  );
}

