import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { ADMIN_MFA_PATH, adminSessionVerified } from '@/lib/auth/admin-mfa';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { privateRobots } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  robots: privateRobots,
};

export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Check authentication (use getUser so identity is validated with Supabase Auth server)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/en/signin');
  }

  const userEmail = user.email?.toLowerCase().trim();

  if (userEmail !== ADMIN_EMAIL.toLowerCase().trim()) {
    redirect('/');
  }

  // Second layer behind proxy.ts: two-step sign-in finished in this session.
  if (!(await adminSessionVerified(supabase))) {
    redirect(`${ADMIN_MFA_PATH}?next=/admin`);
  }

  return <AdminLayout userEmail={user.email || ''}>{children}</AdminLayout>;
}

