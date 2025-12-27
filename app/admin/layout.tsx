import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { AdminLayout } from '@/components/admin/AdminLayout';

export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Redirect to sign-in if not authenticated
  if (!session) {
    redirect('/en/signin');
  }

  // Get user email from session
  const userEmail = session.user.email?.toLowerCase().trim();

  // Check if user is admin (case-insensitive comparison)
  if (userEmail !== ADMIN_EMAIL.toLowerCase().trim()) {
    // Redirect non-admin users to home
    redirect('/');
  }

  // Pass user email to AdminLayout
  return <AdminLayout userEmail={session.user.email || ''}>{children}</AdminLayout>;
}

