'use client';

import { useState } from 'react';
// Keep lucide-react for generic icons
import { 
  Phone, 
  Globe, 
  Calendar,
  Mail,
  MapPin,
} from 'lucide-react';
// Import brand icons from react-icons (Simple Icons)
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
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createSignInUrl } from '@/lib/redirect';
import { LeaveExternalWarningModal } from './LeaveExternalWarningModal';
import { AngiIcon } from '@/components/ui/icons/AngiIcon';
import type { LinkType } from '@/lib/constants/linkTypes';

export interface LinkItem {
  type: LinkType;
  url?: string;
  value?: string;
}

interface ProLinksProps {
  links: LinkItem[];
  maxLinks?: number;
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

export default function ProLinks({ links, maxLinks = 7 }: ProLinksProps) {
  const visibleLinks = links.slice(0, maxLinks);
  const linkCount = visibleLinks.length;
  const shouldSpaceBetween = linkCount === 7;
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Define which link types require authentication
  const protectedLinkTypes: LinkItem['type'][] = ['phone', 'email', 'calendar'];
  const isProtectedLink = (type: LinkItem['type']) => protectedLinkTypes.includes(type);

  const performLinkClick = (link: LinkItem) => {
    if (link.type === 'phone' && link.value) {
      // Use temporary anchor for navigation to avoid React hooks immutability warning
      const anchor = document.createElement('a');
      anchor.href = `tel:${link.value}`;
      anchor.click();
    } else if (link.type === 'email' && link.value) {
      // Use temporary anchor for navigation to avoid React hooks immutability warning
      const anchor = document.createElement('a');
      anchor.href = `mailto:${link.value}`;
      anchor.click();
    } else if (link.url) {
      if (link.type === 'website') {
        setPendingUrl(link.url);
        setIsWarningModalOpen(true);
      } else {
        window.open(link.url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const handleConfirmWebsite = () => {
    if (pendingUrl) {
      window.open(pendingUrl, '_blank', 'noopener,noreferrer');
    }
    setIsWarningModalOpen(false);
    setPendingUrl(null);
  };

  const handleCancelWebsite = () => {
    setIsWarningModalOpen(false);
    setPendingUrl(null);
  };

  const handleLinkClick = (e: React.MouseEvent, link: LinkItem) => {
    e.stopPropagation();
    
    if (isProtectedLink(link.type)) {
      // Check authentication for protected links
      if (isLoading) {
        return;
      }
      
      if (!isAuthenticated) {
        const signInUrl = createSignInUrl(locale as 'en' | 'es', pathname);
        router.push(signInUrl);
        return;
      }
    }
    
    // Execute the link action
    performLinkClick(link);
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
    <div className={`h-[50px] flex items-center p-2 border-b border-black`}>
      <div className={`flex items-center flex-wrap w-full ${gapClass}`}>
        {visibleLinks.map((link, index) => {
          const Icon = iconMap[link.type] || Globe;
          // Make Angi icon bigger
          const iconSizeClass = link.type === 'angi' 
            ? 'w-9 h-9 lg:w-8 lg:h-8' 
            : 'w-5 h-5 lg:w-[18px] lg:h-[18px]';

          return (
            <button
              key={index}
              onClick={(e) => handleLinkClick(e, link)}
              className="w-10 h-10 lg:w-9 lg:h-9 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
              aria-label={link.type}
            >
              <Icon className={`${iconSizeClass} text-black`} />
            </button>
          );
        })}
      </div>

      <LeaveExternalWarningModal
        isOpen={isWarningModalOpen}
        onConfirm={handleConfirmWebsite}
        onCancel={handleCancelWebsite}
        websiteUrl={pendingUrl || ''}
      />
    </div>
  );
}

