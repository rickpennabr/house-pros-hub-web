'use client';

import { useState } from 'react';
// Keep lucide-react for generic icons
import { 
  Phone, 
  Globe, 
  Calendar,
  Mail,
  MapPin,
  QrCode,
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
import { createSignInUrl, createLocalePath } from '@/lib/redirect';
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
  /** When provided and user is not signed in, calling a protected link invokes this instead of redirecting to sign-in */
  onSignInRequired?: () => void;
  /** Opens the HPH QRcode for this pro. The icon is always shown, like BrazaLink cards. */
  onQrCode?: () => void;
  /** Sit inside another bar. Skips the card row border and fixed height. */
  bare?: boolean;
  /** Larger buttons from the md breakpoint up. Phones keep the compact size. */
  desktopLarge?: boolean;
}

function isBookingCalendarLink(link: LinkItem) {
  return link.type === 'calendar' && Boolean(link.url?.startsWith('/book/'));
}

/** The edit-business list is the order. Show that order, up to the row limit. */
function visibleLinkList(links: LinkItem[], maxLinks: number): LinkItem[] {
  return links.slice(0, maxLinks);
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

export default function ProLinks({ links, maxLinks = 7, onSignInRequired, onQrCode, bare = false, desktopLarge = false }: ProLinksProps) {
  const visibleLinks = visibleLinkList(links, maxLinks);
  const linkCount = visibleLinks.length;
  const shouldSpaceBetween = linkCount === 7;
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Phone and email stay behind sign-in. Booking calendar uses the same public /book path for guests.
  const protectedLinkTypes: LinkItem['type'][] = ['phone', 'email'];
  const isProtectedLink = (link: LinkItem) => protectedLinkTypes.includes(link.type);

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
    } else if (link.type === 'calendar' && link.url) {
      // Public booking page: navigate within app with locale
      router.push(createLocalePath(locale as 'en' | 'es' | 'pt', link.url));
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

    if (link.type === 'qrcode') {
      e.preventDefault();
      onQrCode?.();
      return;
    }
    
    if (isProtectedLink(link)) {
      if (isLoading) return;
      if (!isAuthenticated) {
        if (onSignInRequired) {
          onSignInRequired();
          return;
        }
        const signInUrl = createSignInUrl(locale as 'en' | 'es', pathname);
        router.push(signInUrl);
        return;
      }
    }
    
    // Execute the link action
    performLinkClick(link);
  };

  const renderLinkButton = (link: LinkItem, index: number) => {
    const Icon = iconMap[link.type] || Globe;
    const iconSizeClass = desktopLarge
      ? link.type === 'angi'
        ? 'w-9 h-9 md:h-[39.6px] md:w-[39.6px]'
        : 'w-5 h-5 md:h-[21.6px] md:w-[21.6px]'
      : link.type === 'angi'
        ? 'w-9 h-9 lg:w-8 lg:h-8'
        : 'w-5 h-5 lg:w-[18px] lg:h-[18px]';
    const buttonSizeClass = desktopLarge ? 'h-10 w-10 md:h-[43.2px] md:w-[43.2px]' : 'h-10 w-10 lg:h-9 lg:w-9';

    return (
      <button
        key={`${link.type}-${index}`}
        type="button"
        onClick={(e) => handleLinkClick(e, link)}
        className={`${buttonSizeClass} rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0`}
        aria-label={
          link.type === 'qrcode'
            ? 'HPH QRcode'
            : isBookingCalendarLink(link)
              ? 'Book a time with this pro'
              : link.type
        }
      >
        <Icon className={`${iconSizeClass} text-black`} />
      </button>
    );
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
  const rowClass = bare
    ? `justify-center gap-2${desktopLarge ? ' md:gap-[10.8px]' : ''}`
    : `w-full ${gapClass}`;

  return (
    <div className={bare ? 'flex max-w-full items-center' : 'h-[50px] flex items-center p-2 border-b border-black'}>
      <div className={`flex flex-wrap items-center ${rowClass}`}>
        {visibleLinks.map((link, index) => renderLinkButton(link, index))}
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

