'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Copy, MessageSquare, Mail, Share2 } from 'lucide-react';
import Image from 'next/image';

interface ShareBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessName: string;
  contractorType: string;
  logo?: string;
  businessUrl: string;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(word => word.length > 0);
  
  if (words.length === 0) return '';
  
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  } else {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
}

export default function ShareBusinessModal({
  isOpen,
  onClose,
  businessName,
  contractorType,
  logo,
  businessUrl,
}: ShareBusinessModalProps) {
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const initials = getInitials(businessName);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(businessUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleShare = (platform: string) => {
    const encodedUrl = encodeURIComponent(businessUrl);
    const encodedText = encodeURIComponent(`Check out ${businessName} - ${contractorType}`);
    
    const shareUrls: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      sms: `sms:?body=${encodedText}%20${encodedUrl}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedText}`,
      email: `mailto:?subject=${encodeURIComponent(businessName)}&body=${encodedText}%20${encodedUrl}`,
    };

    const url = shareUrls[platform];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center md:p-4 bg-black/50">
      <div ref={modalRef} className="bg-white md:rounded-lg border-2 border-black w-full h-full md:w-full md:h-auto md:max-w-md md:max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-black">
          <h2 className="text-xl font-bold text-black">Share Business</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Business Info */}
        <div className="p-4 border-b-2 border-black">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg border-2 border-black flex items-center justify-center shrink-0 overflow-hidden bg-black">
              {logo ? (
                <Image
                  src={logo}
                  alt={businessName}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-white">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-black truncate">{businessName}</h3>
              <p className="text-sm text-gray-600 truncate">{contractorType}</p>
            </div>
          </div>
        </div>

        {/* Business URL */}
        <div className="p-4 border-b-2 border-black">
          <div className="bg-yellow-100 border-2 border-black rounded-lg p-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-black truncate flex-1">{businessUrl}</p>
            <button
              onClick={handleCopyLink}
              className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors shrink-0"
              aria-label="Copy link"
            >
              <Copy className="w-4 h-4 text-black" />
            </button>
          </div>
          {copied && (
            <p className="text-sm text-green-600 mt-2 text-center">Link copied!</p>
          )}
        </div>

        {/* Sharing Options */}
        <div className="p-4">
          <h3 className="text-lg font-bold text-black mb-3">Sharing Options</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* WhatsApp */}
            <button
              onClick={() => handleShare('whatsapp')}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-black bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-black text-center">WhatsApp</span>
            </button>

            {/* SMS */}
            <button
              onClick={() => handleShare('sms')}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-black bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white">
                <MessageSquare className="w-5 h-5 text-black" />
              </div>
              <span className="text-xs font-medium text-black text-center">SMS</span>
            </button>

            {/* Facebook */}
            <button
              onClick={() => handleShare('facebook')}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-black bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-black text-center">Facebook</span>
            </button>

            {/* X (Twitter) */}
            <button
              onClick={() => handleShare('twitter')}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-black bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#000000">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-black text-center">X</span>
            </button>

            {/* Telegram */}
            <button
              onClick={() => handleShare('telegram')}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-black bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0088cc">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.559z"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-black text-center">Telegram</span>
            </button>

            {/* LinkedIn */}
            <button
              onClick={() => handleShare('linkedin')}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-black bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0077B5">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-black text-center">LinkedIn</span>
            </button>

            {/* Pinterest */}
            <button
              onClick={() => handleShare('pinterest')}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-black bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#BD081C">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-black text-center">Pinterest</span>
            </button>

            {/* Email */}
            <button
              onClick={() => handleShare('email')}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-black bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white">
                <Mail className="w-5 h-5 text-black" />
              </div>
              <span className="text-xs font-medium text-black text-center">Email</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

