'use client';

type TabType = 'signin' | 'signup';

interface AuthTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isLoading?: boolean;
}

export function AuthTabs({ activeTab, onTabChange, isLoading = false }: AuthTabsProps) {
  return (
    <div className="flex mb-6 border-b-2 border-black">
      <button
        type="button"
        onClick={() => onTabChange('signin')}
        disabled={isLoading}
        className={`flex-1 py-3 px-4 font-medium transition-colors cursor-pointer ${
          activeTab === 'signin'
            ? 'border-b-4 border-black bg-white'
            : 'bg-white hover:bg-gray-50'
        } disabled:opacity-50`}
      >
        Sign In
      </button>
      <button
        type="button"
        onClick={() => onTabChange('signup')}
        disabled={isLoading}
        className={`flex-1 py-3 px-4 font-medium transition-colors cursor-pointer ${
          activeTab === 'signup'
            ? 'border-b-4 border-black bg-white'
            : 'bg-white hover:bg-gray-50'
        } disabled:opacity-50`}
      >
        Sign Up
      </button>
    </div>
  );
}

