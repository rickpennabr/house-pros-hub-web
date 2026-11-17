'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { HardHat, Hand, Home, Wrench } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { getCsrfToken } from '@/lib/utils/csrf';
import { createLocalePath } from '@/lib/redirect';
import {
  PRO_ACCOUNT_ROLES,
  proAccountRoleLabel,
  roleRequiresInvitation,
  type ProAccountRole,
} from '@/lib/utils/proAccountRole';
import { ProRoleScopeNotice } from '@/components/auth/ProRoleScopeNotice';
import type { Locale } from '@/i18n';

interface ChangeProRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: ProAccountRole | string | null;
  onChanged: (role: ProAccountRole) => void | Promise<void>;
}

const ROLE_ICONS: Record<ProAccountRole, React.ComponentType<{ className?: string }>> = {
  contractor: HardHat,
  realtor: Home,
  installer: Wrench,
  handyman: Hand,
};

export function ChangeProRoleModal({
  isOpen,
  onClose,
  currentRole,
  onChanged,
}: ChangeProRoleModalProps) {
  const locale = useLocale();
  const router = useRouter();
  const [selected, setSelected] = useState<ProAccountRole | null>(
    (currentRole as ProAccountRole) || null
  );
  const [invitationCode, setInvitationCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelected((currentRole as ProAccountRole) || null);
    setInvitationCode('');
    setError(null);
    setBusy(false);
  }, [isOpen, currentRole]);

  const needsCode = selected ? roleRequiresInvitation(selected) : false;
  const sameRole = selected && selected === currentRole;

  const handleContinue = async () => {
    if (!selected || sameRole || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (needsCode) {
        const code = invitationCode.trim();
        if (!code) {
          setError('Enter the invitation code for this role.');
          setBusy(false);
          return;
        }
        const res = await fetch('/api/auth/validate-invitation-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code, role: selected }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.valid) {
          throw new Error(typeof data.error === 'string' ? data.error : 'Invalid invitation code');
        }
        onClose();
        router.push(
          createLocalePath(
            locale as Locale,
            `/upgrade-role?role=${encodeURIComponent(selected)}&code=${encodeURIComponent(code.trim().toUpperCase())}`
          )
        );
        return;
      }

      const csrfToken = await getCsrfToken();
      const res = await fetch('/api/profile/roles/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ role: selected, csrfToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to change role');
      }
      await onChanged(selected);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      title="Change professional role"
      maxWidth="md"
      preventCloseOnOverlayClick={busy}
    >
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-600">
          This is the role shown under your business name. Becoming a contractor or realtor
          needs an invitation code and a short role form.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRO_ACCOUNT_ROLES.map((role) => {
            const Icon = ROLE_ICONS[role];
            const active = selected === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => {
                  setSelected(role);
                  setError(null);
                }}
                className={`flex items-center gap-2 rounded-lg border-2 px-3 py-3 text-left transition-colors cursor-pointer ${
                  active ? 'border-black bg-black text-white' : 'border-black bg-white text-black hover:bg-gray-50'
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-red-500'}`} />
                <span className="text-sm font-medium">{proAccountRoleLabel(role)}</span>
              </button>
            );
          })}
        </div>

        {selected ? <ProRoleScopeNotice role={selected} /> : null}

        {needsCode && !sameRole ? (
          <FormField label="Invitation code" required tip="Ask House Pros Hub for a contractor or realtor code.">
            <Input
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
              placeholder="Enter your invitation code"
              autoComplete="off"
            />
          </FormField>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleContinue()}
            disabled={!selected || !!sameRole || busy}
          >
            {busy
              ? 'Working…'
              : needsCode && !sameRole
                ? 'Continue to form'
                : 'Save role'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
