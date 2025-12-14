'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Plus, 
  ShoppingBag, 
  Calendar, 
  UserCheck, 
  CreditCard,
  Crown,
  ChevronRight,
  User
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

const accounts: Account[] = [
  {
    id: '1',
    name: 'Anrley Rick Costa Penna',
    type: 'personal',
    isSelected: true,
  },
  {
    id: '2',
    name: 'BrazaLink - Utah',
    type: 'business',
    hasCrown: true,
  },
  {
    id: '3',
    name: 'BrazaLink - Las Vegas',
    type: 'business',
    isActive: true,
    hasCrown: true,
  },
  {
    id: '4',
    name: 'Acaraje Bites',
    type: 'business',
    hasCrown: true,
  },
];

const quickActions: QuickAction[] = [
  {
    id: '1',
    title: 'Edit Business',
    description: 'Update Business',
    icon: Building2,
    iconBg: 'bg-white',
    iconColor: 'text-black',
    borderColor: 'border-black',
    path: '/businesslist',
  },
  {
    id: '2',
    title: 'Add Business',
    description: 'New Business',
    icon: Plus,
    iconBg: 'bg-white',
    iconColor: 'text-black',
    borderColor: 'border-black',
    path: '/businesslist?action=add',
  },
  {
    id: '3',
    title: 'Manage Shop',
    description: 'Manage Shop Items',
    icon: ShoppingBag,
    iconBg: 'bg-white',
    iconColor: 'text-black',
    borderColor: 'border-black',
    path: '/shop',
  },
  {
    id: '4',
    title: 'Manage Events',
    description: 'Curate community events',
    icon: Calendar,
    iconBg: 'bg-white',
    iconColor: 'text-black',
    borderColor: 'border-black',
    path: '/events',
  },
  {
    id: '5',
    title: 'Manage Partners',
    description: 'Manage Partnerships',
    icon: UserCheck,
    iconBg: 'bg-white',
    iconColor: 'text-black',
    borderColor: 'border-black',
    path: '/partners',
  },
  {
    id: '6',
    title: 'Manage Subscription',
    description: 'Manage Subscription',
    icon: CreditCard,
    iconBg: 'bg-white',
    iconColor: 'text-black',
    borderColor: 'border-black',
    path: '/subscription',
  },
];

export default function AccountManagementPage() {
  const router = useRouter();
  const [selectedAccount, setSelectedAccount] = useState<string>('1');

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccount(accountId);
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
        <div className="mb-8 md:mb-12">
          <h2 className="text-lg md:text-xl font-bold text-black mb-4">Select Account</h2>
          <div className="relative">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {accounts.map((account) => (
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
            {quickActions.map((action) => {
              const IconComponent = action.icon;
              return (
                <div
                  key={action.id}
                  className="bg-white border-2 border-black rounded-lg p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleQuickAction(action.path)}
                >
                  {/* Icon */}
                  <div className={`w-12 h-12 ${action.iconBg} border-2 ${action.borderColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <IconComponent className={`w-6 h-6 ${action.iconColor}`} />
                  </div>

                  {/* Content: Title and Description */}
                  <div className="flex-1 flex flex-col md:flex-row md:items-center md:gap-3">
                    <div className="flex-1">
                      {/* Title */}
                      <h3 className="text-lg font-semibold text-black mb-1 md:mb-0">
                        {action.title}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-gray-600 md:inline">
                        {action.description}
                      </p>
                    </div>

                    {/* Access Button */}
                    <button className="w-full md:w-auto py-2 px-4 border-2 border-black text-black rounded-lg font-medium hover:bg-gray-50 transition-colors text-sm flex-shrink-0">
                      Access
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

