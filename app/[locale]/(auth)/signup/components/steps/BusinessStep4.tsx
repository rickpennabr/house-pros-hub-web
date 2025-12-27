'use client';

import React, { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { GripVertical, X, ChevronDown, ChevronUp, Globe, Phone, MapPin, AtSign } from 'lucide-react';
import { SiNextdoor, SiWhatsapp, SiYelp, SiInstagram, SiFacebook, SiLinkedin, SiTelegram } from 'react-icons/si';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { LinkItem } from '@/components/proscard/ProLinks';
import { processLinkValue } from '@/lib/utils/link-processor';
import { AddressRequiredModal } from '../AddressRequiredModal';
import type { BusinessFormValues } from '@/lib/schemas/business';
import { AngiIcon } from '@/components/ui/icons/AngiIcon';

interface BusinessStep4Props {
  updateLink: (type: LinkItem['type'], url?: string, value?: string) => void;
  reorderLinks: (fromIndex: number, toIndex: number) => void;
  personalData?: {
    phone?: string;
    mobilePhone?: string;
  };
}

interface SocialMediaOption {
  key: LinkItem['type'];
  label: string;
  useAtSymbol?: boolean;
  usePhoneIcon?: boolean;
  useGlobeIcon?: boolean;
  useMapIcon?: boolean;
  useStarIcon?: boolean;
  useHomeIcon?: boolean;
  useHammerIcon?: boolean;
  useWhatsAppIcon?: boolean;
  placeholder?: string;
}

function getSocialMediaOptions(
  tPlatforms: ReturnType<typeof useTranslations>
): SocialMediaOption[] {
  return [
    { key: 'phone', label: tPlatforms('phone.label'), usePhoneIcon: true, placeholder: tPlatforms('phone.placeholder') },
    { key: 'location', label: tPlatforms('location.label'), useMapIcon: true, placeholder: tPlatforms('location.placeholder') },
    { key: 'website', label: tPlatforms('website.label'), useGlobeIcon: true, placeholder: tPlatforms('website.placeholder') },
    { key: 'instagram', label: tPlatforms('instagram.label'), placeholder: tPlatforms('instagram.placeholder') },
    { key: 'facebook', label: tPlatforms('facebook.label'), placeholder: tPlatforms('facebook.placeholder') },
    { key: 'whatsapp', label: tPlatforms('whatsapp.label'), useWhatsAppIcon: true, placeholder: tPlatforms('whatsapp.placeholder') },
    { key: 'yelp', label: tPlatforms('yelp.label'), useStarIcon: true, placeholder: tPlatforms('yelp.placeholder') },
    { key: 'nextdoor', label: tPlatforms('nextdoor.label'), placeholder: tPlatforms('nextdoor.placeholder') },
    { key: 'angi', label: tPlatforms('angi.label'), useHammerIcon: true, placeholder: tPlatforms('angi.placeholder') },
    { key: 'youtube', label: tPlatforms('youtube.label'), useAtSymbol: true, placeholder: tPlatforms('youtube.placeholder') },
    { key: 'tiktok', label: tPlatforms('tiktok.label'), useAtSymbol: true, placeholder: tPlatforms('tiktok.placeholder') },
    { key: 'linkedin', label: tPlatforms('linkedin.label'), placeholder: tPlatforms('linkedin.placeholder') },
    { key: 'telegram', label: tPlatforms('telegram.label'), placeholder: tPlatforms('telegram.placeholder') },
    { key: 'email', label: tPlatforms('email.label'), placeholder: tPlatforms('email.placeholder') },
    { key: 'calendar', label: tPlatforms('calendar.label'), placeholder: tPlatforms('calendar.placeholder') },
  ];
}

export function BusinessStep4({ updateLink, reorderLinks, personalData }: BusinessStep4Props) {
  const t = useTranslations('businessForm.links');
  const tPlatforms = useTranslations('businessForm.links.platforms');
  const SOCIAL_MEDIA_OPTIONS = getSocialMediaOptions(tPlatforms);

  const { watch, formState: { errors, isSubmitting } } = useFormContext<BusinessFormValues>();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(true);
  const [selectedLinkType, setSelectedLinkType] = useState<LinkItem['type'] | ''>('');
  const [showAddressModal, setShowAddressModal] = useState(false);

  const watchedLinks = watch('links');
  const links = React.useMemo(() => (watchedLinks || []) as LinkItem[], [watchedLinks]);
  const mobilePhone = watch('mobilePhone');
  const phone = watch('phone');
  const streetAddress = watch('streetAddress');
  const city = watch('city');
  const state = watch('state');
  const zipCode = watch('zipCode');
  const apartment = watch('apartment');
  const emailField = watch('email');

  const linkErrors = errors.links as unknown as
    | Array<{ url?: { message?: string }; value?: { message?: string } }>
    | undefined;

  const MAX_VISIBLE_LINKS = 7;
  const phoneNumber = mobilePhone || phone || personalData?.mobilePhone || personalData?.phone;

  // Auto-add phone number if available and not already added
  React.useEffect(() => {
    if (phoneNumber && !links.some(link => link.type === 'phone')) {
      const processed = processLinkValue('phone', phoneNumber);
      updateLink('phone', processed.processedUrl, processed.displayValue);
    }
  }, [phoneNumber, links, updateLink]);

  const getDisplayValue = (link: LinkItem): string => {
    if (link.type === 'location' && link.url) {
      try {
        const urlObj = new URL(link.url);
        const query = urlObj.searchParams.get('query');
        return query ? decodeURIComponent(query) : link.url;
      } catch {
        return link.url;
      }
    }

    return link.value || link.url || '';
  };

  const formatInputValue = (type: LinkItem['type'], value: string): string => {
    if (!value) return '';
    
    const option = SOCIAL_MEDIA_OPTIONS.find(opt => opt.key === type);
    if (!option) return value;
    
    // Strip @ symbol for platforms that use brand icons (instagram, facebook, linkedin, telegram)
    const brandIconPlatforms = ['instagram', 'facebook', 'linkedin', 'telegram'];
    if (brandIconPlatforms.includes(type)) {
      return value.replace(/^@/, '');
    }
    
    if (option.useAtSymbol) return value.replace(/^@/, '');
    if (option.useGlobeIcon) return value.replace(/^https?:\/\//, '').replace(/^www\./, '');
    
    // Specifically strip URL prefixes for Yelp and Nextdoor if they somehow made it into the display value
    if (type === 'yelp') return value.replace(/^(https?:\/\/)?(www\.)?yelp\.com\/biz\//, '');
    if (type === 'nextdoor') return value.replace(/^(https?:\/\/)?(www\.)?nextdoor\.com\/pages\//, '');
    
    return value;
  };

  const handleInputChange = (index: number, value: string) => {
    const link = links[index];
    if (!link) return;
    const processed = processLinkValue(link.type, value);
    updateLink(link.type, processed.processedUrl, processed.displayValue);
  };

  const handleLinkSelection = (linkKey: string) => {
    if (!linkKey) return;
    const linkType = linkKey as LinkItem['type'];
    if (showAddressModal) setShowAddressModal(false);

    const selectedOption = SOCIAL_MEDIA_OPTIONS.find(option => option.key === linkType);
    let rawValue = '';

    if ((linkType === 'phone' || linkType === 'whatsapp') && phoneNumber) {
      rawValue = phoneNumber;
    } else if (linkType === 'email' && emailField) {
      rawValue = emailField;
    } else if (selectedOption?.useAtSymbol) {
      rawValue = '@';
    } else if (selectedOption?.useGlobeIcon) {
      rawValue = 'https://';
    } else if (selectedOption?.useMapIcon) {
      const isAddressComplete = streetAddress && city && state && zipCode;
      if (!isAddressComplete) {
        setShowAddressModal(true);
        setSelectedLinkType('');
        return;
      }
      const addressParts = [streetAddress, apartment, city, state, zipCode, 'USA'].filter(Boolean);
      rawValue = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressParts.join(', '))}`;
    }

    const processed = processLinkValue(linkType, rawValue);
    updateLink(linkType, processed.processedUrl, processed.displayValue);
    setSelectedLinkType('');
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      reorderLinks(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleRemoveLink = (index: number) => {
    const linkToRemove = links[index];
    if (!linkToRemove) return;
    if (phoneNumber && linkToRemove.type === 'phone') {
      if (!links.some(link => link.type === 'whatsapp')) return;
    }
    updateLink(linkToRemove.type);
  };

  const hasPhoneLink = links.some(link => link.type === 'phone');
  const availableOptions = SOCIAL_MEDIA_OPTIONS.filter(option => {
    if (links.length >= 15) return false;
    if (option.key === 'phone' && (!phoneNumber || hasPhoneLink)) return false;
    return !links.some(link => link.type === option.key);
  });

  const sortedAvailableLinkTypes = availableOptions;

  return (
    <>
      <AddressRequiredModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />

      <div className="space-y-6 flex-1">
        <div className="border-2 border-black rounded-lg bg-white">
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="w-full flex items-center justify-between p-2 text-left bg-black text-white"
          >
            <label className="block text-base font-bold text-white">{t('instructionsTitle') || 'Link Ordering Instructions'}</label>
            {showExplanation ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
          </button>
          {showExplanation && (
            <div className="px-4 pb-4">
              <div className="bg-white rounded-lg mt-4 text-xs md:text-base text-red-500">
                <ul className="space-y-1 list-disc list-inside">
                  <li>{t('instructionsLine1') || 'Add and drag links to position them in the card'}</li>
                  <li>{t('instructionsLine2') || 'The first 7 links will be visible on your business card'}</li>
                  <li>{t('instructionsLine3') || 'Additional links will only be shown on your business detail page'}</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-[25%_75%] md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4 px-2 md:px-0">
          <div className="bg-black text-white font-semibold px-2 py-2 rounded-lg text-center truncate">{t('position')}</div>
          <div className="bg-black text-white font-semibold px-4 py-2 rounded-lg text-center">{t('links')}</div>
        </div>

        {links.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{t('noLinks')}</div>
        ) : (
          <div className="space-y-3 transition-all duration-300">
            {links.map((link, index) => {
              const isVisibleOnCard = index < MAX_VISIBLE_LINKS;
              const displayValue = getDisplayValue(link);
              const option = SOCIAL_MEDIA_OPTIONS.find(opt => opt.key === link.type);
              const canRemove = link.type !== 'phone';
              const labelForType = option?.label || link.type;
              
              return (
                <div
                  key={`${link.type}-${index}`}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`grid grid-cols-[25%_75%] md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4 items-center px-2 md:px-0 transition-all duration-300 ${
                    dragOverIndex === index && draggedIndex !== null && draggedIndex !== index
                      ? 'transform translate-y-2'
                      : ''
                  }`}
                >
                  <div className="flex justify-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${isVisibleOnCard ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {index + 1}
                    </div>
                  </div>

                  <div className={`border-2 border-black rounded-lg bg-white p-4 relative transition-all duration-300 ${
                    draggedIndex === index 
                      ? 'opacity-50 scale-95 rotate-1 shadow-lg' 
                      : draggedIndex !== null
                      ? 'opacity-100'
                      : 'opacity-100'
                  }`}>
                    {/* Highlight drop target */}
                    {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                      <div className="absolute inset-0 ring-2 ring-red-500 rounded-lg pointer-events-none animate-pulse" />
                    )}
                    {canRemove && (
                      <button type="button" onClick={() => handleRemoveLink(index)} className="absolute top-2 right-2 text-red-500 cursor-pointer transition-opacity duration-200 hover:opacity-70">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          draggable 
                          onDragStart={(e) => handleDragStart(e, index)} 
                          onDragEnd={() => setDraggedIndex(null)} 
                          className="cursor-move transition-transform duration-200 hover:scale-110 active:scale-95"
                        >
                          <GripVertical className="w-5 h-5 text-black transition-colors duration-200" />
                        </div>
                        {(() => {
                          // Map link types to brand icons
                          const brandIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
                            instagram: SiInstagram,
                            facebook: SiFacebook,
                            linkedin: SiLinkedin,
                            telegram: SiTelegram,
                            nextdoor: SiNextdoor,
                          };
                          
                          const Icon = 
                            option?.usePhoneIcon ? Phone :
                            option?.useWhatsAppIcon ? SiWhatsapp :
                            option?.useGlobeIcon ? Globe :
                            option?.useMapIcon ? MapPin :
                            option?.useStarIcon ? SiYelp :
                            option?.useHammerIcon ? AngiIcon :
                            brandIconMap[link.type] || (option?.useAtSymbol ? AtSign : Globe);
                          return <Icon className="w-4 h-4 text-red-500" />;
                        })()}
                        <div className="text-sm font-medium">
                          {labelForType}
                          {link.type === 'phone' && <span className="text-red-500">*</span>}
                        </div>
                      </div>
                      {link.type === 'location' ? (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 border rounded text-sm truncate">{displayValue}</div>
                      ) : (
                        <FormField
                          label=""
                          error={linkErrors?.[index]?.url?.message ?? linkErrors?.[index]?.value?.message}
                          className="[&>label]:hidden"
                        >
                          <Input
                            value={formatInputValue(link.type, displayValue)}
                            onChange={(e) => handleInputChange(index, e.target.value)}
                            onClear={canRemove ? () => handleRemoveLink(index) : undefined}
                            showClear={canRemove}
                            placeholder={option?.placeholder}
                            disabled={isSubmitting}
                            error={linkErrors?.[index]?.url?.message ?? linkErrors?.[index]?.value?.message}
                          />
                        </FormField>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            {t('addLinkLabel')} {links.length >= 15 && t('maxReached')}
          </label>
          <select
            value={selectedLinkType}
            onChange={(e) => handleLinkSelection(e.target.value)}
            className="w-full px-4 py-2 border-2 border-black rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={links.length >= 15}
          >
            <option value="">{links.length >= 15 ? t('maxLinksReached') : t('choosePlatform')}</option>
            {sortedAvailableLinkTypes.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
