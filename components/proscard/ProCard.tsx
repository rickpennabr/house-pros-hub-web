'use client';

import ProCardHeader from './ProCardHeader';
import ProLinks from './ProLinks';
import ProReactions from './ProReactions';

import { LinkItem } from './ProLinks';

export interface ProCardData {
  id: string;
  logo?: string;
  businessName: string;
  contractorType: string;
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
  const handleShare = () => {
    if (onShare) {
      onShare(data.id);
    } else {
      // Default share behavior
      if (navigator.share) {
        navigator.share({
          title: data.businessName,
          text: `Check out ${data.businessName} - ${data.contractorType}`,
        });
      }
    }
  };

  const handleReaction = (type: 'love' | 'feedback' | 'link' | 'save') => {
    if (onReaction) {
      onReaction(data.id, type);
    }
  };

  return (
    <div className="border-2 border-black rounded-lg bg-white overflow-hidden">
      <ProCardHeader
        logo={data.logo}
        businessName={data.businessName}
        contractorType={data.contractorType}
        onShare={handleShare}
      />
      <ProLinks links={data.links} maxLinks={7} />
      <ProReactions 
        initialReactions={data.reactions}
        onReaction={handleReaction}
      />
    </div>
  );
}

