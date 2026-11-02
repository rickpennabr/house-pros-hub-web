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
import { createSignInUrl, createSignUpUrl, createLocalePath } from '@/lib/redirect';
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
}

function isBookingCalendarLink(link: LinkItem) {
  return link.type === 'calendar' && Boolean(link.url?.startsWith('/book/'));
}

/** Every card shows HPH QRcode. Saved links keep their order; missing ones sit right after phone. */
function ensureQrCodeLink(links: LinkItem[]): LinkItem[] {
  if (links.some((link) => link.type === 'qrcode')) return links;
  const qrCode: LinkItem = { type: 'qrcode', value: 'HPH QRcode' };
  const phoneIndex = links.findIndex((link) => link.type === 'phone');
  if (phoneIndex === -1) return [qrCode, ...links];
  return [...links.slice(0, phoneIndex + 1), qrCode, ...links.slice(phoneIndex + 1)];
}

/** Keep HPH QRcode and Book visible when the row is full. */
function limitCardLinks(links: LinkItem[], maxLinks: number): LinkItem[] {
  if (links.length <= maxLinks) return links;
  const pinned = links.filter((link) => link.type === 'qrcode' || isBookingCalendarLink(link));
  const rest = links.filter((link) => link.type !== 'qrcode' && !isBookingCalendarLink(link));
  const kept = new Set<LinkItem>([...rest.slice(0, Math.max(0, maxLinks - pinned.length)), ...pinned]);
  return links.filter((link) => kept.has(link));
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

export default function ProLinks({ links, maxLinks = 7, onSignInRequired, onQrCode }: ProLinksProps) {
  const orderedLinks = ensureQrCodeLink(links);
  const cappedLinks = limitCardLinks(orderedLinks, maxLinks);
  const bookingCalendarLink = cappedLinks.find(isBookingCalendarLink);
  const otherLinks = cappedLinks.filter((link) => !isBookingCalendarLink(link));
  const visibleLinks = bookingCalendarLink ? [...otherLinks, bookingCalendarLink] : otherLinks;
  const linkCount = visibleLinks.length;
  const shouldSpaceBetween = linkCount === 7;
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Link types that require auth: phone, email, and in-app booking (calendar → sign-up then book)
  const protectedLinkTypes: LinkItem['type'][] = ['phone', 'email'];
  const isProtectedLink = (link: LinkItem) => {
    if (isBookingCalendarLink(link)) return true; // booking: require sign-up, then go to pro calendar
    return protectedLinkTypes.includes(link.type);
  };

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
        if (isBookingCalendarLink(link) && link.url) {
          // Take to sign-up page so after sign-up user lands on the pro's booking page
          router.push(createSignUpUrl(locale as 'en' | 'es' | 'pt', link.url));
          return;
        }
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
    const iconSizeClass = link.type === 'angi'
      ? 'w-9 h-9 lg:w-8 lg:h-8'
      : 'w-5 h-5 lg:w-[18px] lg:h-[18px]';

    return (
      <button
        key={`${link.type}-${index}`}
        type="button"
        onClick={(e) => handleLinkClick(e, link)}
        className="w-10 h-10 lg:w-9 lg:h-9 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
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

  return (
    <div className={`h-[50px] flex items-center p-2 border-b border-black`}>
      <div className={`flex items-center flex-wrap w-full ${gapClass}`}>
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

