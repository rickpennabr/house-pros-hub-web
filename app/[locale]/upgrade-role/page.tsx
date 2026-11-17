'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/contexts/AuthContext';
import { getCsrfToken } from '@/lib/utils/csrf';
import { createLocalePath } from '@/lib/redirect';
import {
  isProAccountRole,
  proAccountRoleLabel,
  roleRequiresInvitation,
  type ProAccountRole,
} from '@/lib/utils/proAccountRole';
import {
  isValidNevadaRealtorLicenseNumber,
  nevadaRealtorLicenseHint,
  normalizeNevadaRealtorLicenseNumber,
} from '@/lib/utils/nevadaRealtorLicense';
import { ProRoleScopeNotice } from '@/components/auth/ProRoleScopeNotice';
import type { Locale } from '@/i18n';

interface LicenseCategory {
  code: string;
  name: string;
  requires_contractor_license: boolean;
  sort_order: number;
  role?: 'contractor' | 'realtor';
}

export default function UpgradeRolePage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, refreshRoles } = useAuth();

  const roleParam = searchParams.get('role') || '';
  const codeParam = searchParams.get('code') || '';
  const role = isProAccountRole(roleParam) ? roleParam : null;

  const [categories, setCategories] = useState<LicenseCategory[]>([]);
  const [licenseType, setLicenseType] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [brokerageName, setBrokerageName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(
        createLocalePath(
          locale as Locale,
          `/signin?returnUrl=${encodeURIComponent(`/upgrade-role?role=${roleParam}&code=${codeParam}`)}`
        )
      );
    }
  }, [isAuthenticated, isLoading, locale, router, roleParam, codeParam]);

  useEffect(() => {
    if (role !== 'contractor' && role !== 'realtor') return;
    fetch(`/api/license-categories?role=${role}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = Array.isArray(data?.categories) ? (data.categories as LicenseCategory[]) : [];
        setCategories(
          role === 'contractor'
            ? list.filter((item) => item.requires_contractor_license)
            : list
        );
      })
      .catch(() => setCategories([]));
  }, [role]);

  const licenseOptions = useMemo(
    () => [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!role || busy) return;
    if (roleRequiresInvitation(role) && !codeParam.trim()) {
      setError('Invitation code missing. Start again from your card.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const csrfToken = await getCsrfToken();
      const body: Record<string, unknown> = {
        role,
        invitationCode: codeParam.trim().toUpperCase() || undefined,
        csrfToken,
      };

      if (role === 'contractor') {
        if (!licenseType.trim()) {
          throw new Error('Choose a contractor license classification.');
        }
        if (!licenseNumber.trim()) {
          throw new Error('Enter your contractor license number.');
        }
        body.licenses = [{ license: licenseType.trim(), licenseNumber: licenseNumber.trim() }];
      }

      if (role === 'realtor') {
        if (!licenseType.trim()) {
          throw new Error('Choose your Nevada real estate license type.');
        }
        const normalized = normalizeNevadaRealtorLicenseNumber(licenseNumber);
        if (!isValidNevadaRealtorLicenseNumber(normalized, licenseType)) {
          throw new Error(nevadaRealtorLicenseHint(licenseType));
        }
        if (!brokerageName.trim()) {
          throw new Error('Enter your brokerage name (required on Nevada ads).');
        }
        body.licenses = [{ license: licenseType.trim(), licenseNumber: normalized }];
        body.brokerageName = brokerageName.trim();
      }

      const res = await fetch('/api/profile/roles/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to upgrade role');
      }
      await refreshRoles();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade role');
    } finally {
      setBusy(false);
    }
  };

  if (!role || !roleRequiresInvitation(role)) {
    return (
      <AuthPageLayout>
        <div className="max-w-md mx-auto p-6 space-y-4">
          <h1 className="text-2xl font-semibold text-black">Upgrade role</h1>
          <p className="text-sm text-gray-600">
            This page is only for becoming a contractor or realtor with an invitation code.
          </p>
          <Button
            type="button"
            onClick={() => router.push(createLocalePath(locale as Locale, '/businesslist'))}
          >
            Back to directory
          </Button>
        </div>
      </AuthPageLayout>
    );
  }

  if (done) {
    return (
      <AuthPageLayout>
        <div className="max-w-md mx-auto p-6 space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-black">You are now a {proAccountRoleLabel(role)}</h1>
          <p className="text-sm text-gray-600">
            Your card will show this role under the business name.
          </p>
          <Button
            type="button"
            onClick={() => router.push(createLocalePath(locale as Locale, '/businesslist'))}
          >
            View directory
          </Button>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <div className="max-w-md mx-auto p-4 md:p-6 space-y-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div>
          <h1 className="text-2xl font-semibold text-black">
            Become a {proAccountRoleLabel(role)}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {role === 'contractor'
              ? 'Contractors need a Nevada contractor license classification and number.'
              : 'Nevada realtors need an NRED license (Salesperson, Broker-salesperson, or Broker) plus the brokerage name used in ads. No contractor license is required.'}
          </p>
        </div>

        <ProRoleScopeNotice role={role} />

        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {role === 'contractor' ? (
            <>
              <FormField label="License classification" required>
                <Select
                  value={licenseType}
                  onChange={(e) => setLicenseType(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {licenseOptions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Contractor license number" required>
                <Input
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  required
                />
              </FormField>
            </>
          ) : (
            <>
              <FormField label="Nevada license type" required tip="From the Nevada Real Estate Division (NRS 645).">
                <Select
                  value={licenseType}
                  onChange={(e) => setLicenseType(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {licenseOptions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Nevada license number"
                required
                tip={nevadaRealtorLicenseHint(licenseType || null)}
              >
                <Input
                  value={licenseNumber}
                  onChange={(e) =>
                    setLicenseNumber(normalizeNevadaRealtorLicenseNumber(e.target.value))
                  }
                  placeholder={nevadaRealtorLicenseHint(licenseType || null)}
                  required
                />
              </FormField>
              <FormField
                label="Brokerage name"
                required
                tip="Nevada ads must show the brokerage name prominently with your license number."
              >
                <Input
                  value={brokerageName}
                  onChange={(e) => setBrokerageName(e.target.value)}
                  required
                />
              </FormField>
            </>
          )}

          <FormField label="Invitation code">
            <Input value={codeParam} disabled readOnly />
          </FormField>

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Saving…' : `Confirm ${proAccountRoleLabel(role)}`}
          </Button>
        </form>
      </div>
    </AuthPageLayout>
  );
}
