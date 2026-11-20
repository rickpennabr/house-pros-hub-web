'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import BusinessDetailsHeader from '@/components/businessdetails/BusinessDetailsHeader';
import BusinessHeroImage from '@/components/businessdetails/BusinessHeroImage';
import { BackgroundImageEdit } from '@/components/businessdetails/BackgroundImageEdit';
import ProReactions from '@/components/proscard/ProReactions';
import ProLinks from '@/components/proscard/ProLinks';
import BusinessDetailsTabs, { type BusinessDetailsTab } from '@/components/businessdetails/BusinessDetailsTabs';
import BusinessServicesTab from '@/components/businessdetails/BusinessServicesTab';
import BusinessProductsTab from '@/components/businessdetails/BusinessProductsTab';
import BusinessPropertiesTab from '@/components/businessdetails/BusinessPropertiesTab';
import BusinessTradesTab from '@/components/businessdetails/BusinessTradesTab';
import BusinessContactInfo from '@/components/businessdetails/BusinessContactInfo';
import {
  defaultTabsForRole,
  normalizeTabsForRole,
  resolveProDetailsRole,
} from '@/lib/constants/proDetailsTabs';
import SignInRequiredModal from '@/components/auth/SignInRequiredModal';
import { HphQrCodeModal } from '@/components/qr/HphQrCodeModal';
import { publicPageUrl } from '@/lib/qr/public-origin';
import { createLocalePath } from '@/lib/redirect';
import type { Locale } from '@/i18n';
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
import MakeAppointmentCard from '@/components/businessdetails/MakeAppointmentCard';
import type { WeekSchedule } from '@/lib/booking/businessHours';
import { FileDropTarget } from '@/components/ui/FileDropTarget';

type TabType = BusinessDetailsTab;

/** Keep the last boxes this far inside the scrollport so their borders are fully visible. */
const TAB_CONTENT_BOTTOM_INSET_PX = 12;

function findScrollParent(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function scrollportBounds(scroller: HTMLElement | null): { top: number; bottom: number } {
  if (!scroller) {
    return { top: 0, bottom: window.innerHeight };
  }
  const top = scroller.getBoundingClientRect().top + scroller.clientTop;
  return { top, bottom: top + scroller.clientHeight };
}

function scrollByDelta(amount: number, scroller: HTMLElement | null) {
  if (Math.abs(amount) <= 1) return;
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  if (scroller) {
    scroller.scrollBy({ top: amount, behavior });
    return;
  }
  window.scrollBy({ top: amount, behavior });
}

/**
 * Tall tabs, and any tab already scrolled off: put the tab row on the top edge.
 * Short tabs still on screen: move only enough to show the last boxes.
 */
function alignTabOnScreen(tabs: HTMLElement, content: HTMLElement, scroller: HTMLElement | null) {
  content.style.paddingBottom = '';
  const port = scrollportBounds(scroller);
  const contentRect = content.getBoundingClientRect();
  const tabsRect = tabs.getBoundingClientRect();
  const portHeight = port.bottom - port.top;
  const overflow = contentRect.bottom - (port.bottom - TAB_CONTENT_BOTTOM_INSET_PX);
  const tabsAbove = tabsRect.top < port.top - 1;
  const tall = contentRect.height > portHeight;

  if (tall || tabsAbove) {
    scrollByDelta(tabsRect.top - port.top, scroller);
    return;
  }
  if (overflow > 1) scrollByDelta(overflow, scroller);
}

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
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const locale = useLocale();
  const tHours = useTranslations('businessHours');
  const { user, isAuthenticated } = useAuth();
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSignInRequiredOpen, setIsSignInRequiredOpen] = useState(false);
  const [business, setBusiness] = useState<BusinessWithMeta | null>(null);
  const [selectedTab, setActiveTab] = useState<TabType>('contact');
  const appliedSharedTab = useRef(false);
  const tabSaveSeq = useRef(0);
  const [tabScrollNonce, setTabScrollNonce] = useState(0);
  const [ownerRoles, setOwnerRoles] = useState<string[]>([]);
  const [profileProductCount, setProfileProductCount] = useState(0);
  const [ownerTrades, setOwnerTrades] = useState<string[]>([]);
  const [ownerServiceArea, setOwnerServiceArea] = useState<string | null>(null);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bgSaving, setBgSaving] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const heroContainerRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const [heroDragStart, setHeroDragStart] = useState<{ clientX: number; clientY: number; posX: number; posY: number } | null>(null);
  const [showAdjustHint, setShowAdjustHint] = useState(false);
  const [savedBgPosition, setSavedBgPosition] = useState('50% 50%');
  const [isAdjustMode, setIsAdjustMode] = useState(false);
  
  const isOwner = !!user?.id && !!business?.userId && user.id === business.userId;
  const detailsRole = resolveProDetailsRole(ownerRoles);
  const roleTabs = normalizeTabsForRole(detailsRole, business?.tabOrder);
  const showServices = detailsRole === 'contractor' || detailsRole === 'handyman' || detailsRole === 'installer';
  const showProducts =
    (detailsRole === 'contractor' || detailsRole === 'installer') &&
    (isOwner || profileProductCount > 0);
  const showProperties = detailsRole === 'realtor';
  const showTrades = detailsRole === 'handyman';
  const visibleTabs = roleTabs.filter((tab) => {
    if (tab === 'services') return showServices;
    if (tab === 'products') return showProducts;
    if (tab === 'properties') return showProperties;
    if (tab === 'trades') return showTrades;
    return true;
  });
  const activeTab: TabType =
    visibleTabs.length === 0 || visibleTabs.includes(selectedTab) ? selectedTab : visibleTabs[0];

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

  // Each tab tap brings the tab row to the top. Scrolling the list itself does not.
  const skipInitialTabScroll = useRef(true);
  useEffect(() => {
    if (skipInitialTabScroll.current) {
      skipInitialTabScroll.current = false;
      return;
    }

    const content = tabContentRef.current;
    const tabs = tabsRef.current;
    if (!content || !tabs) return;

    const scroller = findScrollParent(content);
    let cancelled = false;
    let userTookOver = false;
    let fromUs = true;
    let quietTimer: number | null = null;

    const markQuiet = () => {
      if (quietTimer != null) window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(() => {
        fromUs = false;
      }, 180);
    };

    const align = () => {
      if (cancelled || userTookOver) return;
      const currentContent = tabContentRef.current;
      const currentTabs = tabsRef.current;
      if (!currentContent || !currentTabs) return;
      fromUs = true;
      alignTabOnScreen(currentTabs, currentContent, scroller);
      markQuiet();
    };

    const onScroll = () => {
      if (fromUs) {
        markQuiet();
        return;
      }
      userTookOver = true;
    };
    scroller?.addEventListener('scroll', onScroll, { passive: true });

    const frame = requestAnimationFrame(align);
    const observer = new ResizeObserver(align);
    observer.observe(content);

    return () => {
      cancelled = true;
      if (quietTimer != null) window.clearTimeout(quietTimer);
      cancelAnimationFrame(frame);
      observer.disconnect();
      scroller?.removeEventListener('scroll', onScroll);
    };
  }, [tabScrollNonce]);

  // Open a section when a shared link includes ?tab=
  useEffect(() => {
    if (loading || appliedSharedTab.current) return;
    const requested = searchParams.get('tab') as BusinessDetailsTab | null;
    if (!requested) return;
    const allowed = new Set(defaultTabsForRole(detailsRole));
    if (!allowed.has(requested)) return;
    if (requested === 'services' && !showServices) return;
    if (requested === 'products' && !showProducts) return;
    if (requested === 'properties' && !showProperties) return;
    if (requested === 'trades' && !showTrades) return;
    appliedSharedTab.current = true;
    setActiveTab(requested);
    setTabScrollNonce((n) => n + 1);
  }, [loading, searchParams, detailsRole, showServices, showProducts, showProperties, showTrades]);

  // (Active tab is derived below so a hidden role tab falls back to the first visible one.)

  useEffect(() => {
    const FETCH_TIMEOUT_MS = 15000;
    const controller = new AbortController();
    // HMR / LAN remount storms cancel in-flight fetches; always clear loading so the UI cannot stick.
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      setLoading(false);
    };

    const fetchBusiness = async () => {
      if (!slug) {
        settle();
        return;
      }
      setLoading(true);
      setBookingSettings(null);

      try {
        let data: BusinessWithMeta | null = null;
        let ownerProfile: OwnerProfile | null = null;
        let rolesFromApi: string[] = [];
        let failed = false;

        // Fetch from API with timeout so we don't hang indefinitely
        try {
          const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          const response = await fetch(`/api/businesses/${slug}`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (controller.signal.aborted) return;
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
          } else if (response.status !== 404) {
            failed = true;
          }
        } catch (apiError) {
          if (controller.signal.aborted) return;
          failed = true;
          if ((apiError as Error)?.name === 'AbortError') {
            console.warn('Business fetch timed out');
          } else {
            console.error('Error fetching from API:', apiError);
          }
        }
        if (controller.signal.aborted) return;

        setLoadError(data ? null : failed ? 'Could not load this business. Try again.' : null);

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
        if (controller.signal.aborted) return;
        console.error('Error fetching business:', error);
        setLoadError('Could not load this business. Try again.');
      } finally {
        settle();
      }
    };

    fetchBusiness();
    return () => {
      controller.abort();
      settle();
    };
  }, [slug]);

  useEffect(() => {
    if (!business?.id) return;
    let cancelled = false;
    const loadExtras = async () => {
      try {
        const productRes = await fetch(`/api/businesses/${business.id}/products`, { credentials: 'include' });
        if (productRes.ok) {
          const productData = await productRes.json().catch(() => ({}));
          const profile = (productData.profileProducts ?? []) as { id: string }[];
          if (!cancelled) setProfileProductCount(profile.length);
        }
      } catch {
        if (!cancelled) setProfileProductCount(0);
      }

      // Only handymen show a Trades tab.
      const role = resolveProDetailsRole(ownerRoles);
      if (role !== 'handyman') {
        if (!cancelled) {
          setOwnerTrades([]);
          setOwnerServiceArea(null);
        }
        return;
      }
      if (!business.userId) return;
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('handyman_profiles')
          .select('trades, service_area')
          .eq('user_id', business.userId)
          .maybeSingle();
        if (!cancelled) {
          setOwnerTrades(Array.isArray(data?.trades) ? data.trades : []);
          setOwnerServiceArea(typeof data?.service_area === 'string' ? data.service_area : null);
        }
      } catch {
        if (!cancelled) {
          setOwnerTrades([]);
          setOwnerServiceArea(null);
        }
      }
    };
    void loadExtras();
    return () => {
      cancelled = true;
    };
  }, [business?.id, business?.userId, ownerRoles]);

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
        <p className="text-black">{loadError ?? 'Business not found'}</p>
      </div>
    );
  }

  const saveTabOrder = async (next: TabType[]) => {
    if (!isOwner) return;
    const seq = ++tabSaveSeq.current;
    const previous = business.tabOrder;
    setBusiness((prev) => (prev ? { ...prev, tabOrder: next } : null));
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`/api/businesses/${business.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ tabOrder: next }),
      });
      if (seq !== tabSaveSeq.current) return;
      if (!res.ok) {
        setBusiness((prev) => (prev ? { ...prev, tabOrder: previous } : null));
      }
    } catch (error) {
      console.error('Failed to save tab order', error);
      if (seq !== tabSaveSeq.current) return;
      setBusiness((prev) => (prev ? { ...prev, tabOrder: previous } : null));
    }
  };

  const phoneLink = business.links.find(l => l.type === 'phone');
  const emailLink = business.links.find(l => l.type === 'email');
  const profileHref = createLocalePath(locale as Locale, `/business/${business.slug || business.id}`);
  const qrFileName = `hph-${(business.slug || business.id).replace(/[^a-zA-Z0-9-_]+/g, '-')}-qr.png`;

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
        subtitle={
          business.accountRole
            ? business.accountRole.charAt(0).toUpperCase() + business.accountRole.slice(1)
            : business.contractorType
        }
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
            <FileDropTarget inputRef={bgInputRef}>
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
            </FileDropTarget>
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
      
      <div className="grid grid-cols-1 items-center border-b-2 border-black bg-white p-2 md:min-h-[60px] md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 justify-center md:px-3">
          <ProReactions
            initialReactions={business.reactions}
            businessName={business.businessName}
            contractorType={business.contractorType}
            logo={business.logo || business.businessLogo}
            businessId={business.id}
            businessSlug={business.slug}
            ownerUserId={business.userId}
            layout="around"
            gap="gap-1"
          />
        </div>
        <div className="my-2 h-px w-full bg-black md:mx-1 md:my-1 md:h-10 md:w-px" aria-hidden />

        <div className="flex min-w-0 items-center justify-center md:px-3">
          <ProLinks
            links={business.links}
            bare
            desktopLarge
            onSignInRequired={!isAuthenticated ? () => setIsSignInRequiredOpen(true) : undefined}
            onQrCode={() => setIsQrModalOpen(true)}
          />
        </div>
      </div>
      
      <div ref={tabsRef}>
        <BusinessDetailsTabs
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setTabScrollNonce((n) => n + 1);
          }}
          allowedTabs={roleTabs}
          showServices={showServices}
          showProducts={showProducts}
          showProperties={showProperties}
          showTrades={showTrades}
          tabOrder={roleTabs}
          canReorder={isOwner}
          onReorder={(order) => {
            void saveTabOrder(order);
          }}
          sectionShare={{
            locale,
            slug: business.slug || business.id,
            businessName: business.businessName,
            contractorType: business.contractorType,
            logo: business.logo || business.businessLogo,
          }}
        />
      </div>

      <div ref={tabContentRef} className="w-full p-2">
        {activeTab === 'contact' && (
          <div>
            <BusinessContactInfo
              phone={phoneLink?.value}
              email={emailLink?.value}
              streetAddress={business.streetAddress}
              apartment={business.apartment}
              city={business.city}
              state={business.state}
              zipCode={business.zipCode}
              appointmentHref={business.slug ? `/${locale}/book/${business.slug}` : undefined}
            />
          </div>
        )}

        {activeTab === 'hours' && (
          <div className="flex flex-col gap-3">
            <div>
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
              {!isOwner && !(bookingSettings && (bookingSettings.hoursConfigured || bookingSettings.enabled)) && (
                <p className="text-sm text-gray-700">{tHours('empty')}</p>
              )}
            </div>
            {business.slug ? (
              <div className="flex justify-end">
                <MakeAppointmentCard href={`/${locale}/book/${business.slug}`} />
              </div>
            ) : null}
          </div>
        )}
        
        {activeTab === 'services' && showServices && business.slug && (
          <div>
            <BusinessServicesTab
              businessId={business.id}
              businessSlug={business.slug}
              isOwner={isOwner}
              fallbackNames={business.services}
              bookingEnabled={bookingSettings?.enabled === true}
            />
          </div>
        )}

        {activeTab === 'products' && showProducts && (
          <div>
            <BusinessProductsTab businessId={business.id} isOwner={isOwner} />
          </div>
        )}

        {activeTab === 'properties' && showProperties && (
          <div>
            <BusinessPropertiesTab businessId={business.id} isOwner={isOwner} />
          </div>
        )}

        {activeTab === 'trades' && showTrades && (
          <div>
            <BusinessTradesTab
              trades={ownerTrades}
              serviceArea={ownerServiceArea}
              roleLabel="Handyman"
            />
          </div>
        )}

        {activeTab === 'links' && (
          <div>
            <BusinessLinksTab
              links={business.links}
              businessName={business.businessName}
              logoSrc={business.logo || business.businessLogo}
              appointmentHref={business.slug ? `/${locale}/book/${business.slug}` : undefined}
            />
          </div>
        )}
        
        {activeTab === 'about' && (
          <div>
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
              ownerBio={business.ownerBio}
              ownerExperience={business.ownerExperience}
              ownerDegrees={business.ownerDegrees}
              ownerCertifications={business.ownerCertifications}
              ownerYearsExperience={business.ownerYearsExperience}
              companyDescription={business.companyDescription}
              appointmentHref={business.slug ? `/${locale}/book/${business.slug}` : undefined}
            />
          </div>
        )}

        {activeTab === 'images' && (
          <div>
            <BusinessImagesTab
              gallery={business.gallery}
              images={business.images}
              businessName={business.businessName}
              isOwner={isOwner}
              businessId={business.id}
              onGalleryChange={(next) =>
                setBusiness((prev) =>
                  prev
                    ? {
                        ...prev,
                        gallery: next,
                        images: next.map((item) => item.url),
                      }
                    : null
                )
              }
            />
          </div>
        )}
      </div>
      <HphQrCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        url={publicPageUrl(profileHref)}
        label={business.businessName}
        logoSrc={business.logo || business.businessLogo}
        fileName={qrFileName}
      />
      <SignInRequiredModal isOpen={isSignInRequiredOpen} onClose={() => setIsSignInRequiredOpen(false)} />
    </div>
  );
}
