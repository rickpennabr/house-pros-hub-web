'use client';

import { 
  Phone, 
  Globe, 
  Calendar,
  Mail,
  MapPin,
  QrCode,
} from 'lucide-react';
import {
  SiInstagram,
  SiFacebook,
  SiX,
  SiYoutube,
  SiTiktok,
  SiLinkedin,
  SiTelegram,
  SiDiscord,
  SiWhatsapp,
  SiYelp,
  SiNextdoor,
} from 'react-icons/si';
import { LinkItem } from '@/components/proscard/ProLinks';
import { AngiIcon } from '@/components/ui/icons/AngiIcon';
import { HphQrCodeModal } from '@/components/qr/HphQrCodeModal';
import { publicPageUrl } from '@/lib/qr/public-origin';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface BusinessLinksTabProps {
  links: LinkItem[];
  businessName?: string;
  logoSrc?: string | null;
}

// Type for icon components (both lucide-react and react-icons)
type IconComponent = React.ComponentType<{ className?: string }>;

const iconMap: Partial<Record<LinkItem['type'], IconComponent>> = {
  // Generic icons from lucide-react
  phone: Phone,
  qrcode: QrCode,
  website: Globe,
  calendar: Calendar,
  email: Mail,
  location: MapPin,
  whatsapp: SiWhatsapp,
  
  // Brand icons from react-icons (Simple Icons)
  instagram: SiInstagram,
  facebook: SiFacebook,
  x: SiX,
  youtube: SiYoutube,
  tiktok: SiTiktok,
  linkedin: SiLinkedin,
  telegram: SiTelegram,
  discord: SiDiscord,
  yelp: SiYelp,
  nextdoor: SiNextdoor,
  angi: AngiIcon,
};

const linkLabels: Record<string, string> = {
  phone: 'Phone',
  qrcode: 'HPH QRcode',
  instagram: 'Instagram',
  facebook: 'Facebook',
  website: 'Website',
  calendar: 'Schedule',
  email: 'Email',
  location: 'Location',
};

export default function BusinessLinksTab({ links, businessName, logoSrc }: BusinessLinksTabProps) {
  const [isQrOpen, setIsQrOpen] = useState(false);
  const pathname = usePathname();
  const pageUrl = publicPageUrl(pathname);

  const handleLinkClick = (link: LinkItem) => {
    if (link.type === 'qrcode') {
      setIsQrOpen(true);
      return;
    }
    if (link.type === 'phone' && link.value) {
      window.location.assign(`tel:${link.value}`);
    } else if (link.type === 'email' && link.value) {
      window.location.assign(`mailto:${link.value}`);
    } else if (link.url) {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  const visibleLinks = links.filter((link) => link.type !== 'phone');

  if (visibleLinks.length === 0) {
    return (
      <div className="p-4 bg-white">
        <p className="text-gray-600">No links available.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visibleLinks.map((link, index) => {
          const Icon = iconMap[link.type] || Globe;

          const displayValue = link.value || link.url || '';
          const label = linkLabels[link.type] || link.type;

          return (
            <div
              key={index}
              className="border-2 border-black rounded-lg bg-white p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => handleLinkClick(link)}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0">
                  <Icon className={link.type === 'angi' ? 'w-8 h-8 text-black' : 'w-6 h-6 text-black'} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 mb-1">{label}</p>
                  <p className="text-lg font-semibold text-black break-all">{displayValue}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <HphQrCodeModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        url={pageUrl}
        label={businessName}
        logoSrc={logoSrc}
        fileName="hph-qr.png"
      />
    </div>
  );
}

