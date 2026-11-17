import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { userCanAccessCrm } from '@/lib/crm/require-contractor';
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

  if (!(await userCanAccessCrm(user.id))) {
    redirect(`/${locale}/account-management`);
  }

  return (
    <CRMLayout locale={locale}>
      {children}
    </CRMLayout>
  );
}
