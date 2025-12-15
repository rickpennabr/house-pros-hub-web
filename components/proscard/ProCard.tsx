'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProCardHeader from './ProCardHeader';
import ProLinks from './ProLinks';
import ProReactions from './ProReactions';
import ShareBusinessModal from '@/components/businessdetails/ShareBusinessModal';

import { LinkItem } from './ProLinks';

export interface ProCardData {
  id: string;
  logo?: string;
  businessName: string;
  contractorType: string;
  tradeIcon?: string; // Icon name from lucide-react
  category?: string; // Category for filtering (e.g., 'Roofing', 'Plumbing', 'Tile', etc.)
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
}

export default function ProCard({ data, onShare, onReaction }: ProCardProps) {
  const router = useRouter();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleCardClick = () => {
    router.push(`/business/${data.id}`);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShare) {
      onShare(data.id);
    } else {
      setIsShareModalOpen(true);
    }
  };

  const handleReaction = (type: 'love' | 'feedback' | 'link' | 'save') => {
    if (onReaction) {
      onReaction(data.id, type);
    }
  };

  return (
    <div 
      className="border-2 border-black rounded-lg bg-white overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={handleCardClick}
    >
      <ProCardHeader
        logo={data.logo}
        businessName={data.businessName}
        contractorType={data.contractorType}
        tradeIcon={data.tradeIcon}
        onShare={handleShare}
      />
      <ProLinks links={data.links} maxLinks={7} />
      <ProReactions 
        initialReactions={data.reactions}
        onReaction={handleReaction}
      />
      
      <ShareBusinessModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        businessName={data.businessName}
        contractorType={data.contractorType}
        logo={data.logo}
        businessUrl={typeof window !== 'undefined' ? `${window.location.origin}/business/${data.id}` : ''}
      />
    </div>
  );
}

