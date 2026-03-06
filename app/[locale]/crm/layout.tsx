import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
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
