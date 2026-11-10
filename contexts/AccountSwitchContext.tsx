'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { ProCardData } from '@/components/proscard/ProCard';

const STORAGE_KEY = 'hph-active-account';

export interface SwitchAccount {
  id: string;
  type: 'personal' | 'business';
  name: string;
  avatar?: string;
  slug?: string;
  email?: string;
}

export type OwnedBusiness = ProCardData & { userId?: string };

interface AccountSwitchContextValue {
  businesses: OwnedBusiness[];
  businessesLoading: boolean;
  accounts: SwitchAccount[];
  activeAccount: SwitchAccount | null;
  activeAccountId: string;
  setActiveAccountId: (accountId: string) => void;
  refreshBusinesses: () => void;
}

const AccountSwitchContext = createContext<AccountSwitchContextValue | undefined>(undefined);

function readStoredAccountId(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; accountId?: string };
    if (parsed.userId !== userId || !parsed.accountId) return null;
    return parsed.accountId;
  } catch {
    return null;
  }
}

function writeStoredAccountId(userId: string, accountId: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, accountId }));
}

export function AccountSwitchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [businesses, setBusinesses] = useState<OwnedBusiness[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [readyUserId, setReadyUserId] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [override, setOverride] = useState<{ userId: string; accountId: string } | null>(null);
  /** Keep a just-picked account that is not in the list yet until the next load finishes. */
  const holdMissingId = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!userId) return;
    setOverride((current) => {
      if (current?.userId === userId) return current;
      return { userId, accountId: readStoredAccountId(userId) || userId };
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setBusinesses([]);
      setBusinessesLoading(false);
      setReadyUserId('');
      return;
    }

    let cancelled = false;
    setBusinesses((current) => current.filter((business) => business.userId === userId));
    setBusinessesLoading(true);
    fetch('/api/me/businesses/list', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { businesses: [] }))
      .then((data) => {
        if (cancelled) return;
        const list = ((data.businesses ?? []) as OwnedBusiness[]).map((business) => ({
          ...business,
          userId,
        }));
        setBusinesses(list);
      })
      .catch((error) => {
        console.error('Error loading accounts:', error);
        if (!cancelled) setBusinesses([]);
      })
      .finally(() => {
        if (cancelled) return;
        holdMissingId.current = null;
        setBusinessesLoading(false);
        setReadyUserId(userId);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const activeAccountId =
    userId && override?.userId === userId ? override.accountId : userId;

  const accounts = useMemo<SwitchAccount[]>(() => {
    if (!user) return [];
    const personalName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Personal';
    const list: SwitchAccount[] = [
      {
        id: user.id,
        type: 'personal',
        name: personalName,
        avatar: user.userPicture,
        email: user.email,
      },
    ];
    businesses.forEach((business) => {
      list.push({
        id: business.id,
        type: 'business',
        name: business.businessName?.trim() || 'Business',
        avatar: business.logo || business.businessLogo,
        slug: business.slug,
      });
    });
    return list;
  }, [user, businesses]);

  const businessesReady = readyUserId === userId && !businessesLoading;

  useEffect(() => {
    if (!userId || !businessesReady) return;
    if (activeAccountId === userId) return;
    if (holdMissingId.current === activeAccountId) return;
    if (businesses.some((business) => business.id === activeAccountId)) return;
    writeStoredAccountId(userId, userId);
    setOverride({ userId, accountId: userId });
  }, [userId, businessesReady, businesses, activeAccountId]);

  const setActiveAccountId = useCallback(
    (accountId: string) => {
      if (!userId) return;
      writeStoredAccountId(userId, accountId);
      const known =
        accountId === userId || businesses.some((business) => business.id === accountId);
      holdMissingId.current = known ? null : accountId;
      setOverride({ userId, accountId });
    },
    [userId, businesses]
  );

  const refreshBusinesses = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const activeAccount = accounts.find((account) => account.id === activeAccountId) ?? null;

  const value = useMemo<AccountSwitchContextValue>(
    () => ({
      businesses,
      businessesLoading,
      accounts,
      activeAccount,
      activeAccountId,
      setActiveAccountId,
      refreshBusinesses,
    }),
    [
      businesses,
      businessesLoading,
      accounts,
      activeAccount,
      activeAccountId,
      setActiveAccountId,
      refreshBusinesses,
    ]
  );

  return <AccountSwitchContext.Provider value={value}>{children}</AccountSwitchContext.Provider>;
}

export function useAccountSwitch() {
  const context = useContext(AccountSwitchContext);
  if (!context) {
    throw new Error('useAccountSwitch must be used within an AccountSwitchProvider');
  }
  return context;
}
