'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { AccountSwitchProvider } from '@/contexts/AccountSwitchContext';
import LocaleRedirect from './LocaleRedirect';

export default function AuthProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AccountSwitchProvider>
        <LocaleRedirect />
        {children}
      </AccountSwitchProvider>
    </AuthProvider>
  );
}

