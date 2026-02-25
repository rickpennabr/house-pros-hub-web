'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { createSignInUrl, createLocalePath } from '@/lib/redirect';
import ProCardHeader from './ProCardHeader';
import ProLinks from './ProLinks';
import ProReactions from './ProReactions';
import ShareBusinessModal from '@/components/businessdetails/ShareBusinessModal';

import { LinkItem } from './ProLinks';

export interface ProCardData {
  id: string;
  slug?: string;
  logo?: string;
  businessLogo?: string; // Form-sync field
  businessBackground?: string;
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
  companyDescription?: string;
  links: LinkItem[];
  reactions?: {
    love?: number;
    feedback?: number;
    link?: number;
    save?: number;
  };
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
  const { isAuthenticated, isLoading } = useAuth();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareBusinessUrl, setShareBusinessUrl] = useState('');

  useEffect(() => {
    setShareBusinessUrl(`${window.location.origin}/business/${data.slug || data.id}`);
  }, [data.slug, data.id]);

  const handleCardClick = () => {
    // Check authentication before navigating to business details
    if (isLoading) {
      return;
    }
    
    const slug = data.slug || data.id;
    const businessPath = `/business/${slug}`;
    
    if (!isAuthenticated) {
      const signInUrl = createSignInUrl(locale as 'en' | 'es', businessPath);
      router.push(signInUrl);
      return;
    }
    
    router.push(createLocalePath(locale as 'en' | 'es', businessPath));
  };

  const handleReaction = (type: 'love' | 'feedback' | 'link' | 'save') => {
    if (onReaction) {
      onReaction(data.id, type);
    }
  };

  // In list mode, only show the header
  if (isListMode) {
    // Get phone from direct props or from links array
    const phoneLink = data.links?.find(link => link.type === 'phone');
    const phoneNumber = data.phone || data.mobilePhone || phoneLink?.value || phoneLink?.url?.replace('tel:', '');
    
    return (
      <div 
        className="border-2 border-black rounded-lg bg-white overflow-hidden cursor-pointer hover:shadow-lg transition-shadow w-full"
        onClick={handleCardClick}
      >
        <ProCardHeader
          logo={data.logo}
          businessName={data.businessName}
          contractorType={data.contractorType}
          tradeIcon={data.tradeIcon}
          category={data.category}
          licenses={data.licenses}
          phone={phoneNumber}
          isListMode={true}
          onShare={() => {
            if (onShare) {
              onShare(data.id);
            } else {
              setIsShareModalOpen(true);
            }
          }}
        />
        <ShareBusinessModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          businessName={data.businessName}
          contractorType={data.contractorType}
          logo={data.logo}
          businessUrl={shareBusinessUrl}
        />
      </div>
    );
  }

  return (
    <div 
      className="border-2 border-black rounded-lg bg-white overflow-hidden cursor-pointer hover:shadow-lg transition-shadow w-full"
      onClick={handleCardClick}
    >
      <ProCardHeader
        logo={data.logo}
        businessName={data.businessName}
        contractorType={data.contractorType}
        tradeIcon={data.tradeIcon}
        category={data.category}
        licenses={data.licenses}
        onShare={() => {
          if (onShare) {
            onShare(data.id);
          } else {
            setIsShareModalOpen(true);
          }
        }}
      />
      <ProLinks links={data.links} maxLinks={7} />
      <ProReactions 
        initialReactions={data.reactions}
        onReaction={handleReaction}
        businessName={data.businessName}
        contractorType={data.contractorType}
        logo={data.logo}
        businessId={data.id}
      />
      
      <ShareBusinessModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        businessName={data.businessName}
        contractorType={data.contractorType}
        logo={data.logo}
        businessUrl={shareBusinessUrl}
      />
    </div>
  );
}

