'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { createLocalePath } from '@/lib/redirect';
import { useTranslations } from 'next-intl';
import BusinessDetailsHeader from '@/components/businessdetails/BusinessDetailsHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import ProEstimateBookingFlow from '@/components/probot/ProEstimateBookingFlow';
import type { GuestContactData } from '@/components/probot/ProEstimateBookingFlow';

export default function BookBySlugPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const searchParams = useSearchParams();
  const initialServiceId = searchParams.get('service');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations('probot.booking');
  const [business, setBusiness] = useState<{
    id: string;
    businessName: string;
    logo?: string;
    contractorType?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** For guests: collect name/email before showing calendar */
  const [guestContact, setGuestContact] = useState<GuestContactData | null>(null);
  const [showBookingFlow, setShowBookingFlow] = useState(false);
  const [guestForm, setGuestForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });

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
        const b = data.business as {
          id?: string;
          businessName?: string;
          logo?: string;
          contractorType?: string;
          showCalendarOnProCard?: boolean;
        } | undefined;
        if (!b?.id || !b?.businessName) {
          setError('Business not found');
          setBusiness(null);
          return;
        }
        setBusiness({
          id: b.id,
          businessName: b.businessName,
          logo: b.logo,
          contractorType: b.contractorType,
        });
        setError(null);
      } catch (e) {
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

  const handleGuestContinue = () => {
    const firstName = guestForm.firstName.trim();
    const lastName = guestForm.lastName.trim();
    const email = guestForm.email.trim().toLowerCase();
    if (!firstName || !lastName || !email) {
      setError('Please enter your first name, last name, and email.');
      return;
    }
    setGuestContact({
      firstName,
      lastName,
      email,
      phone: guestForm.phone.trim(),
      streetAddress: '',
      city: '',
      state: '',
      zipCode: '',
    });
    setShowBookingFlow(true);
    setError(null);
  };

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

  const BookPageLayout = ({ children }: { children: React.ReactNode }): React.ReactElement => (
    <div className="w-full min-h-screen bg-white">
      <BusinessDetailsHeader
        logo={business.logo}
        businessName={business.businessName}
        contractorType={t('bookSubtitle')}
      />
      <div className="w-full border-b-2 border-black bg-white p-2 md:p-2">
        {children}
      </div>
    </div>
  );

  if (!isAuthenticated && !showBookingFlow) {
    return (
      <BookPageLayout>
        <p className="text-gray-600 mb-6">{t('guestFormSubtitle')}</p>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
            <Input
              type="text"
              value={guestForm.firstName}
              onChange={(e) => setGuestForm((f) => ({ ...f, firstName: e.target.value }))}
              placeholder="First name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
            <Input
              type="text"
              value={guestForm.lastName}
              onChange={(e) => setGuestForm((f) => ({ ...f, lastName: e.target.value }))}
              placeholder="Last name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              type="email"
              value={guestForm.email}
              onChange={(e) => setGuestForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone (optional)</label>
            <Input
              type="tel"
              value={guestForm.phone}
              onChange={(e) => setGuestForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone"
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-full"
            onClick={handleGuestContinue}
          >
            {t('continueToCalendar')}
          </Button>
        </div>
      </BookPageLayout>
    );
  }

  return (
    <BookPageLayout>
      <ProEstimateBookingFlow
        businessId={business.id}
        businessName={business.businessName}
        isAuthenticated={!!isAuthenticated}
        guestContact={guestContact}
        initialServiceId={initialServiceId}
        onSuccess={() => router.push(createLocalePath(locale as 'en' | 'es' | 'pt', '/'))}
        onCancel={() => {
          if (!isAuthenticated) setShowBookingFlow(false);
        }}
      />
    </BookPageLayout>
  );
}
