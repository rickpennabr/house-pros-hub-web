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

  return <AdminLayout userEmail={user.email || ''}>{children}</AdminLayout>;
}

