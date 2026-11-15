'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import ShareBusinessModal from './ShareBusinessModal';

export interface ProSectionShareTarget {
  locale: string;
  slug: string;
  businessName: string;
  contractorType?: string;
  logo?: string;
}

interface ShareProSectionProps extends ProSectionShareTarget {
  section: 'services' | 'images';
  label: string;
  title: string;
  message: string;
  className?: string;
}

export default function ShareProSection({
  locale,
  slug,
  section,
  businessName,
  contractorType = '',
  logo,
  label,
  title,
  message,
  className,
}: ShareProSectionProps) {
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const openShare = () => {
    setShareUrl(`${window.location.origin}/${locale}/business/${encodeURIComponent(slug)}?tab=${section}`);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={openShare}
        className={
          className ??
          'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 text-sm font-medium text-black hover:bg-gray-100'
        }
        aria-label={title}
      >
        <Share2 className="h-4 w-4" aria-hidden />
        {label}
      </button>
      <ShareBusinessModal
        isOpen={open}
        onClose={() => setOpen(false)}
        businessName={businessName}
        contractorType={contractorType}
        logo={logo}
        businessUrl={shareUrl}
        fixedUrl={shareUrl}
        title={title}
        message={message}
      />
    </>
  );
}
