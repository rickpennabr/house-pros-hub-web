'use client';

import { useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { useAccountSwitch, type SwitchAccount } from '@/contexts/AccountSwitchContext';
import { AccountAvatar } from '@/components/pageslayout/AccountAvatar';

function otherAccounts(accounts: SwitchAccount[], activeAccountId: string): SwitchAccount[] {
  const rest = accounts.filter((account) => account.id !== activeAccountId);
  const personal = rest.filter((account) => account.type === 'personal');
  const businesses = rest.filter((account) => account.type === 'business');
  return [...personal, ...businesses];
}

interface AccountSwitchRowsProps {
  onOpenList: () => void;
  onSwitched: () => void;
}

/** Other accounts under the active one, plus the control that opens the full list. */
export function AccountSwitchRows({ onOpenList, onSwitched }: AccountSwitchRowsProps) {
  const t = useTranslations('common.account');
  const { accounts, activeAccount, activeAccountId, setActiveAccountId } = useAccountSwitch();
  const businesses = accounts.filter((account) => account.type === 'business');
  const quick = otherAccounts(accounts, activeAccountId).slice(0, 2);
  const showSeeAll = businesses.length > 2;
  if (quick.length === 0 && !showSeeAll) return null;

  const shownBusinessIds = new Set(
    quick.filter((account) => account.type === 'business').map((account) => account.id)
  );
  if (activeAccount?.type === 'business') shownBusinessIds.add(activeAccount.id);
  const hiddenBusinesses = businesses.filter((business) => !shownBusinessIds.has(business.id)).length;

  const switchTo = (account: SwitchAccount) => {
    if (account.id !== activeAccountId) setActiveAccountId(account.id);
    onSwitched();
  };

  return (
    <div className="px-2 py-1">
      {quick.map((account) => (
        <button
          key={account.id}
          type="button"
          onClick={() => switchTo(account)}
          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 text-sm font-medium text-black cursor-pointer"
        >
          <AccountAvatar src={account.avatar} name={account.name} className="w-8 h-8" textClassName="text-[10px]" />
          <span className="truncate">{account.name}</span>
        </button>
      ))}
      {showSeeAll && (
        <button
          type="button"
          onClick={onOpenList}
          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 text-sm font-medium text-black cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0">
            {hiddenBusinesses > 0 ? (
              <span className="text-xs font-bold text-black">+{hiddenBusinesses}</span>
            ) : (
              <Users className="w-4 h-4" />
            )}
          </div>
          <span className="truncate">{t('seeAllBusinesses')}</span>
        </button>
      )}
    </div>
  );
}

interface AccountSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountSwitchModal({ isOpen, onClose }: AccountSwitchModalProps) {
  const t = useTranslations('common.account');
  const { accounts, activeAccountId, setActiveAccountId } = useAccountSwitch();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  if (!isOpen) return null;

  const businesses = accounts.filter((account) => {
    if (account.type !== 'business') return false;
    const needle = query.trim().toLowerCase();
    return !needle || account.name.toLowerCase().includes(needle);
  });

  const switchTo = (account: SwitchAccount) => {
    if (account.id !== activeAccountId) setActiveAccountId(account.id);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('seeAllBusinesses')}
      showHeader
      maxWidth="lg"
      contentClassName="p-3"
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchBusinesses')}
          className="w-full rounded-lg border-2 border-black py-2 pl-9 pr-3 text-sm text-black outline-none"
        />
      </div>
      {businesses.length > 0 ? (
        <div className="grid grid-cols-2 gap-1">
          {businesses.map((account) => {
            const selected = account.id === activeAccountId;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => switchTo(account)}
                aria-current={selected ? 'true' : undefined}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 text-left cursor-pointer ${
                  selected ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <AccountAvatar src={account.avatar} name={account.name} className="w-9 h-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-black">{account.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-gray-600">{t('businessAccount')}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-gray-500">{t('noBusinessesFound')}</p>
      )}
    </Modal>
  );
}
