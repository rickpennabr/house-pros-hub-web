'use client';

import { useMemo, useEffect, useRef, useState, useSyncExternalStore, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSwitch } from '@/contexts/AccountSwitchContext';
import LoadingFallback from '@/components/ui/LoadingFallback';
import SettingsModal from '@/components/settings/SettingsModal';
import { 
  Building2, 
  Plus, 
  UserCheck, 
  Crown,
  ChevronRight,
  Bookmark,
  Edit,
  LayoutDashboard,
  FileText,
  HardDrive,
  CreditCard,
  QrCode,
  Settings,
  GripVertical
} from 'lucide-react';
import {
  applyQuickActionMove,
  getQuickActionOrder,
  sortBySavedOrder,
  subscribeQuickActionOrder,
  writeQuickActionOrder,
} from '@/lib/account/quick-action-order';

interface Account {
  id: string;
  slug?: string;
  name: string;
  type: 'personal' | 'business';
  icon?: string;
  isActive?: boolean;
  isSelected?: boolean;
  hasCrown?: boolean;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  path: string;
}


function AccountManagementContent() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const t = useTranslations('accountManagement');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user, roles, isAdmin, isLoading: authLoading } = useAuth();
  const { businesses, activeAccountId, setActiveAccountId, refreshBusinesses } = useAccountSwitch();
  const userId = user?.id ?? '';
  const effectiveSelectedAccountId = activeAccountId || userId;

  // Check for businessId query parameter and select it if present
  // Also refresh business data from API to ensure we have latest logo/background
  useEffect(() => {
    const businessIdParam = searchParams.get('businessId');
    if (!businessIdParam || !userId) return;
    let cancelled = false;
    fetch(`/api/businesses/${businessIdParam}`, {
      method: 'GET',
      credentials: 'include',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.business) return;
        if (data.business.userId === userId) {
          refreshBusinesses();
          setActiveAccountId(businessIdParam);
        }
      })
      .catch((err) => {
        console.error('Error fetching business data:', err);
      })
      .finally(() => {
        if (cancelled) return;
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('businessId');
        router.replace(newUrl.pathname + newUrl.search, { scroll: false });
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams, userId, router, setActiveAccountId, refreshBusinesses]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/${locale}`);
    }
  }, [authLoading, user, router, locale]);

  // Personal account: profile and creating a business only.
  const personalActions: QuickAction[] = useMemo(() => [
    {
      id: 'personal-1',
      title: t('actions.personal.editProfile.title'),
      description: t('actions.personal.editProfile.description'),
      icon: Edit,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/profile/edit`,
    },
    {
      id: 'personal-3',
      title: t('actions.personal.addBusiness.title'),
      description: t('actions.personal.addBusiness.description'),
      icon: Plus,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/business/add`,
    },
    {
      id: 'personal-2',
      title: t('actions.personal.savedBusiness.title'),
      description: t('actions.personal.savedBusiness.description'),
      icon: Bookmark,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/saved-businesses`,
    },
  ], [t, locale]);

  // Pro profile: business tools plus the rest of the hub shortcuts.
  const businessActions: QuickAction[] = useMemo(() => [
    {
      id: '1',
      title: t('actions.business.editBusiness.title'),
      description: t('actions.business.editBusiness.description'),
      icon: Building2,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/businesslist`,
    },
    {
      id: '2',
      title: t('actions.business.addBusiness.title'),
      description: t('actions.business.addBusiness.description'),
      icon: Plus,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/businesslist?action=add`,
    },
    {
      id: '5',
      title: t('actions.business.managePartners.title'),
      description: t('actions.business.managePartners.description'),
      icon: UserCheck,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/partners/manage`,
    },
    {
      id: 'personal-proscrm',
      title: t('actions.personal.proscrm.title'),
      description: t('actions.personal.proscrm.description'),
      icon: LayoutDashboard,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/crm`,
    },
    {
      id: 'personal-prodrive',
      title: t('actions.personal.prodrive.title'),
      description: t('actions.personal.prodrive.description'),
      icon: HardDrive,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/prodrive`,
    },
    {
      id: 'personal-subscription',
      title: t('actions.personal.subscription.title'),
      description: t('actions.personal.subscription.description'),
      icon: CreditCard,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/subscription`,
    },
    {
      id: 'personal-proresume',
      title: t('actions.personal.proresume.title'),
      description: t('actions.personal.proresume.description'),
      icon: FileText,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/proresume`,
    },
    {
      id: 'personal-qrcode',
      title: t('actions.personal.qrcode.title'),
      description: t('actions.personal.qrcode.description'),
      icon: QrCode,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/qrcode`,
    },
  ], [t, locale]);

  // Generate accounts: personal account first, then business accounts
  const businessList = businesses;
  const visibleAccounts = useMemo(() => {
    const accounts: Account[] = [];
    
    // Always add personal account first
    if (user) {
      const personalName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || t('personalAccountFallback') || 'Personal';
      const personalAccount: Account = {
        id: user.id,
        name: personalName,
        type: 'personal',
        isSelected: effectiveSelectedAccountId === user.id || (effectiveSelectedAccountId === '' && businessList.length === 0),
      };
      accounts.push(personalAccount);
    }
    
    // Add business accounts (from API so they always show, or from storage)
    businessList.forEach((business) => {
      const businessAccount: Account = {
        id: business.id,
        slug: business.slug,
        name: business.businessName?.trim() || t('businessAccountFallback') || 'Business',
        type: 'business',
        icon: business.logo || business.businessLogo,
        isSelected: effectiveSelectedAccountId === business.id,
        hasCrown: false,
      };
      accounts.push(businessAccount);
    });
    
    return accounts;
  }, [user, businessList, effectiveSelectedAccountId, t]);

  // Personal shows profile, saved businesses, and creating a business. Partnership is on a pro profile.
  const selectedAccount = visibleAccounts.find(acc => acc.id === effectiveSelectedAccountId);
  const isPro = roles.includes('contractor') || (roles as string[]).includes('realtor');
  const isInstaller = (roles as string[]).includes('installer');
  const isHandyman = (roles as string[]).includes('handyman');
  const visibleActions = [
    ...(selectedAccount?.type === 'personal'
      ? personalActions
      : businessActions
          .filter((action) => {
            if (action.id === 'personal-proscrm') return (isPro || isInstaller || isHandyman) && !isAdmin;
            if (action.id === 'personal-proresume') return isInstaller || isHandyman;
            if (action.id === 'personal-qrcode') return (isInstaller || isHandyman) && !isPro && !isAdmin;
            return true;
          })
          .map((action) => {
            if (action.id === '1') {
              return {
                ...action,
                path: `/${locale}/business/edit/${selectedAccount?.slug || effectiveSelectedAccountId}`,
              };
            }
            return action;
          })),
    ...(selectedAccount?.type === 'personal'
      ? [
          {
            id: 'settings',
            title: t('settings.title'),
            description: t('settings.description'),
            icon: Settings,
            iconBg: 'bg-black',
            iconColor: 'text-white',
            borderColor: 'border-black',
            path: 'settings',
          },
        ]
      : []),
  ];

  const accountKind = selectedAccount?.type === 'personal' ? 'personal' : 'business';
  const orderKey = userId ? `hph-quick-actions-order:${userId}:${accountKind}` : null;
  const savedOrder = useSyncExternalStore(
    subscribeQuickActionOrder,
    () => getQuickActionOrder(orderKey),
    () => getQuickActionOrder(null),
  );
  const dragFromId = useRef<string | null>(null);
  const dragCleanup = useRef<(() => void) | null>(null);
  const didDrag = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => () => dragCleanup.current?.(), []);

  const orderedActions = sortBySavedOrder(visibleActions, savedOrder);

  const commitOrder = (fromId: string, toId: string) => {
    const next = applyQuickActionMove(
      savedOrder,
      orderedActions.map((action) => action.id),
      fromId,
      toId,
    );
    if (next === savedOrder || !orderKey) return;
    writeQuickActionOrder(orderKey, next);
  };

  const beginDrag = (event: React.PointerEvent, id: string) => {
    if (event.button !== 0) return;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerType = event.pointerType;
    let active = false;
    dragFromId.current = id;
    dragCleanup.current?.();

    const cleanup = () => {
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (dragCleanup.current === cleanup) dragCleanup.current = null;
    };

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!active) {
        if (Math.hypot(dx, dy) < 8) return;
        // A vertical swipe is a page scroll, not a reorder.
        if (pointerType === 'touch' && Math.abs(dy) > Math.abs(dx)) {
          dragFromId.current = null;
          cleanup();
          return;
        }
        active = true;
        didDrag.current = true;
        document.body.style.cursor = 'grabbing';
        setDraggingId(id);
      }
      const card = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-action-id]');
      const overId = card?.dataset.actionId ?? null;
      const nextOver = overId && overId !== id ? overId : null;
      setDragOverId((current) => (current === nextOver ? current : nextOver));
    }

    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      const fromId = dragFromId.current;
      dragFromId.current = null;
      const toId = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-action-id]')?.dataset.actionId ?? null;
      setDraggingId(null);
      setDragOverId(null);
      if (active && fromId && toId) commitOrder(fromId, toId);
      if (active) window.setTimeout(() => { didDrag.current = false; }, 0);
    }

    dragCleanup.current = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const openAction = (path: string) => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    handleQuickAction(path);
  };

  const handleAccountSelect = (accountId: string) => {
    setActiveAccountId(accountId);
  };

  const handleQuickAction = (path: string) => {
    if (path === 'settings') {
      setSettingsOpen(true);
      return;
    }
    router.push(path);
  };

  const getAccountIcon = (account: Account) => {
    if (account.type === 'personal') {
      const initials = user ? (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase() : 'U';
      return (
        <div className="w-8 h-8 rounded-lg border border-black flex items-center justify-center shrink-0 overflow-hidden relative aspect-square">
          {user?.userPicture ? (
            user.userPicture.startsWith('data:') ? (
              <Image
                src={user.userPicture}
                alt={account.name}
                fill
                className="object-cover"
                sizes="32px"
                unoptimized
              />
            ) : (
              <Image
                src={user.userPicture}
                alt={account.name}
                fill
                className="object-cover"
                sizes="32px"
              />
            )
          ) : (
            <div className="w-full h-full bg-black flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{initials}</span>
            </div>
          )}
        </div>
      );
    }
    
    // For business accounts, show logo if available
    if (account.icon) {
      return (
        <div className="w-8 h-8 rounded-lg border border-black flex items-center justify-center shrink-0 overflow-hidden relative aspect-square bg-white">
          <Image
            src={account.icon}
            alt={account.name}
            fill
            className="object-cover"
            sizes="32px"
          />
        </div>
      );
    }

    return (
      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
        <Building2 className="w-5 h-5 text-black" />
      </div>
    );
  };

  if (!authLoading && !user) {
    return null;
  }

  return (
    <div className="bg-white">
      {/* Main Content */}
      <div className="w-full max-w-[960px] mx-auto p-2 md:p-2 py-2 md:py-2">
        {/* Select Account Section - Personal first, then business (e.g. after "Manage business") */}
        <div className="mb-2 md:mb-0">
          <h2 className="text-lg md:text-xl font-bold text-black mb-2 md:mb-4">{t('selectAccount')}</h2>
          <div className="relative">
            {authLoading ? (
              <div className="flex gap-3 overflow-x-auto pb-2">
                <div className="h-12 w-32 rounded-lg border-2 border-gray-200 bg-gray-50 animate-pulse flex-shrink-0" />
                <div className="h-12 w-40 rounded-lg border-2 border-gray-200 bg-gray-50 animate-pulse flex-shrink-0" />
              </div>
            ) : (
              <>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {visibleAccounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => handleAccountSelect(account.id)}
                      className={`
                        relative flex items-center gap-3 px-2 py-2 md:px-4 md:py-3 rounded-lg border-2 transition-all flex-shrink-0 cursor-pointer
                        ${account.isSelected 
                          ? 'bg-white border-black' 
                          : account.isActive 
                            ? 'bg-black text-white border-black' 
                            : 'bg-white border-gray-300 hover:border-black'
                        }
                      `}
                    >
                      {account.hasCrown && (
                        <Crown className="w-4 h-4 text-green-600 absolute -top-1 -right-1" />
                      )}
                      {getAccountIcon(account)}
                      <span className="text-sm md:text-base font-medium whitespace-nowrap">
                        {account.name}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Scroll indicator - only show on mobile when more than 2 accounts */}
                {visibleAccounts.length > 2 && (
                  <div className="absolute right-0 top-1/2 transform -translate-y-1/2 pointer-events-none md:hidden">
                    <ChevronRight className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick Actions Section */}
        <div>
          <h2 className="text-lg md:text-xl font-bold text-black mb-1">{t('quickActions')}</h2>
          <p className="mb-3 text-sm text-gray-500 md:mb-4">{t('dragHint')}</p>
          {/* Mobile: 2 column horizontal button layout */}
          <div className="grid grid-cols-2 gap-3 md:hidden">
            {orderedActions.map((action) => {
              const IconComponent = action.icon;
              const dragging = draggingId === action.id;
              const dropTarget = dragOverId === action.id;
              return (
                <div
                  key={action.id}
                  role="button"
                  tabIndex={0}
                  data-action-id={action.id}
                  onClick={() => openAction(action.path)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openAction(action.path);
                    }
                  }}
                  className={`relative bg-white border-2 border-black rounded-lg py-2 pl-2 pr-5 flex items-center gap-2 cursor-pointer select-none hover:bg-gray-50 transition-colors ${
                    dragging ? 'opacity-40' : ''
                  } ${dropTarget ? 'outline outline-2 outline-offset-2 outline-black' : ''}`}
                >
                  <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                  <span className="min-w-0 flex-1 text-sm font-medium leading-tight text-gray-800 break-words">
                    {action.title}
                  </span>
                  <button
                    type="button"
                    aria-label={t('dragHint')}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      beginDrag(event, action.id);
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="absolute right-0.5 top-1/2 z-10 flex -translate-y-1/2 cursor-grab items-center justify-center text-gray-500 active:cursor-grabbing"
                  >
                    <GripVertical className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
          {/* PC: Card layout (original) */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {orderedActions.map((action) => {
              const IconComponent = action.icon;
              const dragging = draggingId === action.id;
              const dropTarget = dragOverId === action.id;
              return (
                <div
                  key={action.id}
                  data-action-id={action.id}
                  onClick={() => openAction(action.path)}
                  className={`relative bg-white border-2 border-black rounded-lg p-2 cursor-pointer select-none hover:shadow-lg transition-shadow ${
                    dragging ? 'opacity-40' : ''
                  } ${dropTarget ? 'outline outline-2 outline-offset-2 outline-black' : ''}`}
                >
                  <button
                    type="button"
                    aria-label={t('dragHint')}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      beginDrag(event, action.id);
                    }}
                    onClick={(event) => event.stopPropagation()}
                    className="absolute right-2 top-2 z-10 flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 active:cursor-grabbing"
                  >
                    <GripVertical className="h-5 w-5" aria-hidden />
                  </button>
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>

                    <div className="min-w-0 flex-1 pr-4">
                      <h3 className="mb-1 truncate text-lg font-bold text-gray-800">
                        {action.title}
                      </h3>
                      <p className="truncate text-sm text-gray-600" title={action.description}>
                        {action.description}
                      </p>
                    </div>
                  </div>

                  <button type="button" className="w-full py-2.5 px-4 border-2 border-black bg-white text-black rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm cursor-pointer">
                    {t('access')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default function AccountManagementPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AccountManagementContent />
    </Suspense>
  );
}
