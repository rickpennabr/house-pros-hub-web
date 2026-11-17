'use client';

import { useEffect, useState } from 'react';
import { Share2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
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
  onShareBusiness: (account: SwitchAccount) => void;
}

/** 2px outside the avatar's black border. Stroke is 2px, so the box extends 4px. */
const SWITCH_RING =
  'M 12 1 H 28 A 11 11 0 0 1 39 12 V 28 A 11 11 0 0 1 28 39 H 12 A 11 11 0 0 1 1 28 V 12 A 11 11 0 0 1 12 1 Z';
/** One lap starting at the middle of the right side, so the tip never reverses. */
const SWITCH_RING_RIGHT =
  'M 39 20 V 28 A 11 11 0 0 1 28 39 H 12 A 11 11 0 0 1 1 28 V 12 A 11 11 0 0 1 12 1 H 28 A 11 11 0 0 1 39 12 V 20 Z';
/** One lap starting at the middle of the left side. */
const SWITCH_RING_LEFT =
  'M 1 20 V 12 A 11 11 0 0 1 12 1 H 28 A 11 11 0 0 1 39 12 V 28 A 11 11 0 0 1 28 39 H 12 A 11 11 0 0 1 1 28 V 20 Z';

/**
 * Red border around an account you can switch to.
 * The stroke and the arrows run along that border, the same way the camera outline does.
 */
function SwitchableAvatar({
  src,
  name,
  className,
  textClassName,
}: {
  src?: string;
  name: string;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <svg
        aria-hidden
        viewBox="0 0 40 40"
        className="pointer-events-none absolute -inset-1 z-20 overflow-visible"
      >
        <path
          d={SWITCH_RING}
          fill="none"
          stroke="#DC2626"
          strokeWidth="2"
          strokeLinejoin="round"
          pathLength="100"
          strokeDasharray="38 12"
          strokeLinecap="butt"
          className="account-ring-travel"
        />
        <g>
          <polygon points="0,-4.6 13.2,0 0,0" fill="#DC2626" />
          <animateMotion dur="1.4s" repeatCount="1" rotate="auto" fill="freeze" path={SWITCH_RING_RIGHT} />
        </g>
        <g>
          <polygon points="0,-4.6 13.2,0 0,0" fill="#DC2626" />
          <animateMotion dur="1.4s" repeatCount="1" rotate="auto" fill="freeze" path={SWITCH_RING_LEFT} />
        </g>
      </svg>
      <AccountAvatar src={src} name={name} className={`relative z-10 ${className ?? ''}`} textClassName={textClassName} />
    </span>
  );
}

export function BusinessAccountTools({ onShare }: { onShare: () => void }) {
  const t = useTranslations('common.account');
  return (
    <span className="ml-auto flex shrink-0 items-center">
      <button
        type="button"
        aria-label={t('shareBusiness')}
        title={t('shareBusiness')}
        onClick={(event) => {
          event.stopPropagation();
          onShare();
        }}
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-red-600 hover:bg-red-50"
      >
        <Share2 className="h-4 w-4" />
      </button>
    </span>
  );
}

/** Other accounts under the active one, plus the control that opens the full list. */
export function AccountSwitchRows({ onOpenList, onSwitched, onShareBusiness }: AccountSwitchRowsProps) {
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
    <div className="px-2 py-2">
      {quick.map((account) => (
        <div key={account.id} className="flex items-center rounded-lg hover:bg-gray-50">
          <button
            type="button"
            onClick={() => switchTo(account)}
            title={t('switchAccount')}
            aria-label={t('switchAccount')}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-2 py-2.5 text-left text-sm font-medium text-black"
          >
            <SwitchableAvatar src={account.avatar} name={account.name} className="w-8 h-8" textClassName="text-[10px]" />
            <span className="truncate">{account.name}</span>
          </button>
          {account.type === 'business' && (
            <BusinessAccountTools onShare={() => onShareBusiness(account)} />
          )}
        </div>
      ))}
      {showSeeAll && (
        <button
          type="button"
          onClick={onOpenList}
          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3 text-sm font-medium text-black cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0">
            {hiddenBusinesses > 0 ? (
              <span className="text-xs font-bold text-red-600">+{hiddenBusinesses}</span>
            ) : (
              <Users className="w-4 h-4 text-red-600" />
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
      <TypingSearchInput
        value={query}
        onChange={setQuery}
        placeholder={t('searchBusinesses')}
        clearLabel="Clear search"
        className="relative mb-3"
        inputClassName="w-full rounded-lg border-2 border-black py-2 pl-9 pr-8 text-sm text-black outline-none placeholder:text-gray-500"
        iconClassName="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500"
      />
      {businesses.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
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
                {selected ? (
                  <AccountAvatar src={account.avatar} name={account.name} className="w-9 h-9" />
                ) : (
                  <SwitchableAvatar src={account.avatar} name={account.name} className="w-9 h-9" />
                )}
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
