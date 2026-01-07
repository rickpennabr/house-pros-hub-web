'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import LocaleRedirect from './LocaleRedirect';

export default function AuthProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <LocaleRedirect />
      {children}
    </AuthProvider>
  );
}

