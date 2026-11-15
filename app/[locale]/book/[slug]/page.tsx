'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { createLocalePath } from '@/lib/redirect';
import { useTranslations } from 'next-intl';
import BusinessDetailsHeader from '@/components/businessdetails/BusinessDetailsHeader';
import ProEstimateBookingFlow from '@/components/probot/ProEstimateBookingFlow';

export default function BookBySlugPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const searchParams = useSearchParams();
  const initialServiceId = searchParams.get('service');
  const resumeConfirm = searchParams.get('step') === 'confirm';
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const t = useTranslations('probot.booking');
  const [business, setBusiness] = useState<{
    id: string;
    businessName: string;
    logo?: string;
    contractorType?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [businessEmail, setBusinessEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('Invalid link');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/businesses/${encodeURIComponent(slug)}`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Business not found');
          setBusiness(null);
          return;
        }
        const payload = data as {
          business?: {
            id?: string;
            businessName?: string;
            logo?: string;
            contractorType?: string;
            userId?: string;
            email?: string;
          };
          bookingSettings?: { enabled?: boolean };
        };
        const b = payload.business;
        if (!b?.id || !b?.businessName) {
          setError('Business not found');
          setBusiness(null);
          return;
        }
        setBookingEnabled(payload.bookingSettings?.enabled === true);
        setOwnerUserId(b.userId ?? null);
        setBusinessEmail(b.email?.trim().toLowerCase() || null);
        setBusiness({
          id: b.id,
          businessName: b.businessName,
          logo: b.logo,
          contractorType: b.contractorType,
        });
        setError(null);
      } catch {
        if (!cancelled) {
          setError('Failed to load');
          setBusiness(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Booking unavailable</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!business) return null;

  if (!bookingEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('notAccepting')}</h1>
          <p className="text-gray-600 mb-4">{t('appointmentNote')}</p>
          <Link href={`/${locale}/estimate`} className="inline-flex rounded-lg border-2 border-black bg-black px-4 py-2 text-sm font-medium text-white">
            {t('freeEstimateLink')}
          </Link>
        </div>
      </div>
    );
  }

  const BookPageLayout = ({ children }: { children: React.ReactNode }): React.ReactElement => (
    <div className="w-full min-h-screen bg-white">
      <BusinessDetailsHeader
        logo={business.logo}
        businessName={business.businessName}
        contractorType={t('bookSubtitle')}
      />
      <div className="w-full border-b-2 border-black bg-white py-2 md:p-2">
        {children}
      </div>
    </div>
  );

  const signedInEmail = user?.email?.trim().toLowerCase() || '';
  const ownsThisBusiness =
    !!user &&
    ((ownerUserId !== null && user.id === ownerUserId) ||
      (businessEmail !== null && signedInEmail === businessEmail));

  if (ownsThisBusiness) {
    return (
      <BookPageLayout>
        <p className="text-sm text-gray-800">{t('ownService')}</p>
      </BookPageLayout>
    );
  }

  const bookingReturnPath = createLocalePath(locale as 'en' | 'es' | 'pt', `/book/${slug}?step=confirm`);

  return (
    <BookPageLayout>
      <ProEstimateBookingFlow
        businessId={business.id}
        businessName={business.businessName}
        isAuthenticated={!!isAuthenticated}
        initialServiceId={initialServiceId}
        resumeConfirm={resumeConfirm}
        bookingReturnPath={bookingReturnPath}
        onSuccess={() => router.push(createLocalePath(locale as 'en' | 'es' | 'pt', '/'))}
        onCancel={() => {
          router.push(createLocalePath(locale as 'en' | 'es' | 'pt', `/business/${slug}`));
        }}
      />
    </BookPageLayout>
  );
}
