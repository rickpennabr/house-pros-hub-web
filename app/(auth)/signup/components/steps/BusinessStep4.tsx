'use client';

import React, { useState, useEffect } from 'react';
import { GripVertical, X, ChevronDown, ChevronUp, Globe, Phone, MapPin, AtSign } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { BusinessFormState } from '../../hooks/useAddBusinessForm';
import { LinkItem } from '@/components/proscard/ProLinks';
import { processLinkValue } from '@/lib/utils/link-processor';
import { AddressRequiredModal } from '../AddressRequiredModal';

interface BusinessStep4Props {
  formState: BusinessFormState;
  updateLink: (type: LinkItem['type'], url?: string, value?: string) => void;
  reorderLinks: (fromIndex: number, toIndex: number) => void;
  personalData?: {
    phone?: string;
    mobilePhone?: string;
  };
  fieldErrors?: { [key: string]: string | undefined };
}

interface SocialMediaOption {
  key: LinkItem['type'];
  label: string;
  useAtSymbol?: boolean;
  usePhoneIcon?: boolean;
  useGlobeIcon?: boolean;
  useMapIcon?: boolean;
  placeholder?: string;
}

const SOCIAL_MEDIA_OPTIONS: SocialMediaOption[] = [
  { key: 'phone', label: 'Phone', usePhoneIcon: true }, // First - Required
  { key: 'location', label: 'Business Address', useMapIcon: true },
  { key: 'website', label: 'Website', useGlobeIcon: true, placeholder: 'website URL' },
  { key: 'instagram', label: 'Instagram', useAtSymbol: true },
  { key: 'facebook', label: 'Facebook', useAtSymbol: true },
  { key: 'x', label: 'X (Twitter)', useAtSymbol: true },
  { key: 'whatsapp', label: 'WhatsApp', usePhoneIcon: true },
  { key: 'youtube', label: 'YouTube', useAtSymbol: true },
  { key: 'tiktok', label: 'TikTok', useAtSymbol: true },
  { key: 'linkedin', label: 'LinkedIn', useAtSymbol: true },
  { key: 'snapchat', label: 'Snapchat', useAtSymbol: true },
  { key: 'pinterest', label: 'Pinterest', useAtSymbol: true },
  { key: 'telegram', label: 'Telegram', useAtSymbol: true },
  { key: 'discord', label: 'Discord', useAtSymbol: true },
  { key: 'email', label: 'Email' },
  { key: 'calendar', label: 'Schedule/Calendar' },
];

const linkLabels: Record<LinkItem['type'], string> = {
  website: 'Website',
  instagram: 'Instagram',
  facebook: 'Facebook',
  phone: 'Phone',
  email: 'Email',
  calendar: 'Schedule/Calendar',
  location: 'Location',
  x: 'X (Twitter)',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  snapchat: 'Snapchat',
  pinterest: 'Pinterest',
  telegram: 'Telegram',
  discord: 'Discord',
};

export function BusinessStep4({ formState, updateLink, reorderLinks, personalData }: BusinessStep4Props) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(true);
  const [selectedLinkType, setSelectedLinkType] = useState<LinkItem['type'] | ''>('');
  const [showAddressModal, setShowAddressModal] = useState(false);

  const MAX_VISIBLE_LINKS = 7;
  // Prefer mobile phone, fallback to land phone (from business form data, not personal)
  const phoneNumber = formState.mobilePhone || formState.phone;

  // Auto-add phone number if available and not already added (like reference component)
  React.useEffect(() => {
    if (phoneNumber && !formState.links.some(link => link.type === 'phone')) {
      const phoneValue = phoneNumber;
      updateLink('phone', undefined, phoneValue);
      console.log('📞 Auto-added phone number link:', phoneValue);
    }
  }, [phoneNumber, formState.links, updateLink]);

  const getLinkValue = (type: LinkItem['type']): string => {
    const link = formState.links.find(l => l.type === type);
    return link?.url || link?.value || '';
  };

  const formatInputValue = (type: LinkItem['type'], value: string): string => {
    if (!value) return '';

    // Use processLinkValue to get display value for editing
    const processed = processLinkValue(type, value);
    const displayValue = processed.displayValue;

    const option = SOCIAL_MEDIA_OPTIONS.find(opt => opt.key === type);
    if (!option) return displayValue;

    // For @ symbol types, remove @ prefix for editing
    if (option.useAtSymbol) {
      return displayValue.replace(/^@/, '');
    }

    // For website, remove https:// prefix for editing
    if (option.useGlobeIcon) {
      return displayValue.replace(/^https?:\/\//, '').replace(/^www\./, '');
    }

    return displayValue;
  };

  const handleInputChange = (index: number, value: string) => {
    const link = formState.links[index];
    if (!link) return;

    // Process the value using the link processor
    const processed = processLinkValue(link.type, value);
    
    // Update the link with processed URL and display value
    // Based on ProLinks usage:
    // - Phone/email: use value field with tel:/mailto: URL
    // - Other links: use url field with https:// URL, value for display
    if (link.type === 'phone' || link.type === 'email') {
      // Store tel:/mailto: URL in value field (as ProLinks expects)
      updateLink(link.type, undefined, processed.processedUrl);
    } else if (link.type === 'whatsapp') {
      // WhatsApp: store wa.me URL in url field, display value in value
      updateLink(link.type, processed.processedUrl, processed.displayValue);
    } else if (link.type === 'location') {
      // Location: store Google Maps URL in url field
      updateLink(link.type, processed.processedUrl, undefined);
    } else {
      // Social links: store processed URL in url, display value in value for UI
      updateLink(link.type, processed.processedUrl, processed.displayValue);
    }
    
    console.log(`✏️ Input change for ${link.type} at position ${index}: "${value}" -> URL: "${processed.processedUrl}", Display: "${processed.displayValue}"`);
  };

  const handleLinkSelection = (linkKey: LinkItem['type'] | '') => {
    if (!linkKey) return;

    // Type guard: after this check, linkKey is guaranteed to be LinkItem['type']
    const linkType: LinkItem['type'] = linkKey;

    // Clear address modal error when selecting a different link
    if (showAddressModal) {
      setShowAddressModal(false);
    }

    const selectedOption = SOCIAL_MEDIA_OPTIONS.find(option => option.key === linkType);
    let rawValue = '';

    // Set initial value based on link type (like reference component)
    if ((linkType === 'phone' || linkType === 'whatsapp') && phoneNumber) {
      rawValue = phoneNumber;
    } else if (linkType === 'email' && formState.email) {
      rawValue = formState.email;
    } else if (selectedOption?.useAtSymbol) {
      rawValue = '@';
    } else if (selectedOption?.useGlobeIcon) {
      rawValue = 'https://';
    } else if (selectedOption?.useMapIcon) {
      // Check if address is complete before generating Google Maps URL
      const isAddressComplete = formState.streetAddress && 
        formState.city && 
        formState.state && 
        formState.zipCode;
      
      if (!isAddressComplete) {
        setShowAddressModal(true);
        setSelectedLinkType('');
        return;
      }
      
      // Generate Google Maps URL for address link
      rawValue = addAddressLink();
      if (!rawValue) return; // If address link generation failed
    }

    // Process the value using link processor
    const processed = processLinkValue(linkType, rawValue);

    // Add the new link with processed values
    // Based on ProLinks usage:
    // - Phone/email: use value field with tel:/mailto: URL
    // - Other links: use url field with https:// URL, value for display
    if (linkType === 'phone' || linkType === 'email') {
      // Store tel:/mailto: URL in value field (as ProLinks expects)
      updateLink(linkType, undefined, processed.processedUrl);
    } else if (linkType === 'whatsapp') {
      // WhatsApp: store wa.me URL in url field, display value in value
      updateLink(linkType, processed.processedUrl, processed.displayValue);
    } else if (linkType === 'location') {
      // Location: store Google Maps URL in url field
      updateLink(linkType, processed.processedUrl, undefined);
    } else {
      // Social links: store processed URL in url, display value in value for UI
      updateLink(linkType, processed.processedUrl, processed.displayValue);
    }

    setSelectedLinkType('');
    console.log(`➕ Added new link: ${linkType} with raw: "${rawValue}" -> URL: "${processed.processedUrl}", Display: "${processed.displayValue}"`);
  };

  const getGoogleMapsUrl = (): string => {
    const addressParts = [
      formState.streetAddress,
      formState.apartment,
      formState.city,
      formState.state,
      formState.zipCode,
      'USA',
    ].filter(Boolean);

    const address = addressParts.join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  const addAddressLink = (): string => {
    const addressParts = [
      formState.streetAddress,
      formState.city,
      formState.state,
      formState.zipCode,
    ].filter(Boolean);

    if (addressParts.length < 3) {
      setShowAddressModal(true);
      return '';
    }

    return getGoogleMapsUrl();
  };

  // Helper to extract address from Google Maps URL (like reference)
  const getAddressFromGoogleMapsUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const query = urlObj.searchParams.get('query');
      if (query) {
        return decodeURIComponent(query);
      }
      return url;
    } catch {
      return url;
    }
  };

  const getDisplayValue = (link: LinkItem): string => {
    if (link.type === 'location' && link.url) {
      // Extract address from Google Maps URL
      return getAddressFromGoogleMapsUrl(link.url);
    }

    // For phone/email, the value field contains tel:/mailto: URL, extract display value
    if (link.type === 'phone' || link.type === 'email') {
      const rawValue = link.value || '';
      if (!rawValue) return '';
      const processed = processLinkValue(link.type, rawValue);
      return processed.displayValue;
    }

    // For other links, value field contains display value, url contains processed URL
    // If we have a stored display value, use it; otherwise process the URL
    if (link.value) {
      // We have a stored display value, use it for editing
      const option = SOCIAL_MEDIA_OPTIONS.find(opt => opt.key === link.type);
      if (option?.useAtSymbol) {
        return link.value.replace(/^@/, '');
      }
      if (option?.useGlobeIcon) {
        return link.value.replace(/^https?:\/\//, '').replace(/^www\./, '');
      }
      return link.value;
    }

    // Fallback: process the URL to get display value
    const rawValue = link.url || '';
    if (!rawValue) return '';
    const processed = processLinkValue(link.type, rawValue);
    const option = SOCIAL_MEDIA_OPTIONS.find(opt => opt.key === link.type);
    
    // For display in input, show without prefixes for editing
    if (option?.useAtSymbol && processed.displayValue) {
      return processed.displayValue.replace(/^@/, '');
    }
    
    if (option?.useGlobeIcon && processed.displayValue) {
      return processed.displayValue.replace(/^https?:\/\//, '').replace(/^www\./, '');
    }

    return processed.displayValue;
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

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      reorderLinks(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleRemoveLink = (index: number) => {
    const linkToRemove = formState.links[index];
    if (!linkToRemove) return;

    // Prevent removing the only phone number link if phone number is available (like reference)
    if (phoneNumber && linkToRemove.type === 'phone') {
      const hasWhatsAppLink = formState.links.some(link => link.type === 'whatsapp');
      if (!hasWhatsAppLink) {
        // Don't allow removing the only phone link
        console.log('📞 Cannot remove phone link - it is required');
        return;
      }
    }

    updateLink(linkToRemove.type);
    console.log(`🗑️ Removed link at position ${index}: ${linkToRemove.type}`);
  };

  // Get available options (exclude already added links and phone if no phone number) - like reference
  const hasPhone = formState.links.some(link => link.type === 'phone');
  const availableOptions = SOCIAL_MEDIA_OPTIONS.filter(option => {
    // Don't show phone option if no phone number is available
    if (option.key === 'phone' && !phoneNumber) {
      return false;
    }
    // Don't show phone option if phone link already exists (since it's auto-added)
    if (option.key === 'phone' && hasPhone) {
      return false;
    }
    // Don't show already added links
    return !formState.links.some(link => link.type === option.key);
  });

  // Ensure phone is first in the list if available
  const phoneOption = availableOptions.find(opt => opt.key === 'phone');
  const otherOptions = availableOptions.filter(opt => opt.key !== 'phone');
  const sortedAvailableLinkTypes = phoneOption 
    ? [phoneOption, ...otherOptions]
    : availableOptions;

  return (
    <>
      {/* Address Required Modal */}
      <AddressRequiredModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />

      <div className="space-y-6 flex-1">
        {/* Business Links Label with Integrated Explanation */}
        <div className="border-2 border-black rounded-lg bg-white">
          <button
            type="button"
            onClick={() => setShowExplanation(!showExplanation)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex flex-col items-start">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Links
              </label>
            </div>
            {showExplanation ? (
              <ChevronUp className="w-5 h-5 text-gray-600 shrink-0 ml-4" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600 shrink-0 ml-4" />
            )}
          </button>
          
          {showExplanation && (
            <div className="px-4 pb-4 border-t border-gray-200">
              <div className="bg-white border-2 border-gray-300 rounded-lg p-4 mt-4">
                <h4 className="text-sm font-medium text-gray-800 mb-2">Link Visibility:</h4>
                <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                  <li>The first {MAX_VISIBLE_LINKS} links will be visible on your business card</li>
                  <li>Additional links will only be shown on your business detail page</li>
                  <li>Add and reorder links for your business card by dragging</li>
                </ul>
              </div>
            </div>
          )}
        </div>

      {/* Column Headers */}
      <div className="flex gap-4">
        {/* Position Column Header */}
        <div className="bg-black text-white font-semibold px-4 py-2 rounded-lg w-20 flex items-center justify-center shrink-0">
          Position
        </div>
        
        {/* Business Links Column Header */}
        <div className="bg-black text-white font-semibold px-4 py-2 rounded-lg flex-1 text-center">
          Business Links
        </div>
      </div>

      {/* Existing links with drag and drop */}
      {formState.links.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No business links added yet.</p>
          <p className="text-sm">Select a business link below to get started.</p>
        </div>
      ) : (
        <div className={`mb-6 ${formState.links.length === MAX_VISIBLE_LINKS ? 'space-y-4' : 'space-y-3'}`}>
          {formState.links.map((link, index) => {
            const isVisibleOnCard = index < MAX_VISIBLE_LINKS;
            const displayValue = getDisplayValue(link);
            const option = SOCIAL_MEDIA_OPTIONS.find(opt => opt.key === link.type);
            const isPhone = link.type === 'phone';
            const hasWhatsApp = formState.links.some(l => l.type === 'whatsapp');
            const canRemove = !isPhone || hasWhatsApp;
            
            return (
              <div
                key={`${link.type}-${index}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDragOver(e, index);
                }}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                className="flex gap-4 items-center"
              >
                {/* Left Column: Position */}
                <div className="flex-shrink-0 w-20 flex items-center justify-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                    ${isVisibleOnCard ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}
                  `}>
                    {index + 1}
                  </div>
                </div>

                {/* Right Column: Link Card with its own border */}
                <div
                  className={`
                    flex-1 border-2 border-black rounded-lg bg-white p-4 relative
                    ${draggedIndex === index ? 'opacity-50 bg-yellow-50 shadow-lg' : ''}
                    ${dragOverIndex === index ? 'border-black bg-gray-50' : ''}
                  `}
                >
                  {/* Remove button - Top right corner */}
                  {canRemove ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(index)}
                      disabled={formState.isLoading}
                      className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded transition-colors z-10"
                      aria-label="Remove link"
                    >
                      <X className="w-5 h-5 text-red-500" />
                    </button>
                  ) : (
                    <div className="absolute top-2 right-2 p-1 z-10">
                      <X className="w-5 h-5 text-gray-300" />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {/* Drag handle */}
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      className="flex flex-col gap-0.5 cursor-grab active:cursor-grabbing touch-none"
                    >
                      <GripVertical className="w-5 h-5 text-gray-400" />
                    </div>

                    {/* Link info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-800">
                          {linkLabels[link.type] || link.type}
                        </span>
                        {isVisibleOnCard && (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded shrink-0">
                            Visible on card
                          </span>
                        )}
                        {isPhone && (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded shrink-0">
                            Required
                          </span>
                        )}
                      </div>
                      
                      {link.type === 'location' ? (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded cursor-default">
                          <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
                          <span className="text-sm text-gray-700 truncate flex-1">{displayValue}</span>
                        </div>
                      ) : (
                        <div className="relative">
                          {option?.useAtSymbol && (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <AtSign className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          {option?.usePhoneIcon && (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <Phone className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          {option?.useGlobeIcon && (
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                              <Globe className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <Input
                            id={`link-${link.type}-${index}`}
                            type={link.type === 'email' ? 'email' : 'text'}
                            value={formatInputValue(link.type, displayValue)}
                            onChange={(e) => handleInputChange(index, e.target.value)}
                            onClear={canRemove ? () => handleRemoveLink(index) : undefined}
                            showClear={canRemove}
                            placeholder={
                              option?.placeholder || 
                              (link.type === 'website' ? 'website URL' :
                               link.type === 'phone' || link.type === 'whatsapp' ? 'Phone number' :
                               link.type === 'email' ? 'Email address' :
                               option?.useAtSymbol ? 'Enter User name' :
                               'Enter value')
                            }
                            disabled={formState.isLoading}
                            className={`cursor-text ${option?.useAtSymbol || option?.usePhoneIcon || option?.useGlobeIcon ? 'pl-10' : ''}`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

        {/* Add new link section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Business Website
            </label>
          </div>

          <div className="relative">
          <select
            value={selectedLinkType}
            onChange={(e) => {
              const newType = e.target.value as LinkItem['type'] | '';
              setSelectedLinkType(newType);
              if (newType) {
                // Automatically add the link when a platform is selected (like reference)
                handleLinkSelection(newType);
              }
            }}
            disabled={formState.isLoading || sortedAvailableLinkTypes.length === 0}
            className="w-full px-4 py-2 border-2 border-black rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Choose a social media platform...</option>
            {sortedAvailableLinkTypes.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label} {option.key === 'phone' && !hasPhone ? '(Required)' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
      </div>
    </div>
    </>
  );
}
