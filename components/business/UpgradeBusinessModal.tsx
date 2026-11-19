'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, HardHat, Home } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ProRoleScopeNotice } from '@/components/auth/ProRoleScopeNotice';
import { getCsrfToken } from '@/lib/utils/csrf';
import {
  isValidNevadaRealtorLicenseNumber,
  nevadaRealtorLicenseHint,
  normalizeNevadaRealtorLicenseNumber,
} from '@/lib/utils/nevadaRealtorLicense';

type UpgradeRole = 'contractor' | 'realtor';

interface LicenseCategory {
  code: string;
  name: string;
  requires_contractor_license: boolean;
  sort_order: number;
  role?: 'contractor' | 'realtor';
}

export interface BusinessLicense {
  license: string;
  licenseNumber: string;
}

export interface UpgradeResult {
  accountRole: UpgradeRole;
  businessName: string;
  licenses: BusinessLicense[];
}

interface UpgradeBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  businessName: string;
  /** Licenses already saved on this business. */
  licenses: BusinessLicense[];
  onUpgraded: (result: UpgradeResult) => void | Promise<void>;
}

const OPTIONS: { role: UpgradeRole; label: string; blurb: string; Icon: typeof HardHat }[] = [
  { role: 'contractor', label: 'Contractor', blurb: 'Nevada contractor license', Icon: HardHat },
  { role: 'realtor', label: 'Realtor', blurb: 'Nevada real estate license', Icon: Home },
];

/**
 * Handyman and installer businesses upgrade to contractor or realtor here.
 * Shows only what this business still needs: the invitation code, the license
 * for the new role (skipped when one is already on file), and for realtors the brokerage name.
 */
export function UpgradeBusinessModal({
  isOpen,
  onClose,
  businessId,
  businessName,
  licenses,
  onUpgraded,
}: UpgradeBusinessModalProps) {
  const [role, setRole] = useState<UpgradeRole | null>(null);
  const [categories, setCategories] = useState<LicenseCategory[]>([]);
  const [licenseType, setLicenseType] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  // The page mounts this fresh each time it opens, so initial state is the reset.
  const [brokerageName, setBrokerageName] = useState(businessName);
  const [invitationCode, setInvitationCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseRole = (next: UpgradeRole) => {
    if (next === role) return;
    setRole(next);
    setCategories([]);
    setLicenseType('');
    setLicenseNumber('');
    setError(null);
  };

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    fetch(`/api/license-categories?role=${role}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.categories) ? (data.categories as LicenseCategory[]) : [];
        setCategories(
          (role === 'contractor' ? list.filter((c) => c.requires_contractor_license) : list).sort(
            (a, b) => a.sort_order - b.sort_order
          )
        );
      })
      .catch(() => !cancelled && setCategories([]));
    return () => {
      cancelled = true;
    };
  }, [role]);

  /** A license already on this business that qualifies for the chosen role. */
  const licenseOnFile = useMemo(() => {
    if (!role || categories.length === 0) return null;
    const codes = new Map(categories.map((c) => [c.code, c.name]));
    const match = licenses.find((l) => codes.has(l.license));
    return match ? { ...match, name: codes.get(match.license) || match.license } : null;
  }, [role, categories, licenses]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    // Keep the submit from bubbling (through the portal) into a surrounding form.
    event.stopPropagation();
    if (!role || busy) return;
    setError(null);

    const code = invitationCode.trim().toUpperCase();
    if (!code) {
      setError('Enter the invitation code from House Pros Hub.');
      return;
    }

    let license: BusinessLicense | undefined;
    if (!licenseOnFile) {
      if (!licenseType) {
        setError(role === 'contractor' ? 'Choose a contractor license classification.' : 'Choose your Nevada license type.');
        return;
      }
      const number = role === 'realtor' ? normalizeNevadaRealtorLicenseNumber(licenseNumber) : licenseNumber.trim();
      if (!number) {
        setError('Enter your license number.');
        return;
      }
      if (role === 'realtor' && !isValidNevadaRealtorLicenseNumber(number, licenseType)) {
        setError(nevadaRealtorLicenseHint(licenseType));
        return;
      }
      license = { license: licenseType, licenseNumber: number };
    }

    if (role === 'realtor' && !brokerageName.trim()) {
      setError('Enter your brokerage name (required on Nevada ads).');
      return;
    }

    setBusy(true);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`/api/businesses/${businessId}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        credentials: 'include',
        body: JSON.stringify({
          role,
          invitationCode: code,
          license,
          brokerageName: role === 'realtor' ? brokerageName.trim() : undefined,
          csrfToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to upgrade business');
      }
      await onUpgraded({
        accountRole: role,
        businessName: typeof data.businessName === 'string' ? data.businessName : businessName,
        licenses: Array.isArray(data.licenses) ? data.licenses : licenses,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upgrade business');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title="Upgrade business"
      maxWidth="md"
      preventCloseOnOverlayClick={busy}
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <p className="text-sm text-gray-600">
          Upgrade <span className="font-semibold text-black">{businessName}</span> to a contractor or
          realtor business. The license is attached to this business and the card shows the new role.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {OPTIONS.map(({ role: option, label, blurb, Icon }) => {
            const active = role === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => chooseRole(option)}
                disabled={busy}
                className={`flex flex-col items-start gap-1 rounded-lg border-2 border-black px-3 py-3 text-left transition-colors cursor-pointer ${
                  active ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'
                }`}
                aria-pressed={active}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-red-500'}`} />
                  {label}
                </span>
                <span className={`text-xs ${active ? 'text-gray-200' : 'text-gray-500'}`}>{blurb}</span>
              </button>
            );
          })}
        </div>

        {role ? (
          <>
            <ProRoleScopeNotice role={role} />

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-black uppercase tracking-wider">What is missing</h3>
              <p className="text-xs text-gray-500">Fill these in so this business shows as a {role}.</p>
            </div>

            {licenseOnFile ? (
              <div className="flex items-start gap-2 rounded-lg border-2 border-green-600 bg-green-50 px-3 py-2 text-sm text-green-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  License on file: {licenseOnFile.name}
                  {licenseOnFile.licenseNumber ? ` #${licenseOnFile.licenseNumber}` : ''}
                </span>
              </div>
            ) : role === 'contractor' ? (
              <>
                <FormField label="License classification" required>
                  <Select value={licenseType} onChange={(e) => setLicenseType(e.target.value)} disabled={busy}>
                    <option value="">Select…</option>
                    {categories.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code} - {item.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Contractor license number" required>
                  <Input
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="Enter license number"
                    disabled={busy}
                  />
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Nevada license type" required tip="From the Nevada Real Estate Division (NRS 645).">
                  <Select value={licenseType} onChange={(e) => setLicenseType(e.target.value)} disabled={busy}>
                    <option value="">Select…</option>
                    {categories.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Nevada license number" required tip={nevadaRealtorLicenseHint(licenseType || null)}>
                  <Input
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(normalizeNevadaRealtorLicenseNumber(e.target.value))}
                    placeholder={nevadaRealtorLicenseHint(licenseType || null)}
                    disabled={busy}
                  />
                </FormField>
              </>
            )}

            {role === 'realtor' ? (
              <FormField
                label="Brokerage name"
                required
                tip="Nevada ads must show the brokerage name. It becomes this business's name on the card."
              >
                <Input value={brokerageName} onChange={(e) => setBrokerageName(e.target.value)} disabled={busy} />
              </FormField>
            ) : null}

            <FormField label="Invitation code" required tip="Ask House Pros Hub for a contractor or realtor code.">
              <Input
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                placeholder="Enter your invitation code"
                autoComplete="off"
                disabled={busy}
              />
            </FormField>
          </>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={!role || busy}>
            {busy ? 'Upgrading…' : role ? `Upgrade to ${role === 'contractor' ? 'Contractor' : 'Realtor'}` : 'Upgrade'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
