'use client';

import { 
  Phone, 
  Globe, 
  Calendar,
  Mail,
  MapPin,
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

interface BusinessLinksTabProps {
  links: LinkItem[];
}

// Type for icon components (both lucide-react and react-icons)
type IconComponent = React.ComponentType<{ className?: string }>;

const iconMap: Partial<Record<LinkItem['type'], IconComponent>> = {
  // Generic icons from lucide-react
  phone: Phone,
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
  instagram: 'Instagram',
  facebook: 'Facebook',
  website: 'Website',
  calendar: 'Schedule',
  email: 'Email',
  location: 'Location',
};

export default function BusinessLinksTab({ links }: BusinessLinksTabProps) {
  const handleLinkClick = (link: LinkItem) => {
    if (link.type === 'phone' && link.value) {
      window.location.assign(`tel:${link.value}`);
    } else if (link.type === 'email' && link.value) {
      window.location.assign(`mailto:${link.value}`);
    } else if (link.url) {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  if (links.length === 0) {
    return (
      <div className="p-4 bg-white">
        <p className="text-gray-600">No links available.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white">
      <h2 className="text-xl font-bold text-black mb-4">Links</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {links.map((link, index) => {
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
    </div>
  );
}

