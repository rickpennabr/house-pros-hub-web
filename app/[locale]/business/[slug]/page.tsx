'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import BusinessDetailsHeader from '@/components/businessdetails/BusinessDetailsHeader';
import BusinessHeroImage from '@/components/businessdetails/BusinessHeroImage';
import { BackgroundImageEdit } from '@/components/businessdetails/BackgroundImageEdit';
import ProReactions from '@/components/proscard/ProReactions';
import BusinessDetailsTabs, { type BusinessDetailsTab } from '@/components/businessdetails/BusinessDetailsTabs';
import BusinessServicesTab from '@/components/businessdetails/BusinessServicesTab';
import BusinessContactIcons from '@/components/businessdetails/BusinessContactIcons';
import BusinessContactInfo from '@/components/businessdetails/BusinessContactInfo';
import BusinessHoursList from '@/components/businessdetails/BusinessHoursList';
import BusinessLinksTab from '@/components/businessdetails/BusinessLinksTab';
import BusinessAboutTab from '@/components/businessdetails/BusinessAboutTab';
import BusinessImagesTab from '@/components/businessdetails/BusinessImagesTab';
import { ProCardData } from '@/components/proscard/ProCard';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { parseObjectPosition, formatObjectPosition } from '@/lib/utils/backgroundPosition';
import { getCsrfToken } from '@/lib/utils/csrf';
import { ImagePlus, Loader2, X } from 'lucide-react';

type TabType = BusinessDetailsTab;

import { getBusinessData } from '@/lib/mockData/mockBusinessData';
import { businessStorage } from '@/lib/storage/businessStorage';
import type { WeekSchedule } from '@/lib/booking/businessHours';

interface OwnerProfile {
  first_name?: string | null;
  last_name?: string | null;
  user_picture?: string | null;
  company_role?: string | null;
}

type BusinessWithMeta = ProCardData & {
  userId?: string;
  business_background?: string;
};

interface BookingSettings {
  enabled: boolean;
  timezone: string;
  slotMinutes: number;
  schedule: WeekSchedule;
  hoursConfigured: boolean;
}

export default function BusinessDetailsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const locale = useLocale();
  const tHours = useTranslations('businessHours');
  const { user } = useAuth();
  const [business, setBusiness] = useState<BusinessWithMeta | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('contact');
  const [ownerRoles, setOwnerRoles] = useState<string[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [bgSaving, setBgSaving] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const heroContainerRef = useRef<HTMLDivElement>(null);
  const [heroDragStart, setHeroDragStart] = useState<{ clientX: number; clientY: number; posX: number; posY: number } | null>(null);
  const [showAdjustHint, setShowAdjustHint] = useState(false);
  const [savedBgPosition, setSavedBgPosition] = useState('50% 50%');
  const [isAdjustMode, setIsAdjustMode] = useState(false);
  
  // Refs for tab content sections for auto-scrolling
  const contactRef = useRef<HTMLDivElement>(null);
  const servicesRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLDivElement>(null);
  
  const isOwner = !!user?.id && !!business?.userId && user.id === business.userId;
  const showServices = ownerRoles.includes('contractor') || ownerRoles.includes('realtor');

  // Drag-to-position hero image (owner only); save on mouseup
  const heroDragPositionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!heroDragStart || !heroContainerRef.current || !business?.id) return;
    heroDragPositionRef.current = formatObjectPosition(heroDragStart.posX, heroDragStart.posY);
    const onMove = (e: MouseEvent) => {
      const rect = heroContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const deltaX = ((e.clientX - heroDragStart.clientX) / rect.width) * 100;
      const deltaY = ((e.clientY - heroDragStart.clientY) / rect.height) * 100;
      const newX = Math.min(100, Math.max(0, heroDragStart.posX - deltaX));
      const newY = Math.min(100, Math.max(0, heroDragStart.posY - deltaY));
      const pos = formatObjectPosition(newX, newY);
      heroDragPositionRef.current = pos;
      setBusiness((prev) => prev ? { ...prev, businessBackgroundPosition: pos } : null);
    };
    const onUp = () => {
      const pos = heroDragPositionRef.current;
      setHeroDragStart(null);
      heroDragPositionRef.current = null;
      if (pos) handleBackgroundPositionChange(pos);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [heroDragStart, business?.id]);

  // Show "drag to position" hint for a few seconds when user clicks "Adjust image"
  useEffect(() => {
    if (!showAdjustHint) return;
    const t = setTimeout(() => setShowAdjustHint(false), 4000);
    return () => clearTimeout(t);
  }, [showAdjustHint]);

  // Auto-scroll to active tab content
  useAutoScroll({ ref: contactRef, shouldScroll: activeTab === 'contact' });
  useAutoScroll({ ref: servicesRef, shouldScroll: activeTab === 'services' });
  useAutoScroll({ ref: linksRef, shouldScroll: activeTab === 'links' });
  useAutoScroll({ ref: aboutRef, shouldScroll: activeTab === 'about' });
  useAutoScroll({ ref: imagesRef, shouldScroll: activeTab === 'images' });

  useEffect(() => {
    let cancelled = false;
    const FETCH_TIMEOUT_MS = 15000;

    const fetchBusiness = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setBookingSettings(null);

      try {
        let data: BusinessWithMeta | null = null;
        let ownerProfile: OwnerProfile | null = null;
        let rolesFromApi: string[] = [];

        // Fetch from API with timeout so we don't hang indefinitely
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          const response = await fetch(`/api/businesses/${slug}`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (cancelled) return;
          if (response.ok) {
            const result = await response.json();
            data = result.business;
            rolesFromApi = Array.isArray(result.ownerRoles) ? result.ownerRoles : [];
            if (result.bookingSettings?.schedule) {
              setBookingSettings(result.bookingSettings as BookingSettings);
            } else {
              setBookingSettings(null);
            }

            if (data?.userId) {
              try {
                const supabase = createClient();
                const { data: profile, error: profileError } = await supabase
                  .from('profiles')
                  .select('first_name, last_name, user_picture, company_role')
                  .eq('id', data.userId)
                  .single();
                if (!profileError && profile) ownerProfile = profile;
              } catch (profileError) {
                console.error('Error fetching owner profile:', profileError);
              }
            }
          }
        } catch (apiError) {
          if ((apiError as Error)?.name === 'AbortError') {
            console.warn('Business fetch timed out, trying fallbacks');
          } else {
            console.error('Error fetching from API:', apiError);
          }
        }
        if (cancelled) return;

        if (!data) {
          data = businessStorage.getBusinessBySlug(slug);
          if (data?.userId) {
            try {
              const supabase = createClient();
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('first_name, last_name, user_picture, company_role')
                .eq('id', data.userId)
                .single();
              if (!profileError && profile) ownerProfile = profile;
            } catch (profileError) {
              console.error('Error fetching owner profile:', profileError);
            }
          }
        }
        if (cancelled) return;

        if (!data) {
          data = await getBusinessData(slug);
        }
        if (cancelled) return;

        if (data && ownerProfile) {
          const fullName =
            ownerProfile.first_name && ownerProfile.last_name
              ? `${ownerProfile.first_name} ${ownerProfile.last_name}`.trim()
              : ownerProfile.first_name || ownerProfile.last_name || '';
          data = {
            ...data,
            ownerImage: ownerProfile.user_picture || data.ownerImage,
            ownerName: fullName || data.ownerName,
            ownerTitle: ownerProfile.company_role || data.ownerTitle,
            ownerDescription: data.ownerDescription,
          };
        }

        if (data && !data.logo && data.businessLogo) data.logo = data.businessLogo;
        if (data && !data.businessBackground && data.business_background) {
          data.businessBackground = data.business_background;
        }

        setOwnerRoles(rolesFromApi);
        setBusiness(data);
        if (data?.businessBackgroundPosition != null) {
          setSavedBgPosition(data.businessBackgroundPosition);
        }
      } catch (error) {
        console.error('Error fetching business:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBusiness();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <p className="text-black">Loading...</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <p className="text-black">Business not found</p>
      </div>
    );
  }

  const phoneLink = business.links.find(l => l.type === 'phone');
  const emailLink = business.links.find(l => l.type === 'email');
  const websiteLink = business.links.find(l => l.type === 'website');
  const instagramLink = business.links.find(l => l.type === 'instagram');

  const handleBackgroundPositionChange = async (position: string) => {
    if (!business?.id || bgSaving) return;
    setBgSaving(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`/api/businesses/${business.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ businessBackgroundPosition: position }),
      });
      if (!res.ok) throw new Error('Failed to update position');
      const result = await res.json();
      if (result?.business?.businessBackgroundPosition != null) {
        setBusiness((prev) => (prev ? { ...prev, businessBackgroundPosition: result.business.businessBackgroundPosition } : null));
        businessStorage.updateBusiness(business.id, { businessBackgroundPosition: result.business.businessBackgroundPosition });
      } else {
        setBusiness((prev) => (prev ? { ...prev, businessBackgroundPosition: position } : null));
      }
    } catch (e) {
      console.error('Failed to update background position:', e);
    } finally {
      setBgSaving(false);
    }
  };

  const handleBackgroundUploadClick = () => {
    bgInputRef.current?.click();
  };

  const handleBackgroundFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !business?.id || bgSaving) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) return;
    setBgSaving(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      formData.set('businessId', business.id);
      const uploadRes = await fetch('/api/storage/upload-business-background', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }
      const { url } = await uploadRes.json();
      const csrfToken = await getCsrfToken();
      const patchRes = await fetch(`/api/businesses/${business.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ businessBackground: url }),
      });
      if (!patchRes.ok) throw new Error('Failed to update business');
      const result = await patchRes.json();
      if (result?.business) {
        setBusiness((prev) => (prev ? { ...prev, ...result.business } : result.business));
        businessStorage.updateBusiness(business.id, {
          businessBackground: result.business.businessBackground,
          businessBackgroundPosition: '50% 50%',
        });
      } else {
        setBusiness((prev) => (prev ? { ...prev, businessBackground: url } : null));
      }
      setSavedBgPosition('50% 50%');
      // Enter adjust mode so the user can immediately drag to position the new image (same as "Adjust image" button)
      setShowAdjustHint(true);
      setIsAdjustMode(true);
    } catch (err) {
      console.error('Background upload/update failed:', err);
    } finally {
      setBgSaving(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!business?.id || bgSaving) return;
    setBgSaving(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`/api/businesses/${business.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ businessBackground: '' }),
      });
      if (!res.ok) throw new Error('Failed to remove background');
      const result = await res.json();
      // Always clear background in state: JSON omits undefined so result.business may not have businessBackground,
      // and spreading would leave the old URL in state and the image would still show.
      setBusiness((prev) => (prev ? { ...prev, ...result?.business, businessBackground: '' } : null));
      businessStorage.updateBusiness(business.id, {
        businessBackground: '',
        businessBackgroundPosition: '50% 50%',
      });
      setSavedBgPosition('50% 50%');
      setIsAdjustMode(false);
    } catch (err) {
      console.error('Failed to remove background:', err);
    } finally {
      setBgSaving(false);
    }
  };

  return (
    <div className="w-full">
      <BusinessDetailsHeader
        logo={business.logo || business.businessLogo}
        businessName={business.businessName}
        contractorType={business.contractorType}
        isOwner={isOwner}
      />
      
      <div ref={heroContainerRef} className="relative overflow-hidden shrink-0">
        <BusinessHeroImage 
          key={business.businessBackground ?? 'no-bg'}
          imageUrl={business.businessBackground} 
          businessName={business.businessName}
          objectPosition={business.businessBackgroundPosition ?? '50% 50%'}
        />
        {isOwner && business.businessBackground && (
          <>
            {showAdjustHint && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[25] px-3 py-2 rounded-lg bg-black/80 text-white text-xs font-medium shadow-lg pointer-events-none animate-in fade-in duration-200">
                Drag the image to position it
              </div>
            )}
            {isAdjustMode ? (
              <div
                role="button"
                tabIndex={0}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  const pos = parseObjectPosition(business.businessBackgroundPosition);
                  setHeroDragStart({ clientX: e.clientX, clientY: e.clientY, posX: pos.x, posY: pos.y });
                }}
                onKeyDown={() => {}}
                className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
                aria-label="Drag to position background image"
              />
            ) : (
              <div className="absolute inset-0 z-10 pointer-events-none" aria-hidden />
            )}
            <div className="absolute top-2 right-2 flex items-center gap-2 z-30">
              {bgSaving && (
                <span className="flex h-8 w-8 items-center justify-center text-black" aria-hidden>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </span>
              )}
              <BackgroundImageEdit
                inline
                position={business.businessBackgroundPosition ?? '50% 50%'}
                savedPosition={savedBgPosition}
                onSave={() => {
                  setSavedBgPosition(business.businessBackgroundPosition ?? '50% 50%');
                  setIsAdjustMode(false);
                }}
                onPositionChange={handleBackgroundPositionChange}
                onUploadClick={handleBackgroundUploadClick}
                onAdjustClick={() => {
                  setSavedBgPosition(business.businessBackgroundPosition ?? '50% 50%');
                  setShowAdjustHint(true);
                  setIsAdjustMode(true);
                }}
                disabled={bgSaving}
                adjustImageLabel="Adjust image"
                uploadNewLabel="Upload new"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveBackground();
                }}
                disabled={bgSaving}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white text-black shadow hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                title="Remove background"
                aria-label="Remove background"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
        {isOwner && !business.businessBackground && (
          <div className="absolute top-2 right-2 z-30">
            <button
              type="button"
              onClick={() => bgInputRef.current?.click()}
              disabled={bgSaving}
              className="flex h-8 items-center gap-2 rounded-lg border-2 border-black bg-white px-3 py-1.5 text-sm font-medium text-black shadow hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              title="Upload background image"
              aria-label={bgSaving ? 'Uploading…' : 'Upload background image'}
            >
              {bgSaving ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="w-4 h-4 shrink-0" />
              )}
              <span>{bgSaving ? 'Uploading…' : 'Upload'}</span>
            </button>
          </div>
        )}
        {isOwner && (
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            onChange={handleBackgroundFileChange}
            className="hidden"
          />
        )}
      </div>
      
      <div className="flex flex-col md:flex-row md:items-center h-auto md:h-[60px] p-2 bg-white border-b-2 border-black">
        <div className="w-full md:w-1/2 md:pr-4">
          <ProReactions
            initialReactions={business.reactions}
            businessName={business.businessName}
            contractorType={business.contractorType}
            logo={business.logo || business.businessLogo}
            businessId={business.id}
            layout="around"
            gap="gap-1"
            onReaction={() => {
              // Refresh business data to get updated reactions
              const allBusinesses = businessStorage.getAllBusinesses();
              const updatedBusiness = allBusinesses.find((b) => b.id === business.id);
              if (updatedBusiness) {
                setBusiness(updatedBusiness);
              }
            }}
          />
        </div>
        {/* Divider: horizontal on mobile, vertical on desktop */}
        <div className="w-full h-px bg-black my-2 md:hidden"></div>

        {/* On mobile, show icon links under reactions */}
        <div className="w-full md:w-1/2 flex justify-center md:justify-center md:border-l md:border-black md:pl-4 items-center gap-2">
          <BusinessContactIcons
            phone={phoneLink?.value}
            website={websiteLink?.url}
            instagram={instagramLink?.url}
            businessSlug={business?.slug}
            businessId={business?.id}
          />
        </div>
      </div>
      
      <div className="flex items-center h-[60px]">
        <BusinessDetailsTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showServices={showServices}
        />
      </div>

      <div className="w-full p-2 md:p-2">
        {activeTab === 'contact' && (
          <div ref={contactRef}>
            {bookingSettings && (bookingSettings.hoursConfigured || bookingSettings.enabled) && (
              <BusinessHoursList
                schedule={bookingSettings.schedule}
                timezone={bookingSettings.timezone}
                locale={locale}
                heading={tHours('heading')}
                closedLabel={tHours('closed')}
              />
            )}
            {isOwner && !bookingSettings?.hoursConfigured && (
              <p className="mb-3 text-sm text-gray-700">
                <Link href={`/${locale}/crm/calendar`} className="font-medium underline">
                  {tHours('setHours')}
                </Link>
              </p>
            )}
            <BusinessContactInfo
              phone={phoneLink?.value}
              email={emailLink?.value}
            />
          </div>
        )}
        
        {activeTab === 'services' && showServices && business.slug && (
          <div ref={servicesRef}>
            <BusinessServicesTab
              businessId={business.id}
              businessSlug={business.slug}
              isOwner={isOwner}
              fallbackNames={business.services}
              bookingEnabled={bookingSettings?.enabled === true}
            />
          </div>
        )}

        {activeTab === 'links' && (
          <div ref={linksRef}>
            <BusinessLinksTab links={business.links} />
          </div>
        )}
        
        {activeTab === 'about' && (
          <div ref={aboutRef}>
            <BusinessAboutTab
              businessName={business.businessName}
              contractorType={business.contractorType}
              logo={business.logo || business.businessLogo}
              licenses={business.licenses}
              services={business.services}
              ownerImage={business.ownerImage}
              ownerName={business.ownerName}
              ownerTitle={business.ownerTitle}
              ownerDescription={business.ownerDescription}
              companyDescription={business.companyDescription}
            />
          </div>
        )}

        {activeTab === 'images' && (
          <div ref={imagesRef}>
            <BusinessImagesTab
              images={business.images}
              businessName={business.businessName}
              isOwner={isOwner}
              businessId={business.id}
              onImagesChange={(newImages) => setBusiness((prev) => (prev ? { ...prev, images: newImages } : null))}
            />
          </div>
        )}
      </div>
    </div>
  );
}
