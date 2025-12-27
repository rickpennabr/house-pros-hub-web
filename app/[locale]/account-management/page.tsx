'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { businessStorage } from '@/lib/storage/businessStorage';
import { ProCardData } from '@/components/proscard/ProCard';
import { 
  Building2, 
  Plus, 
  UserCheck, 
  Crown,
  ChevronRight,
  Bookmark,
  Edit
} from 'lucide-react';

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
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [accountSelection, setAccountSelection] = useState<{
    userId: string;
    accountId: string;
  }>(() => ({
    userId,
    accountId: '',
  }));
  const selectedAccountId = accountSelection.userId === userId ? accountSelection.accountId : '';
  const effectiveSelectedAccountId = selectedAccountId || userId;

  // Check for businessId query parameter and select it if present
  // Also refresh business data from API to ensure we have latest logo/background
  useEffect(() => {
    const businessIdParam = searchParams.get('businessId');
    if (businessIdParam && userId) {
      // Verify the business belongs to this user
      const userBusinesses = businessStorage.getBusinessesByUserId(userId);
      const businessExists = userBusinesses.some(b => b.id === businessIdParam);
      
      if (businessExists) {
        // Refresh business data from API to get latest logo/background images
        fetch(`/api/businesses/${businessIdParam}`, {
          method: 'GET',
          credentials: 'include',
        })
          .then(res => res.json())
          .then(data => {
            if (data.business) {
              // Update localStorage with fresh data including images
              businessStorage.updateBusiness(businessIdParam, {
                ...data.business,
                userId, // Preserve userId
              });
            }
          })
          .catch(err => {
            console.error('Error refreshing business data:', err);
            // Continue anyway - use existing data
          })
          .finally(() => {
            setAccountSelection({ userId, accountId: businessIdParam });
            // Remove the query parameter from URL after selecting
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('businessId');
            router.replace(newUrl.pathname + newUrl.search, { scroll: false });
          });
      } else {
        // Business doesn't exist in localStorage, but might exist in DB
        // Try to fetch it from API
        fetch(`/api/businesses/${businessIdParam}`, {
          method: 'GET',
          credentials: 'include',
        })
          .then(res => res.json())
          .then(data => {
            if (data.business && data.business.userId === userId) {
              // Add to localStorage
              businessStorage.addBusiness({ ...data.business, userId });
              setAccountSelection({ userId, accountId: businessIdParam });
              // Remove the query parameter from URL
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete('businessId');
              router.replace(newUrl.pathname + newUrl.search, { scroll: false });
            }
          })
          .catch(err => {
            console.error('Error fetching business data:', err);
          });
      }
    }
  }, [searchParams, userId, router]);

  const userBusinesses = useMemo<ProCardData[]>(() => {
    if (!userId) return [];
    return businessStorage.getBusinessesByUserId(userId);
  }, [userId]);

  // Personal account actions (for customers) - using translations
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
      id: 'personal-2',
      title: t('actions.personal.savedBusiness.title'),
      description: t('actions.personal.savedBusiness.description'),
      icon: Bookmark,
      iconBg: 'bg-black',
      iconColor: 'text-white',
      borderColor: 'border-black',
      path: `/${locale}/saved-businesses`,
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
  ], [t, locale]);

  // Business account actions (for contractors) - using translations
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
  ], [t, locale]);

  // Generate accounts: personal account first, then business accounts
  const visibleAccounts = useMemo(() => {
    const accounts: Account[] = [];
    
    // Always add personal account first
    if (user) {
      const personalAccount: Account = {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        type: 'personal',
        isSelected: effectiveSelectedAccountId === user.id || (effectiveSelectedAccountId === '' && userBusinesses.length === 0),
      };
      accounts.push(personalAccount);
    }
    
    // Add business accounts from storage (appear on the right side)
    userBusinesses.forEach((business) => {
      const businessAccount: Account = {
        id: business.id,
        slug: business.slug,
        name: business.businessName,
        type: 'business',
        icon: business.logo || business.businessLogo,
        isSelected: effectiveSelectedAccountId === business.id,
        hasCrown: false, // No crown for business accounts
      };
      accounts.push(businessAccount);
    });
    
    return accounts;
  }, [user, userBusinesses, effectiveSelectedAccountId]);

  // Filter quick actions based on account type
  const selectedAccount = visibleAccounts.find(acc => acc.id === effectiveSelectedAccountId);
  const visibleActions =
    selectedAccount?.type === 'personal'
      ? personalActions
      : businessActions.map((action) => {
          if (action.id === '1') {
            // Edit Business
            return {
              ...action,
              path: `/${locale}/business/edit/${selectedAccount?.slug || effectiveSelectedAccountId}`,
            };
          }
          return action;
        });

  const handleAccountSelect = (accountId: string) => {
    setAccountSelection({ userId, accountId });
  };

  const handleQuickAction = (path: string) => {
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

  return (
    <div className="bg-white">
      {/* Main Content */}
      <div className="w-full max-w-[960px] mx-auto p-2 md:p-2 py-2 md:py-2">
        {/* Select Account Section */}
        <div className="mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold text-black mb-4">{t('selectAccount')}</h2>
          <div className="relative">
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
          </div>
        </div>

        {/* Quick Actions Section */}
        <div>
          <h2 className="text-lg md:text-xl font-bold text-black mb-4">{t('quickActions')}</h2>
          {/* Mobile: 2 column horizontal button layout */}
          <div className="grid grid-cols-2 gap-3 md:hidden">
            {visibleActions.map((action) => {
              const IconComponent = action.icon;
              const isSpanish = locale === 'es';
              // Allow text wrapping on Spanish mobile, keep nowrap for English
              const textWrapClass = isSpanish ? '' : 'whitespace-nowrap';
              return (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.path)}
                  className="bg-white border-2 border-black rounded-lg px-2 py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  {/* Icon */}
                  <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                  {/* Text */}
                  <span className={`text-sm font-medium text-gray-800 ${textWrapClass}`}>
                    {action.title}
                  </span>
                </button>
              );
            })}
          </div>
          {/* PC: Card layout (original) */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {visibleActions.map((action) => {
              const IconComponent = action.icon;
              return (
                <div
                  key={action.id}
                  className="bg-white border-2 border-black rounded-lg p-4 md:p-6 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleQuickAction(action.path)}
                >
                  {/* Icon and Text Section */}
                  <div className="flex items-start gap-4 mb-4">
                    {/* Icon */}
                    <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>

                    {/* Title and Description */}
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-800 mb-1">
                        {action.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {action.description}
                      </p>
                    </div>
                  </div>

                  {/* Access Button - Full width rectangle with rounded corners */}
                  <button className="w-full py-2.5 px-4 border-2 border-black bg-white text-black rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm cursor-pointer">
                    {t('access')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountManagementPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8">Loading...</div>}>
      <AccountManagementContent />
    </Suspense>
  );
}
