'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { businessStorage } from '@/lib/storage/businessStorage';
import { ProCardData } from '@/components/proscard/ProCard';
import { 
  Building2, 
  Plus, 
  ShoppingBag, 
  Calendar, 
  UserCheck, 
  CreditCard,
  Crown,
  ChevronRight,
  User,
  Bookmark,
  Edit
} from 'lucide-react';

interface Account {
  id: string;
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


// Personal account actions (for customers)
const personalActions: QuickAction[] = [
  {
    id: 'personal-1',
    title: 'Edit Profile',
    description: 'Update Profile',
    icon: Edit,
    iconBg: 'bg-black',
    iconColor: 'text-white',
    borderColor: 'border-black',
    path: '/profile/edit',
  },
  {
    id: 'personal-2',
    title: 'Saved Business',
    description: 'View Saved',
    icon: Bookmark,
    iconBg: 'bg-black',
    iconColor: 'text-white',
    borderColor: 'border-black',
    path: '/saved-businesses',
  },
];

// Business account actions (for contractors)
const businessActions: QuickAction[] = [
  {
    id: '1',
    title: 'Edit Business',
    description: 'Update Business',
    icon: Building2,
    iconBg: 'bg-black',
    iconColor: 'text-white',
    borderColor: 'border-black',
    path: '/businesslist',
  },
  {
    id: '2',
    title: 'Add Business',
    description: 'New Business',
    icon: Plus,
    iconBg: 'bg-black',
    iconColor: 'text-white',
    borderColor: 'border-black',
    path: '/businesslist?action=add',
  },
  {
    id: '3',
    title: 'Manage Shop',
    description: 'Manage Shop Items',
    icon: ShoppingBag,
    iconBg: 'bg-black',
    iconColor: 'text-white',
    borderColor: 'border-black',
    path: '/shop',
  },
  {
    id: '4',
    title: 'Manage Events',
    description: 'Curate community events',
    icon: Calendar,
    iconBg: 'bg-black',
    iconColor: 'text-white',
    borderColor: 'border-black',
    path: '/events',
  },
  {
    id: '5',
    title: 'Manage Partners',
    description: 'Manage Partnerships',
    icon: UserCheck,
    iconBg: 'bg-black',
    iconColor: 'text-white',
    borderColor: 'border-black',
    path: '/partners',
  },
  {
    id: '6',
    title: 'Manage Subscription',
    description: 'Manage Subscription',
    icon: CreditCard,
    iconBg: 'bg-black',
    iconColor: 'text-white',
    borderColor: 'border-black',
    path: '/subscription',
  },
];

export default function AccountManagementPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [userBusinesses, setUserBusinesses] = useState<ProCardData[]>([]);

  // Fetch user's businesses from storage
  useEffect(() => {
    if (user?.id) {
      const businesses = businessStorage.getBusinessesByUserId(user.id);
      setUserBusinesses(businesses);
      
      // Set initial selected account to personal account if not already set
      setSelectedAccountId(prev => prev || user.id);
    }
  }, [user?.id]);

  // Check if user is a customer (no companyName)
  const isCustomer = !user?.companyName;
  
  // Generate accounts: personal account first, then business accounts
  const visibleAccounts = useMemo(() => {
    const accounts: Account[] = [];
    
    // Always add personal account first
    if (user) {
      const personalAccount: Account = {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        type: 'personal',
        isSelected: selectedAccountId === user.id || (selectedAccountId === '' && userBusinesses.length === 0),
      };
      accounts.push(personalAccount);
    }
    
    // Add business accounts from storage (appear on the right side)
    userBusinesses.forEach((business) => {
      const businessAccount: Account = {
        id: business.id,
        name: business.businessName,
        type: 'business',
        isSelected: selectedAccountId === business.id,
        hasCrown: false, // No crown for business accounts
      };
      accounts.push(businessAccount);
    });
    
    return accounts;
  }, [user, userBusinesses, selectedAccountId]);

  // Filter quick actions based on account type
  const visibleActions = useMemo(() => {
    const selectedAccount = visibleAccounts.find(acc => acc.id === selectedAccountId);
    if (selectedAccount?.type === 'personal') {
      return personalActions;
    }
    // Show business actions for business accounts
    return businessActions;
  }, [selectedAccountId, visibleAccounts]);

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
  };

  const handleQuickAction = (path: string) => {
    router.push(path);
  };

  const getAccountIcon = (account: Account) => {
    if (account.type === 'personal') {
      return (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-gray-600" />
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
      <div className="w-full max-w-[960px] mx-auto p-2 md:p-2 py-6 md:py-8">
        {/* Select Account Section */}
        <div className="mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold text-black mb-4">Select Account</h2>
          <div className="relative">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {visibleAccounts.map((account) => (
                <button
                  key={account.id}
                  onClick={() => handleAccountSelect(account.id)}
                  className={`
                    relative flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all flex-shrink-0 cursor-pointer
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
            {/* Scroll indicator */}
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Quick Actions Section */}
        <div>
          <h2 className="text-lg md:text-xl font-bold text-black mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
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
                  <button className="w-full py-2.5 px-4 border-2 border-black bg-white text-black rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm">
                    Access
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

