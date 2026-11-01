import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { CRMLayout } from '@/components/crm/CRMLayout';

interface CRMLayoutWrapperProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function CRMLayoutWrapper({ children, params }: CRMLayoutWrapperProps) {
  const { locale } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/${locale}/signin`);
  }

  if (user.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) {
    redirect('/admin');
  }

  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    redirect(`/${locale}/account-management`);
  }

  return (
    <CRMLayout locale={locale}>
      {children}
    </CRMLayout>
  );
}
