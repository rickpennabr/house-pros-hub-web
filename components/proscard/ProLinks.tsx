'use client';

import { 
  Phone, 
  Instagram, 
  Facebook, 
  Globe, 
  Calendar,
  Mail,
  MapPin
} from 'lucide-react';
import { useProtectedAction } from '@/hooks/useProtectedAction';

export interface LinkItem {
  type: 'phone' | 'instagram' | 'facebook' | 'website' | 'calendar' | 'email' | 'location';
  url?: string;
  value?: string;
}

interface ProLinksProps {
  links: LinkItem[];
  maxLinks?: number;
}

const iconMap = {
  phone: Phone,
  instagram: Instagram,
  facebook: Facebook,
  website: Globe,
  calendar: Calendar,
  email: Mail,
  location: MapPin,
};

export default function ProLinks({ links, maxLinks = 7 }: ProLinksProps) {
  const visibleLinks = links.slice(0, maxLinks);
  const linkCount = visibleLinks.length;
  const shouldSpaceBetween = linkCount === 7;

  // Define which link types require authentication
  const protectedLinkTypes: LinkItem['type'][] = ['phone', 'email', 'calendar'];
  const isProtectedLink = (type: LinkItem['type']) => protectedLinkTypes.includes(type);

  const performLinkClick = (link: LinkItem) => {
    if (link.type === 'phone' && link.value) {
      window.location.href = `tel:${link.value}`;
    } else if (link.type === 'email' && link.value) {
      window.location.href = `mailto:${link.value}`;
    } else if (link.url) {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  // Wrap protected actions with auth check
  const handleProtectedLinkClick = useProtectedAction(performLinkClick);

  const handleLinkClick = (e: React.MouseEvent, link: LinkItem) => {
    e.stopPropagation();
    if (isProtectedLink(link.type)) {
      handleProtectedLinkClick(link);
    } else {
      // Public links (website, instagram, facebook, location) don't need auth
      performLinkClick(link);
    }
  };

  // Gap logic:
  // - 7 links: gap-1 with justify-between
  // - 6 links: gap-2
  // - Less than 6 links: gap-4 (more space)
  const gapClass = shouldSpaceBetween 
    ? 'gap-1 justify-between' 
    : linkCount === 6 
      ? 'gap-2' 
      : 'gap-4';

  return (
    <div className={`h-[60px] flex items-center p-2 border-b border-black`}>
      <div className={`flex items-center flex-wrap w-full ${gapClass}`}>
        {visibleLinks.map((link, index) => {
          const Icon = iconMap[link.type];
          if (!Icon) return null;

          return (
            <button
              key={index}
              onClick={(e) => handleLinkClick(e, link)}
              className="w-10 h-10 lg:w-9 lg:h-9 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
              aria-label={link.type}
            >
              <Icon className="w-5 h-5 lg:w-[18px] lg:h-[18px] text-black" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

