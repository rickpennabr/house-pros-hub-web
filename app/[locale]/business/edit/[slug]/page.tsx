'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, ChevronUp, Building2, Trash2, Globe, X, MessageCircle, Star, Home, Hammer, GripVertical, Phone, MapPin, AtSign, PenTool, Settings, FileText } from 'lucide-react';
import { SiNextdoor, SiWhatsapp, SiYelp, SiInstagram, SiFacebook, SiLinkedin, SiTelegram } from 'react-icons/si';
import { AngiIcon } from '@/components/ui/icons/AngiIcon';

import { businessSchema, type BusinessFormValues } from '@/lib/schemas/business';
import { businessStorage } from '@/lib/storage/businessStorage';
import { transformBusinessToProCardData } from '@/lib/utils/businessTransform';
import { normalizeLinks } from '@/lib/utils/normalizeLinks';
import { useAuth } from '@/contexts/AuthContext';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import AddressAutocomplete, { AddressData } from '@/components/AddressAutocomplete';
import { RESIDENTIAL_CONTRACTOR_LICENSES } from '@/lib/constants/contractorLicenses';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import { processLinkValue } from '@/lib/utils/link-processor';
import { LinkItem } from '@/components/proscard/ProLinks';
import { AddressRequiredModal } from '@/app/[locale]/(auth)/signup/components/AddressRequiredModal';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { createSignInUrl } from '@/lib/redirect';
import type { Locale } from '@/i18n';

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

const SOCIAL_MEDIA_OPTIONS: SocialMediaOption[] = [
  { key: 'phone', label: 'Phone', usePhoneIcon: true, placeholder: 'Phone number' },
  { key: 'location', label: 'Business Address', useMapIcon: true, placeholder: 'Business address' },
  { key: 'website', label: 'Website', useGlobeIcon: true, placeholder: 'website URL' },
  { key: 'instagram', label: 'Instagram', useAtSymbol: true, placeholder: 'Enter User Name' },
  { key: 'facebook', label: 'Facebook', useAtSymbol: true, placeholder: 'Enter User Name' },
  { key: 'whatsapp', label: 'WhatsApp', useWhatsAppIcon: true, placeholder: 'WhatsApp number' },
  { key: 'yelp', label: 'Yelp', useStarIcon: true, placeholder: 'Enter User Name' },
  { key: 'nextdoor', label: 'Nextdoor', useHomeIcon: true, placeholder: 'Enter User Name' },
  { key: 'angi', label: 'Angi', useHammerIcon: true, placeholder: 'Enter User Name' },
  { key: 'youtube', label: 'YouTube', useAtSymbol: true, placeholder: 'Enter User Name' },
  { key: 'tiktok', label: 'TikTok', useAtSymbol: true, placeholder: 'Enter User Name' },
  { key: 'linkedin', label: 'LinkedIn', useAtSymbol: true, placeholder: 'Enter User Name' },
  { key: 'telegram', label: 'Telegram', useAtSymbol: true, placeholder: 'Enter User Name' },
  { key: 'email', label: 'Email', placeholder: 'Email address' },
  { key: 'calendar', label: 'Schedule/Calendar', placeholder: 'Calendar URL' },
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
  telegram: 'Telegram',
  discord: 'Discord',
  yelp: 'Yelp',
  nextdoor: 'Nextdoor',
  angi: 'Angi',
};

export default function EditBusinessPage() {
  const router = useRouter();
  const params = useParams();
  const locale = useLocale() as Locale;
  const tSearch = useTranslations('common.search');
  const tBusinessForm = useTranslations('businessForm');
  const slug = params.slug as string;
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const [isBusinessInfoOpen, setIsBusinessInfoOpen] = useState(true);
  const [isAddressInfoOpen, setIsAddressInfoOpen] = useState(false);
  const [isContactInfoOpen, setIsContactInfoOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [previewBg, setPreviewBg] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedLinkType, setSelectedLinkType] = useState<LinkItem['type'] | ''>('');
  const [showAddressModal, setShowAddressModal] = useState(false);

  // We still need the internal business ID for updates
  const [businessId, setBusinessId] = useState<string | null>(null);
  // Track logo URL attempts for fallback
  const [logoUrlAttempts, setLogoUrlAttempts] = useState<Set<string>>(new Set());

  const methods = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      businessName: '',
      slug: '',
      businessLogo: '',
      businessBackground: '',
      licenses: [{ license: '', licenseNumber: '' }],
      streetAddress: '',
      city: '',
      state: 'NV',
      zipCode: '',
      apartment: '',
      address: '',
      email: '',
      phone: '',
      mobilePhone: '',
      links: [],
    },
  });

  const { register, control, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = methods;

  const licenseErrors = errors.licenses as unknown as
    | Array<{
        license?: { message?: string; type?: string };
        licenseNumber?: { message?: string; type?: string };
      }>
    | undefined;

  const linkErrors = errors.links as unknown as
    | Array<{ url?: { message?: string }; value?: { message?: string } }>
    | undefined;

  const { fields: licenseFields, prepend: prependLicense, remove: removeLicense } = useFieldArray({
    control,
    name: 'licenses',
  });

  const { append: appendLink, remove: removeLink, move: moveLink } = useFieldArray({
    control,
    name: 'links',
  });

  const watchedLinks = watch('links');
  const links = useMemo(() => watchedLinks ?? [], [watchedLinks]);
  const mobilePhone = watch('mobilePhone');
  const phone = watch('phone');
  const streetAddress = watch('streetAddress');
  const city = watch('city');
  const state = watch('state');
  const zipCode = watch('zipCode');
  const apartment = watch('apartment');
  const emailField = watch('email');
  const MAX_VISIBLE_LINKS = 7;
  const phoneNumber = mobilePhone || phone;

  // Track if data has been loaded to prevent auto-add during initial load
  const [dataLoaded, setDataLoaded] = useState(false);

  // Auto-add phone number if available and not already added (only after data is loaded)
  useEffect(() => {
    if (dataLoaded && phoneNumber && !links.some(link => link.type === 'phone')) {
      const processed = processLinkValue('phone', phoneNumber);
      const currentLinks = links;
      const existingIndex = currentLinks.findIndex(link => link.type === 'phone');
      
      if (existingIndex >= 0) {
        setValue(`links.${existingIndex}.url`, processed.processedUrl);
        setValue(`links.${existingIndex}.value`, processed.displayValue);
      } else {
        appendLink({ type: 'phone', url: processed.processedUrl, value: processed.displayValue });
      }
    }
  }, [dataLoaded, phoneNumber, links, setValue, appendLink]); // Only run when phoneNumber changes or links array changes

  const updateLink = (type: LinkItem['type'], url?: string, value?: string) => {
    const currentLinks = watch('links') || [];
    const newLinks = [...currentLinks];
    const existingIndex = newLinks.findIndex(link => link.type === type);
    
    // If no values provided and it exists, it's a removal request
    if (existingIndex >= 0 && url === undefined && value === undefined) {
      newLinks.splice(existingIndex, 1);
      setValue('links', newLinks, { shouldValidate: true });
      return;
    }

    const linkData = { 
      type, 
      url: url || '', 
      value: value || '' 
    };

    if (existingIndex >= 0) {
      setValue(`links.${existingIndex}.type`, type);
      setValue(`links.${existingIndex}.url`, linkData.url);
      setValue(`links.${existingIndex}.value`, linkData.value);
    } else {
      // Limit to 15 links
      if (newLinks.length < 15) {
        appendLink(linkData);
      }
    }
  };

  const reorderLinks = (fromIndex: number, toIndex: number) => {
    moveLink(fromIndex, toIndex);
  };

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
    
    if (option.useAtSymbol) return value.replace(/^@/, '');
    if (option.useGlobeIcon) return value.replace(/^https?:\/\//, '').replace(/^www\./, '');
    
    if (type === 'yelp') return value.replace(/^(https?:\/\/)?(www\.)?yelp\.com\/biz\//, '');
    if (type === 'nextdoor') return value.replace(/^(https?:\/\/)?(www\.)?nextdoor\.com\/pages\//, '');
    
    return value;
  };

  const handleInputChange = (index: number, value: string) => {
    const link = links[index];
    if (!link) return;
    const processed = processLinkValue(link.type, value);
    setValue(`links.${index}.url`, processed.processedUrl);
    setValue(`links.${index}.value`, processed.displayValue);
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
    removeLink(index);
  };

  const hasPhoneLink = links.some(link => link.type === 'phone');
  const availableOptions = SOCIAL_MEDIA_OPTIONS.filter(option => {
    if (links.length >= 15) return false;
    if (option.key === 'phone' && (!phoneNumber || hasPhoneLink)) return false;
    return !links.some(link => link.type === option.key);
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push(createSignInUrl(locale, `/business/edit/${slug}`));
    }
  }, [isAuthenticated, isAuthLoading, router, slug, locale]);

  // Load business data - fetch from API first to get latest data including images
  useEffect(() => {
    if (!slug) return;

    const loadBusinessData = async () => {
      try {
        // First, try to fetch from API (database) to get latest data including images
        let business: any = null;
        
        try {
          const response = await fetch(`/api/businesses/${slug}`, {
            method: 'GET',
            credentials: 'include',
          });
          
          if (response.ok) {
            const result = await response.json();
            business = result.business;
            
            // Update localStorage with fresh data from database
            if (business && business.id) {
              // Check if business exists in storage
              const existingBusiness = businessStorage.getBusinessBySlug(slug);
              const userId = (existingBusiness as any)?.userId || (business as any)?.userId;
              if (existingBusiness) {
                // Update existing business with fresh data
                businessStorage.updateBusiness(business.id, {
                  ...business,
                  userId: userId, // Preserve userId
                });
              } else {
                // Add new business to storage
                businessStorage.addBusiness({
                  ...business,
                  userId: userId || '',
                });
              }
            }
          } else {
            // Log the error response for debugging
            const errorData = await response.json().catch(() => ({}));
            console.warn(`[Business Edit] API returned ${response.status}:`, errorData);
            console.warn(`[Business Edit] Attempted to fetch business with slug:`, slug);
          }
        } catch (apiError) {
          console.error('[Business Edit] Error fetching business from API:', apiError);
          // Fall back to localStorage
        }
        
        // Fallback to localStorage if API fetch failed or returned no data
        if (!business) {
          console.warn('[Business Edit] Business not found in API, trying localStorage...');
          business = businessStorage.getBusinessBySlug(slug);
          
          if (business) {
            console.log('[Business Edit] Found business in localStorage:', business.id);
            // Try to fetch from API using the business ID instead of slug
            if (business.id) {
              try {
                const idResponse = await fetch(`/api/businesses/${business.id}`, {
                  method: 'GET',
                  credentials: 'include',
                });
                
                if (idResponse.ok) {
                  const idResult = await idResponse.json();
                  const dbBusiness = idResult.business;
                  if (dbBusiness) {
                    console.log('[Business Edit] Found business in database by ID, using fresh data');
                    business = dbBusiness;
                    // Update localStorage with fresh data
                    const existingBusinessInStorage = businessStorage.getBusinessBySlug(slug);
                    const existingUserId = (existingBusinessInStorage as any)?.userId || (business as any)?.userId;
                    businessStorage.updateBusiness(business.id, {
                      ...business,
                      userId: existingUserId || '',
                    });
                  }
                }
              } catch (idError) {
                console.warn('[Business Edit] Could not fetch by ID, using localStorage data:', idError);
              }
            }
          }
        }
        
        if (business) {
          setBusinessId(business.id);
          // Map stored data back to BusinessFormValues
          const mappedLicenses =
            business.licenses?.map((license: any) => ({
              license: license.license,
              licenseNumber: license.licenseNumber,
            })) ?? [{ license: '', licenseNumber: '' }];

          const formData: BusinessFormValues = {
            businessName: business.businessName || '',
            slug: business.slug || '',
            companyDescription: business.companyDescription || '',
            businessLogo: business.businessLogo || business.logo || '',
            businessBackground: business.businessBackground || '',
            licenses: mappedLicenses,
            streetAddress: business.streetAddress || '',
            city: business.city || '',
            state: business.state || 'NV',
            zipCode: business.zipCode || '',
            apartment: business.apartment || '',
            address: business.address || business.streetAddress || '',
            email: business.email || '',
            phone: business.phone || '',
            mobilePhone: business.mobilePhone || '',
            links: normalizeLinks(business.links),
          };
          
          reset(formData);
          // Set preview images - use URLs from database as-is
          // Don't normalize - the database already has the correct URLs
          // The fallback mechanism in the Image component will handle any edge cases
          const logoUrl = business.businessLogo || business.logo || null;
          const bgUrl = business.businessBackground || null;
          
          // Log image URLs for debugging
          console.log('[Business Edit] Business loaded:', {
            id: business.id,
            slug: business.slug,
            logoUrl,
            bgUrl,
            source: (business as any).userId ? 'database' : 'localStorage'
          });
          
          setPreviewLogo(logoUrl);
          setPreviewBg(bgUrl);
          setDataLoaded(true);
        } else {
          console.error('[Business Edit] Business not found in API or localStorage');
          setErrorMessage('Business not found. Please check the URL or try refreshing the page.');
          setDataLoaded(true);
        }
      } catch (error) {
        console.error('Error loading business data:', error);
        setErrorMessage('Failed to load business data');
        setDataLoaded(true);
      }
    };

    loadBusinessData();
  }, [slug, reset]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select an image file');
      return;
    }

    if (!businessId) {
      setErrorMessage('Business ID is required. Please wait for the page to finish loading.');
      console.error('[Business Edit] Cannot upload logo: businessId is null');
      return;
    }

    console.log('[Business Edit] Starting logo upload:', { businessId, fileName: file.name, fileSize: file.size });

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewLogo(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Resize and upload to storage
    try {
      const { resizeImage, base64ToFile } = await import('@/lib/utils/image');
      
      // Resize image first
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const resizedBase64 = await resizeImage(base64, 200, 200, 0.7);
      setPreviewLogo(resizedBase64);

      // Convert base64 to File for upload
      const resizedFile = base64ToFile(resizedBase64, file.name);

      // Upload to storage
      const formDataObj = new FormData();
      formDataObj.append('file', resizedFile);
      formDataObj.append('businessId', businessId);

      const response = await fetch('/api/storage/upload-business-logo', {
        method: 'POST',
        body: formDataObj,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const result = await response.json();

      // Delete old logo if it exists and is from storage
      const oldLogo = watch('businessLogo');
      if (oldLogo && 
          oldLogo.startsWith('http') && 
          oldLogo.includes('business-logos')) {
        try {
          await fetch(`/api/storage/delete?bucket=business-logos&path=${encodeURIComponent(oldLogo)}`, {
            method: 'DELETE',
          });
        } catch (deleteError) {
          console.warn('Failed to delete old logo:', deleteError);
        }
      }

      // Store the URL instead of base64
      setValue('businessLogo', result.url);
      // Update preview to show the uploaded URL (not base64)
      setPreviewLogo(result.url);
      setErrorMessage(''); // Clear any previous errors
      console.log('[Business Edit] Logo uploaded successfully:', result.url);
    } catch (error) {
      console.error('Error uploading logo:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to upload logo');
      setPreviewLogo(null);
    }
  };

  const handleRemoveLogo = () => {
    setPreviewLogo(null);
    setValue('businessLogo', '');
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleBgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select an image file');
      return;
    }

    if (!businessId) {
      setErrorMessage('Business ID is required');
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewBg(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Resize and upload to storage
    try {
      const { resizeImage, base64ToFile } = await import('@/lib/utils/image');
      
      // Resize image first
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const resizedBase64 = await resizeImage(base64, 800, 400, 0.6);
      setPreviewBg(resizedBase64);

      // Convert base64 to File for upload
      const resizedFile = base64ToFile(resizedBase64, file.name);

      // Upload to storage
      const formDataObj = new FormData();
      formDataObj.append('file', resizedFile);
      formDataObj.append('businessId', businessId);

      const response = await fetch('/api/storage/upload-business-background', {
        method: 'POST',
        body: formDataObj,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const result = await response.json();

      // Store the URL instead of base64
      setValue('businessBackground', result.url);
    } catch (error) {
      console.error('Error uploading background:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to upload background');
      setPreviewBg(null);
    }
  };

  const handleRemoveBg = () => {
    setPreviewBg(null);
    setValue('businessBackground', '');
    if (bgInputRef.current) {
      bgInputRef.current.value = '';
    }
  };

  const handleAddressSelect = (addressData: AddressData) => {
    setValue('address', addressData.fullAddress);
    setValue('streetAddress', addressData.streetAddress);
    setValue('city', addressData.city);
    setValue('state', addressData.state);
    setValue('zipCode', addressData.zipCode);
  };

  const onSubmit = async (data: BusinessFormValues) => {
    try {
      if (!businessId) {
        setErrorMessage('Business ID missing');
        return;
      }

      setErrorMessage('');
      setSuccessMessage('');
      
      // Use the latest data from storage to preserve fields not in the form (like reactions)
      const businesses = businessStorage.getAllBusinesses();
      const existingBusiness = businesses.find(b => b.id === businessId);
      
      if (!existingBusiness) {
        setErrorMessage('Business not found in storage');
        return;
      }

      const userId = ('userId' in existingBusiness ? (existingBusiness as { userId?: string }).userId : undefined) ?? user?.id;
      if (!userId) {
        setErrorMessage('User ID missing');
        return;
      }

      const links = normalizeLinks(data.links);

      const transformedData = transformBusinessToProCardData({
        ...data,
        id: businessId,
        userId,
        links,
      });

      // Merge transformed data with raw form data to ensure all fields are saved
      // This ensures both UI-specific fields (logo, contractorType) and 
      // form-specific fields (businessLogo, streetAddress, etc.) are in sync
      const finalUpdate = {
        ...existingBusiness,
        ...data,
        ...transformedData,
      };

      // Ensure slug is nice - if it's currently an ID or missing, use the new generated one
      if (!finalUpdate.slug || finalUpdate.slug.startsWith('business_')) {
        finalUpdate.slug = transformedData.slug || data.slug;
      }

      // Get CSRF token for authenticated request
      let csrfToken: string;
      try {
        console.log('[Business Edit] Requesting CSRF token for userId:', userId);
        
        const csrfResponse = await fetch('/api/csrf-token', {
          method: 'GET',
          credentials: 'include',
        });
        
        if (!csrfResponse.ok) {
          const errorText = await csrfResponse.text();
          console.error('[Business Edit] CSRF token request failed:', {
            status: csrfResponse.status,
            statusText: csrfResponse.statusText,
            error: errorText,
          });
          throw new Error('Failed to get CSRF token');
        }
        
        const csrfData = await csrfResponse.json();
        csrfToken = csrfData.csrfToken;
        
        console.log('[Business Edit] CSRF token received:', {
          tokenLength: csrfToken.length,
          tokenPrefix: csrfToken.substring(0, 10) + '...',
          userId: userId,
        });
      } catch (csrfError) {
        console.error('[Business Edit] Error getting CSRF token:', csrfError);
        throw new Error('Failed to get security token. Please refresh the page and try again.');
      }

      // Update business in database via API
      console.log('[Business Edit] About to send PUT request:', {
        url: `/api/businesses/${businessId}`,
        hasToken: !!csrfToken,
        userId: userId,
        credentials: 'include',
      });

      const updateResponse = await fetch(`/api/businesses/${businessId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          businessName: data.businessName,
          slug: finalUpdate.slug,
          businessLogo: data.businessLogo || undefined,
          businessBackground: data.businessBackground || undefined,
          companyDescription: data.companyDescription || undefined,
          email: data.email || undefined,
          phone: data.phone || undefined,
          mobilePhone: data.mobilePhone || undefined,
          links: links,
          streetAddress: data.streetAddress || undefined,
          apartment: data.apartment || undefined,
          city: data.city || undefined,
          state: data.state || undefined,
          zipCode: data.zipCode || undefined,
          licenses: data.licenses || undefined,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({ error: 'Failed to update business' }));
        throw new Error(errorData.error || 'Failed to update business in database');
      }

      const updateResult = await updateResponse.json();
      
      // Update localStorage with the response from API (which has the latest data)
      if (updateResult.business) {
        businessStorage.updateBusiness(businessId, {
          ...finalUpdate,
          ...updateResult.business,
        });
      } else {
        businessStorage.updateBusiness(businessId, finalUpdate);
      }

      setSuccessMessage('Business updated successfully!');
      
      // Collapse all accordions after successful save so user can see the confirmation message
      setIsBusinessInfoOpen(false);
      setIsAddressInfoOpen(false);
      setIsContactInfoOpen(false);
      setIsLinksOpen(false);
      
      // Scroll to top to show success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error updating business:', error);
      setErrorMessage('Failed to update business');
    }
  };

  if (isAuthLoading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-2 md:p-6 py-2 md:py-4">
      {/* Breadcrumbs */}
      <Breadcrumb 
        items={[
          { label: 'Account Management', href: '/account-management', icon: Settings },
          { label: 'Edit Business', icon: PenTool }
        ]}
      />
      
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Success/Error Messages */}
            {successMessage && (
              <div className="bg-green-50 border-2 border-green-600 text-green-800 rounded-lg p-4">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="bg-red-50 border-2 border-red-600 text-red-800 rounded-lg p-4">
                {errorMessage}
              </div>
            )}

            {/* Business Information */}
            <div className="border-2 border-black rounded-lg bg-white">
              <button
                type="button"
                onClick={() => {
                  const newValue = !isBusinessInfoOpen;
                  setIsBusinessInfoOpen(newValue);
                  if (newValue) {
                    setIsAddressInfoOpen(false);
                    setIsContactInfoOpen(false);
                    setIsLinksOpen(false);
                  }
                }}
                className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
              >
                <h2 className="text-xl font-bold text-black">{tBusinessForm('stepLabels.businessInformation')}</h2>
                {isBusinessInfoOpen ? (
                  <ChevronUp className="w-5 h-5 text-black shrink-0 ml-4" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-black shrink-0 ml-4" />
                )}
              </button>
              
              {isBusinessInfoOpen && (
                <div className="px-4 pb-4 border-t-2 border-black space-y-6 pt-6">
                  {/* Profile Preview Section (Logo & Background) */}
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-black uppercase tracking-wider">Business Brand</label>
                    <div className="relative w-full h-[200px] md:h-[300px] lg:h-[350px] group">
                      {/* Background Container with Overflow Hidden */}
                      <div className="absolute inset-0 rounded-lg border-2 border-black bg-white overflow-hidden">
                        {/* Background Image (if exists) */}
                        {previewBg && (
                          <div className="absolute inset-0 w-full h-full pointer-events-none">
                            <Image
                              src={previewBg}
                              alt="Background preview"
                              fill
                              sizes="(max-width: 768px) 100vw, 800px"
                              className="object-cover object-center"
                              unoptimized
                              onError={(e) => {
                                console.error('[Business Edit] Error loading background image:', previewBg);
                                console.error('[Business Edit] Error details:', e);
                              }}
                              onLoad={() => {
                                console.log('[Business Edit] Background image loaded successfully:', previewBg);
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Background Upload/Click Area - Always covers full area */}
                        <div 
                          onClick={() => bgInputRef.current?.click()}
                          className="absolute inset-0 w-full h-full cursor-pointer hover:bg-gray-50/30 transition-colors z-20"
                        >
                          {!previewBg && (
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-1">
                              <Building2 className="w-8 h-8 opacity-20" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Click to upload background</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Background Remove Control */}
                        {previewBg && (
                          <div className="absolute top-2 right-2 flex gap-2 z-30">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveBg();
                              }}
                              className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md cursor-pointer"
                              title="Remove background"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Logo Upload/Preview (Overlapping Bottom Center) */}
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20">
                        <div 
                          onClick={() => logoInputRef.current?.click()}
                          className="w-24 h-24 rounded-lg border-4 border-white bg-white shadow-xl overflow-hidden flex items-center justify-center cursor-pointer group-hover:scale-105 transition-transform relative"
                        >
                          {previewLogo ? (
                            <Image
                              src={previewLogo}
                              alt="Logo preview"
                              fill
                              className="object-contain"
                              sizes="96px"
                              unoptimized
                              onError={(e) => {
                                console.error('[Business Edit] Error loading logo image:', previewLogo);
                                
                                // Track this attempt
                                const attempts = new Set(logoUrlAttempts);
                                attempts.add(previewLogo);
                                setLogoUrlAttempts(attempts);
                                
                                // Try alternative path with duplicate bucket name (for old uploads)
                                if (previewLogo && 
                                    previewLogo.includes('/business-logos/') && 
                                    !previewLogo.includes('/business-logos/business-logos/') &&
                                    !attempts.has(previewLogo.replace('/business-logos/', '/business-logos/business-logos/'))) {
                                  const altPath = previewLogo.replace('/business-logos/', '/business-logos/business-logos/');
                                  console.log('[Business Edit] Trying alternative path with duplicate bucket name:', altPath);
                                  setPreviewLogo(altPath);
                                } else if (previewLogo && 
                                           previewLogo.includes('/business-logos/business-logos/') &&
                                           !attempts.has(previewLogo.replace('/business-logos/business-logos/', '/business-logos/'))) {
                                  // Try normalized path (remove duplicate)
                                  const normalizedPath = previewLogo.replace('/business-logos/business-logos/', '/business-logos/');
                                  console.log('[Business Edit] Trying normalized path (removing duplicate):', normalizedPath);
                                  setPreviewLogo(normalizedPath);
                                } else {
                                  console.error('[Business Edit] All logo URL attempts failed. Clearing preview.');
                                  // If all paths fail, clear the preview and show placeholder
                                  setPreviewLogo(null);
                                  setValue('businessLogo', '');
                                }
                              }}
                              onLoad={() => {
                                console.log('[Business Edit] Logo image loaded successfully:', previewLogo);
                                // Clear attempts on success
                                setLogoUrlAttempts(new Set());
                                
                                // If we loaded using the alternative path (with duplicate bucket name),
                                // update the form value and potentially the database to use the correct URL
                                if (previewLogo && previewLogo.includes('/business-logos/business-logos/')) {
                                  console.log('[Business Edit] Logo loaded from alternative path. Updating form value to correct URL.');
                                  setValue('businessLogo', previewLogo);
                                  // Note: The database will be updated when the form is saved
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white gap-1 p-2">
                              <Building2 className="w-6 h-6" />
                              <span className="text-[8px] font-bold uppercase text-center">Upload Logo</span>
                            </div>
                          )}
                        </div>
                        {previewLogo && typeof previewLogo === 'string' && previewLogo.trim() !== '' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveLogo();
                            }}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 border-2 border-white flex items-center justify-center cursor-pointer hover:bg-red-700 transition-colors shadow-lg z-30"
                            aria-label="Remove business logo"
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Hidden File Inputs */}
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                    <input
                      ref={bgInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleBgChange}
                      className="hidden"
                    />
                  </div>

                  <FormField label="Business Name" required error={errors.businessName?.message}>
                    <Input
                      {...register('businessName')}
                      value={watch('businessName') || ''}
                      onClear={() => setValue('businessName', '')}
                      showClear
                      placeholder="Enter business name"
                      disabled={isSubmitting}
                      error={errors.businessName?.message}
                    />
                  </FormField>

                  {/* Licenses */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700">
                          Contractor Licenses <span className="text-red-500">*</span>
                        </label>
                        <span className="text-xs text-gray-500">
                          Add and drag licenses to display them in the order you want
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => prependLicense({ license: '', licenseNumber: '' })}
                        className="px-3 py-1.5 text-sm border-2 border-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        disabled={isSubmitting}
                      >
                        + Add License
                      </button>
                    </div>

                    {/* Header Row */}
                    <div className="grid grid-cols-[25%_75%] md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4 pr-2 md:pr-0">
                      <div className="bg-black text-white font-semibold px-2 py-2 rounded-lg text-center truncate">Position</div>
                      <div className="bg-black text-white font-semibold px-4 py-2 rounded-lg text-center">License</div>
                    </div>

                    {licenseFields.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">No licenses added yet.</div>
                    ) : (
                      <div className="space-y-3 transition-all duration-300">
                        {licenseFields.map((field, index) => {
                          const currentLicenses = watch('licenses') || [];
                          return (
                            <div
                              key={field.id}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = 'move';
                                setDragOverIndex(index);
                              }}
                              onDragLeave={() => setDragOverIndex(null)}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedIndex !== null && draggedIndex !== index) {
                                  const newLicenses = [...currentLicenses];
                                  const [movedLicense] = newLicenses.splice(draggedIndex, 1);
                                  newLicenses.splice(index, 0, movedLicense);
                                  setValue('licenses', newLicenses);
                                }
                                setDraggedIndex(null);
                                setDragOverIndex(null);
                              }}
                              className={`grid grid-cols-[25%_75%] md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4 items-center pr-2 md:pr-0 transition-all duration-300 ${
                                dragOverIndex === index && draggedIndex !== null && draggedIndex !== index
                                  ? 'transform translate-y-2'
                                  : ''
                              }`}
                            >
                              {/* Position Number */}
                              <div className="flex justify-center">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-black text-white transition-all duration-300">
                                  {index + 1}
                                </div>
                              </div>

                              {/* License Card */}
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
                                {licenseFields.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeLicense(index)}
                                    className="absolute top-2 right-2 text-red-500 cursor-pointer transition-opacity duration-200 hover:opacity-70"
                                    disabled={isSubmitting}
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                )}
                                
                                {/* Header with License label and icon */}
                                <div className="flex items-center gap-1 mb-4">
                                  {licenseFields.length > 1 && (
                                    <div 
                                      draggable 
                                      onDragStart={(e) => {
                                        setDraggedIndex(index);
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('text/html', '');
                                      }} 
                                      onDragEnd={() => setDraggedIndex(null)} 
                                      className="-ml-1 cursor-move transition-transform duration-200 hover:scale-110 active:scale-95"
                                    >
                                      <GripVertical className="w-5 h-5 text-black transition-colors duration-200" />
                                    </div>
                                  )}
                                  <FileText className="w-4 h-4 text-red-500" />
                                  <div className="text-sm font-medium">License</div>
                                </div>

                                {/* Form Fields */}
                                <div className="space-y-3">
                                  <FormField
                                    label="License Classification"
                                    required
                                    error={licenseErrors?.[index]?.license?.message}
                                  >
                                    <select
                                      {...register(`licenses.${index}.license` as FieldPath<BusinessFormValues>)}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const isDuplicate = currentLicenses.some((l, i) => i !== index && l.license === val && val.trim() !== '');
                                        
                                        if (val && isDuplicate) {
                                          methods.setError(`licenses.${index}.license` as FieldPath<BusinessFormValues>, {
                                            type: 'manual',
                                            message: 'This license classification has already been added'
                                          });
                                          setValue(`licenses.${index}.license` as FieldPath<BusinessFormValues>, '');
                                        } else {
                                          setValue(`licenses.${index}.license` as FieldPath<BusinessFormValues>, val);
                                          if (licenseErrors?.[index]?.license?.type === 'manual') {
                                            methods.clearErrors(`licenses.${index}.license` as FieldPath<BusinessFormValues>);
                                          }
                                        }
                                      }}
                                      required
                                      className={`w-full px-2 py-3 border-2 rounded-lg bg-white focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                        licenseErrors?.[index]?.license
                                          ? 'border-red-500 focus:border-red-500'
                                          : 'border-black'
                                      }`}
                                      disabled={isSubmitting}
                                      value={watch(`licenses.${index}.license`) || ''}
                                    >
                                      <option value="">Select classification</option>
                                      <option value="GENERAL">GENERAL - General Contractor License</option>
                                      {RESIDENTIAL_CONTRACTOR_LICENSES.map((license) => (
                                        <option key={license.code} value={license.code}>
                                          {license.code} - {license.name}
                                        </option>
                                      ))}
                                    </select>
                                  </FormField>

                                  <FormField 
                                    label="License Number" 
                                    required
                                    error={licenseErrors?.[index]?.licenseNumber?.message}
                                  >
                                    <Input
                                      {...register(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>)}
                                      type="text"
                                      value={currentLicenses[index]?.licenseNumber || ''}
                                      onChange={(e) => {
                                        const val = e.target.value.trim();
                                        const isDuplicate = currentLicenses.some((l, i) => i !== index && l.licenseNumber?.trim() === val && val !== '');
                                        
                                        if (val && isDuplicate) {
                                          methods.setError(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>, {
                                            type: 'manual',
                                            message: 'This license number has already been entered'
                                          });
                                        } else {
                                          setValue(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>, val);
                                          if (licenseErrors?.[index]?.licenseNumber?.type === 'manual') {
                                            methods.clearErrors(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>);
                                          }
                                        }
                                      }}
                                      onClear={() => {
                                        setValue(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>, '');
                                        methods.clearErrors(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>);
                                      }}
                                      showClear
                                      placeholder="Enter license number"
                                      disabled={isSubmitting}
                                      required
                                      error={licenseErrors?.[index]?.licenseNumber?.message}
                                    />
                                  </FormField>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Address Information */}
            <div className="border-2 border-black rounded-lg bg-white">
              <button
                type="button"
                onClick={() => {
                  const newValue = !isAddressInfoOpen;
                  setIsAddressInfoOpen(newValue);
                  if (newValue) {
                    setIsBusinessInfoOpen(false);
                    setIsContactInfoOpen(false);
                    setIsLinksOpen(false);
                  }
                }}
                className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
              >
                <h2 className="text-xl font-bold text-black">Address Information</h2>
                {isAddressInfoOpen ? (
                  <ChevronUp className="w-5 h-5 text-black shrink-0 ml-4" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-black shrink-0 ml-4" />
                )}
              </button>
              
              {isAddressInfoOpen && (
                <div className="px-4 pb-4 border-t-2 border-black space-y-4 pt-4">
                  <FormField label="Business Address" required error={errors.streetAddress?.message}>
                    <AddressAutocomplete
                      id="business-address"
                      value={watch('address') || ''}
                      onChange={(val) => setValue('address', val)}
                      onAddressSelect={handleAddressSelect}
                      placeholder={tSearch('address')}
                    />
                  </FormField>
                  <FormField label="Apartment, Suite, Unit">
                    <Input
                      {...register('apartment')}
                      value={watch('apartment') || ''}
                      onClear={() => setValue('apartment', '')}
                      showClear
                      placeholder="Apt, Suite, Unit, etc."
                      disabled={isSubmitting}
                    />
                  </FormField>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="City" required error={errors.city?.message}>
                      <Input
                        {...register('city')}
                        value={watch('city') || ''}
                        onClear={() => setValue('city', '')}
                        showClear
                        placeholder="City"
                        disabled={isSubmitting}
                        error={errors.city?.message}
                      />
                    </FormField>
                    <FormField label="State" required error={errors.state?.message}>
                      <Input
                        {...register('state')}
                        value={watch('state') || ''}
                        onClear={() => setValue('state', '')}
                        showClear
                        placeholder="State"
                        disabled={isSubmitting}
                        error={errors.state?.message}
                      />
                    </FormField>
                  </div>
                  <FormField label="ZIP Code" required error={errors.zipCode?.message}>
                    <Input
                      {...register('zipCode')}
                      value={watch('zipCode') || ''}
                      onClear={() => setValue('zipCode', '')}
                      showClear
                      placeholder="ZIP Code"
                      disabled={isSubmitting}
                      error={errors.zipCode?.message}
                    />
                  </FormField>
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div className="border-2 border-black rounded-lg bg-white">
              <button
                type="button"
                onClick={() => {
                  const newValue = !isContactInfoOpen;
                  setIsContactInfoOpen(newValue);
                  if (newValue) {
                    setIsBusinessInfoOpen(false);
                    setIsAddressInfoOpen(false);
                    setIsLinksOpen(false);
                  }
                }}
                className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
              >
                <h2 className="text-xl font-bold text-black">Contact Information</h2>
                {isContactInfoOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              
              {isContactInfoOpen && (
                <div className="px-4 pb-4 border-t-2 border-black space-y-4 pt-4">
                  <FormField label="Business Email" error={errors.email?.message}>
                    <Input
                      {...register('email')}
                      type="email"
                      value={watch('email') || ''}
                      onClear={() => setValue('email', '')}
                      showClear
                      placeholder="Email address"
                      disabled={isSubmitting}
                      error={errors.email?.message}
                    />
                  </FormField>
                  <FormField label="Land Phone" error={errors.phone?.message}>
                    <Input
                      {...register('phone')}
                      type="tel"
                      value={watch('phone') || ''}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        setValue('phone', formatted);
                      }}
                      onClear={() => setValue('phone', '')}
                      showClear
                      placeholder="Land phone"
                      disabled={isSubmitting}
                      error={errors.phone?.message}
                    />
                  </FormField>
                  <FormField label="Mobile Phone" error={errors.mobilePhone?.message}>
                    <Input
                      {...register('mobilePhone')}
                      type="tel"
                      value={watch('mobilePhone') || ''}
                      onChange={(e) => {
                        const formatted = formatPhoneNumber(e.target.value);
                        setValue('mobilePhone', formatted);
                      }}
                      onClear={() => setValue('mobilePhone', '')}
                      showClear
                      placeholder="Mobile phone"
                      disabled={isSubmitting}
                      error={errors.mobilePhone?.message}
                    />
                  </FormField>
                </div>
              )}
            </div>

            {/* Business Links */}
            <div className="border-2 border-black rounded-lg bg-white">
              <button
                type="button"
                onClick={() => {
                  const newValue = !isLinksOpen;
                  setIsLinksOpen(newValue);
                  if (newValue) {
                    setIsBusinessInfoOpen(false);
                    setIsAddressInfoOpen(false);
                    setIsContactInfoOpen(false);
                  }
                }}
                className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
              >
                <h2 className="text-xl font-bold text-black">Business Links</h2>
                {isLinksOpen ? (
                  <ChevronUp className="w-5 h-5 text-black shrink-0 ml-4" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-black shrink-0 ml-4" />
                )}
              </button>
              
              {isLinksOpen && (
                <div className="px-4 pb-4 border-t-2 border-black space-y-4 pt-4">
                  <AddressRequiredModal
                    isOpen={showAddressModal}
                    onClose={() => setShowAddressModal(false)}
                  />
                  
                  <div className="bg-white border-2 border-gray-300 rounded-lg p-4 mb-4 text-xs text-gray-700">
                    <h4 className="font-medium text-gray-800 mb-2">Link Visibility:</h4>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Add and drag links to position them in the card</li>
                      <li>The first {MAX_VISIBLE_LINKS} links will be visible on your business card</li>
                      <li>Additional links will only be shown on your business detail page</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-[20%_80%] md:grid-cols-[minmax(0,1fr)_minmax(0,4fr)] gap-4 px-2 md:px-0">
                    <div className="bg-black text-white font-semibold px-2 py-2 rounded-lg text-center truncate">Position</div>
                    <div className="bg-black text-white font-semibold px-4 py-2 rounded-lg text-center">Links</div>
                  </div>

                  {links.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No links added yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {links.map((link, index) => {
                        const isVisibleOnCard = index < MAX_VISIBLE_LINKS;
                        const displayValue = getDisplayValue(link as LinkItem);
                        const option = SOCIAL_MEDIA_OPTIONS.find(opt => opt.key === link.type);
                        const canRemove = link.type !== 'phone' || links.some(l => l.type === 'whatsapp');
                        
                        return (
                          <div
                            key={`${link.type}-${index}`}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={() => setDragOverIndex(null)}
                            onDrop={(e) => handleDrop(e, index)}
                            className="grid grid-cols-[25%_75%] md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4 items-center px-2 md:px-0"
                          >
                            <div className="flex justify-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${isVisibleOnCard ? 'bg-black text-white' : 'bg-gray-200 text-gray-600'}`}>
                                {index + 1}
                              </div>
                            </div>

                            <div
                              className={`border-2 border-black rounded-lg bg-white p-4 relative transition-all duration-300 ${
                                draggedIndex === index 
                                  ? 'opacity-50 scale-95 rotate-1 shadow-lg' 
                                  : draggedIndex !== null
                                  ? 'opacity-100'
                                  : 'opacity-100'
                              }`}
                            >
                              {/* Highlight drop target */}
                              {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                                <div className="absolute inset-0 ring-2 ring-red-500 rounded-lg pointer-events-none animate-pulse" />
                              )}
                              {canRemove && (
                                <button type="button" onClick={() => handleRemoveLink(index)} className="absolute top-2 right-2 text-red-500 cursor-pointer transition-opacity duration-200 hover:opacity-70">
                                  <X className="w-5 h-5" />
                                </button>
                              )}
                              <div className="flex items-center gap-1">
                                <div
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, index)}
                                  onDragEnd={() => {
                                    setDraggedIndex(null);
                                    setDragOverIndex(null);
                                  }}
                                  className="-ml-1 cursor-move transition-transform duration-200 hover:scale-110 active:scale-95"
                                >
                                  <GripVertical className="w-5 h-5 text-black transition-colors duration-200" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    {(() => {
                                      // Map link types to brand icons (same as add business form)
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
                                      {linkLabels[link.type as keyof typeof linkLabels] || link.type}
                                      {link.type === 'phone' && <span className="text-red-500">*</span>}
                                    </div>
                                  </div>
                                  {link.type === 'location' ? (
                                    <div className="flex items-center gap-2 p-2 bg-gray-50 border rounded text-sm truncate">{displayValue}</div>
                                  ) : (
                                    <FormField label="" error={linkErrors?.[index]?.url?.message ?? linkErrors?.[index]?.value?.message}>
                                      <Input
                                        value={formatInputValue(link.type as LinkItem['type'], displayValue)}
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
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Add Link {links.length >= 15 && '(Max 15 reached)'}
                    </label>
                    <select
                      value={selectedLinkType}
                      onChange={(e) => handleLinkSelection(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={links.length >= 15}
                    >
                      <option value="">{links.length >= 15 ? 'Maximum links reached' : 'Choose platform...'}</option>
                      {availableOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => router.push(`/${locale}/account-management`)}
                className="flex-1 px-6 py-3 border-2 border-black bg-white text-black rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 border-2 border-black bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </FormProvider>
    </div>
  );
}
