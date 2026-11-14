'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { createLocalePath } from '@/lib/redirect';
import ProCardHeader from './ProCardHeader';
import ProLinks from './ProLinks';
import ProReactions from './ProReactions';
import ShareBusinessModal from '@/components/businessdetails/ShareBusinessModal';
import SignInRequiredModal from '@/components/auth/SignInRequiredModal';
import { HphQrCodeModal } from '@/components/qr/HphQrCodeModal';
import { publicPageUrl } from '@/lib/qr/public-origin';

import { LinkItem } from './ProLinks';
import type { Locale } from '@/i18n';

export interface ProCardData {
  id: string;
  slug?: string;
  logo?: string;
  businessLogo?: string; // Form-sync field
  businessBackground?: string;
  businessBackgroundPosition?: string;
  businessName: string;
  contractorType: string;
  tradeIcon?: string; // Icon name from lucide-react (deprecated - use licenses array)
  category?: string; // Category for filtering (e.g., 'Roofing', 'Plumbing', 'Tile', etc.)
  licenses?: Array<{ license: string; licenseNumber: string; tradeName?: string; tradeIcon?: string }>;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  apartment?: string;
  address?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  ownerImage?: string;
  ownerName?: string;
  ownerTitle?: string;
  ownerDescription?: string;
  ownerBio?: string;
  ownerExperience?: string;
  ownerDegrees?: string;
  ownerCertifications?: string;
  ownerYearsExperience?: number;
  companyDescription?: string;
  services?: string[];
  images?: string[];
  links: LinkItem[];
  reactions?: {
    love?: number;
    feedback?: number;
    link?: number;
    save?: number;
  };
  /** Pro online status for status indicator on card (green = online, gray = offline) */
  online?: boolean;
}

interface ProCardProps {
  data: ProCardData;
  onShare?: (id: string) => void;
  onReaction?: (id: string, type: 'love' | 'feedback' | 'link' | 'save') => void;
  isListMode?: boolean;
}

export default function ProCard({ data, onShare, onReaction, isListMode = false }: ProCardProps) {
  const router = useRouter();
  const locale = useLocale();
  const { isAuthenticated } = useAuth();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSignInRequiredOpen, setIsSignInRequiredOpen] = useState(false);
  const profileHref = createLocalePath(locale as Locale, `/business/${data.slug || data.id}`);
  const [shareBusinessUrl, setShareBusinessUrl] = useState('');
  const qrFileName = `hph-${(data.slug || data.id).replace(/[^a-zA-Z0-9-_]+/g, '-')}-qr.png`;
  const qrUrl = publicPageUrl(profileHref);

  const openQrCode = () => setIsQrModalOpen(true);

  useEffect(() => {
    setShareBusinessUrl(`${window.location.origin}${profileHref}`);
  }, [profileHref]);

  const handleReaction = (type: 'love' | 'feedback' | 'link' | 'save') => {
    if (onReaction) {
      onReaction(data.id, type);
    }
  };

  const handleMessageClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isAuthenticated) {
      setIsSignInRequiredOpen(true);
      return;
    }
    const slugOrId = data.slug || data.id;
    router.push(createLocalePath(locale as 'en' | 'es', `/probot?contact=${encodeURIComponent(slugOrId)}`));
  };

  const showSignInRequired = () => setIsSignInRequiredOpen(true);

  // In list mode, only show the header
  if (isListMode) {
    const phoneLink = data.links?.find(link => link.type === 'phone');
    const phoneNumber = data.phone || data.mobilePhone || phoneLink?.value || phoneLink?.url?.replace('tel:', '');
    const handlePhoneClick = (e: React.MouseEvent) => {
      if (!isAuthenticated) {
        e.preventDefault();
        setIsSignInRequiredOpen(true);
      }
    };

    return (
      <div className="procard relative border-2 border-black rounded-lg bg-white overflow-hidden hover:shadow-lg transition-shadow w-full">
        <Link href={profileHref} className="absolute inset-0 z-[1]" aria-label={data.businessName} />
        <div className="relative z-[2] pointer-events-none">
        <ProCardHeader
          logo={data.logo}
          businessName={data.businessName}
          contractorType={data.contractorType}
          tradeIcon={data.tradeIcon}
          category={data.category}
          licenses={data.licenses}
          phone={phoneNumber}
          isListMode={true}
          online={data.online}
          onMessage={handleMessageClick}
          onShare={() => {
            if (onShare) {
              onShare(data.id);
            } else {
              setIsShareModalOpen(true);
            }
          }}
          onPhoneClick={!isAuthenticated ? handlePhoneClick : undefined}
        />
        </div>
        <ShareBusinessModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          businessName={data.businessName}
          contractorType={data.contractorType}
          logo={data.logo}
          businessUrl={shareBusinessUrl}
        />
        <SignInRequiredModal isOpen={isSignInRequiredOpen} onClose={() => setIsSignInRequiredOpen(false)} />
      </div>
    );
  }

  return (
    <div className="procard relative border-2 border-black rounded-lg bg-white overflow-hidden hover:shadow-lg transition-shadow w-full">
      <Link href={profileHref} className="absolute inset-0 z-[1]" aria-label={data.businessName} />
      <div className="relative z-[2] pointer-events-none">
      <ProCardHeader
        logo={data.logo}
        businessName={data.businessName}
        contractorType={data.contractorType}
        tradeIcon={data.tradeIcon}
        category={data.category}
        licenses={data.licenses}
        online={data.online}
        onMessage={handleMessageClick}
        onShare={() => {
          if (onShare) {
            onShare(data.id);
          } else {
            setIsShareModalOpen(true);
          }
        }}
      />
      <div className="pointer-events-auto relative z-20">
      <ProLinks
        links={data.links}
        maxLinks={7}
        onSignInRequired={!isAuthenticated ? showSignInRequired : undefined}
        onQrCode={openQrCode}
      />
      <ProReactions 
        initialReactions={data.reactions}
        onReaction={handleReaction}
        businessName={data.businessName}
        contractorType={data.contractorType}
        logo={data.logo}
        businessId={data.id}
        businessSlug={data.slug}
        ownerUserId={(data as { userId?: string }).userId}
        onSignInRequired={!isAuthenticated ? showSignInRequired : undefined}
      />
      </div>
      </div>
      
      <ShareBusinessModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        businessName={data.businessName}
        contractorType={data.contractorType}
        logo={data.logo}
        businessUrl={shareBusinessUrl}
      />
      <HphQrCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        url={qrUrl}
        label={data.businessName}
        logoSrc={data.logo}
        fileName={qrFileName}
      />
      <SignInRequiredModal isOpen={isSignInRequiredOpen} onClose={() => setIsSignInRequiredOpen(false)} />
    </div>
  );
}

