'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { useAuth } from '@/contexts/AuthContext';
import { useReferralOptions } from '@/hooks/useReferralOptions';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import { US_PHONE_REGEX } from '@/lib/schemas/auth';
import {
  REFERRAL_BY_FRIEND,
  REFERRAL_BY_PREVIOUS_CUSTOMER,
  REFERRAL_OTHER,
  REFERRAL_PREVIOUS_CUSTOMER,
  referralNeedsDetail,
} from '@/lib/constants/referral';
import { readAfterFinishDestination } from '@/lib/auth/finishSetup';

interface Draft {
  referral: string;
  referralOther: string;
  phone: string;
}

function draftKey(userId: string) {
  return `hph-finish-setup:${userId}`;
}

function readDraft(userId: string): Draft {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return { referral: '', referralOther: '', phone: '' };
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      referral: typeof parsed.referral === 'string' ? parsed.referral : '',
      referralOther: typeof parsed.referralOther === 'string' ? parsed.referralOther : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
    };
  } catch {
    return { referral: '', referralOther: '', phone: '' };
  }
}

/**
 * Blocks the Hub until a new Google customer answers how they heard about us,
 * adds a phone number, and accepts the terms. Closing keeps the account.
 * The next Google sign-in or sign-up opens this same screen.
 */
export function FinishAccountSetupGate() {
  const { user, isLoading, logout, applyAccountSetup } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const pending = user?.accountSetupPending === true;

  useEffect(() => {
    if (isLoading || !pending) return;
    const finishPath = `/${locale}/signup/finish`;
    if (pathname === finishPath) return;
    router.replace(finishPath);
  }, [isLoading, pending, pathname, locale, router]);

  if (!pending || !user) return null;

  return (
    <FinishAccountSetupModal
      userId={user.id}
      email={user.email}
      name={[user.firstName, user.lastName].filter(Boolean).join(' ')}
      onLeave={async () => {
        await logout();
        router.replace(`/${locale}/signin`);
      }}
      onFinished={(patch) => {
        localStorage.removeItem(draftKey(user.id));
        applyAccountSetup(patch);
        router.replace(readAfterFinishDestination(locale));
      }}
    />
  );
}

interface FinishAccountSetupModalProps {
  userId: string;
  email: string;
  name: string;
  onLeave: () => Promise<void>;
  onFinished: (patch: { phone: string; referral: string; referralOther?: string }) => void;
}

function FinishAccountSetupModal({ userId, email, name, onLeave, onFinished }: FinishAccountSetupModalProps) {
  const locale = useLocale();
  const t = useTranslations('auth.finishSetup');
  const tFields = useTranslations('auth.signup.fields');
  const tTerms = useTranslations('auth.signup.terms');
  const extraReferrals = useReferralOptions();
  const [draft, setDraft] = useState<Draft>({ referral: '', referralOther: '', phone: '' });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const saved = readDraft(userId);
    const phone = saved.phone || '';
    setDraft({
      referral: saved.referral,
      referralOther: saved.referralOther,
      phone: phone ? formatPhoneNumber(phone) : '',
    });
    setDraftReady(true);
  }, [userId]);

  useEffect(() => {
    if (!draftReady) return;
    localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  }, [userId, draft, draftReady]);

  const needsDetail = referralNeedsDetail(draft.referral);
  const detailRequired = draft.referral === REFERRAL_OTHER;

  const leave = async () => {
    if (leaving || saving) return;
    setLeaving(true);
    await onLeave();
  };

  const submit = async () => {
    if (saving) return;
    setError(null);
    setFieldError(null);
    if (!draft.referral) {
      setFieldError(t('errors.referral'));
      return;
    }
    if (detailRequired && !draft.referralOther.trim()) {
      setFieldError(t('errors.referralOther'));
      return;
    }
    if (!draft.phone.trim()) {
      setFieldError(t('errors.phone'));
      return;
    }
    if (!US_PHONE_REGEX.test(draft.phone.trim())) {
      setFieldError(t('errors.phoneInvalid'));
      return;
    }
    if (!agree) {
      setFieldError(t('errors.terms'));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/auth/finish-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          referral: draft.referral,
          referralOther: draft.referralOther,
          phone: draft.phone.trim(),
          agreeToTerms: true,
          locale,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(typeof body.error === 'string' ? body.error : t('errors.generic'));
        setSaving(false);
        return;
      }
      onFinished({
        phone: draft.phone.trim(),
        referral: draft.referral,
        referralOther: draft.referralOther.trim() || undefined,
      });
    } catch {
      setError(t('errors.generic'));
      setSaving(false);
    }
  };

  const detailLabel =
    draft.referral === REFERRAL_BY_FRIEND
      ? tFields('referralFriendNameLabel')
      : draft.referral === REFERRAL_BY_PREVIOUS_CUSTOMER
        ? tFields('referralPreviousCustomerNameLabel')
        : draft.referral === REFERRAL_OTHER
          ? tFields('referralOtherLabel')
          : tFields('referralNamePlaceholder');

  return (
    <Modal
      isOpen
      onClose={() => {
        void leave();
      }}
      showHeader={false}
      showCloseButton={false}
      preventCloseOnOverlayClick
      maxWidth="md"
      contentClassName="p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-black">{t('title')}</h2>
        <button
          type="button"
          onClick={() => {
            void leave();
          }}
          disabled={leaving || saving}
          className="w-8 h-8 shrink-0 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-50"
          aria-label={t('cancel')}
        >
          <X className="w-5 h-5 text-black" />
        </button>
      </div>

      <p className="mt-3 text-sm text-gray-700">{t('subtitle')}</p>
      {(name || email) && (
        <p className="mt-2 text-sm font-medium text-black">
          {name}
          {name && email ? ' · ' : ''}
          {email}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-4">
        {error && <ErrorMessage message={error} />}
        {fieldError && <ErrorMessage message={fieldError} />}

        <FormField label={tFields('referralLabel')} required>
          <Select
            id="finish-referral"
            value={draft.referral}
            disabled={saving}
            onChange={(event) => {
              const referral = event.target.value;
              setDraft((current) => ({
                ...current,
                referral,
                referralOther: referralNeedsDetail(referral) ? current.referralOther : '',
              }));
            }}
          >
            <option value="">{tFields('referralSelectPlaceholder')}</option>
            <option value="Google">Google</option>
            <option value="Instagram">Instagram</option>
            <option value="Facebook">Facebook</option>
            <option value={REFERRAL_PREVIOUS_CUSTOMER}>{tFields('referralPreviousCustomerOption')}</option>
            <option value={REFERRAL_BY_PREVIOUS_CUSTOMER}>{tFields('referralByPreviousCustomerOption')}</option>
            <option value={REFERRAL_BY_FRIEND}>{tFields('referralByFriendOption')}</option>
            {extraReferrals.map((option) => (
              <option key={option.id} value={option.label}>
                {option.label}
              </option>
            ))}
            <option value={REFERRAL_OTHER}>{tFields('referralOtherOption')}</option>
          </Select>
        </FormField>

        {needsDetail && (
          <FormField label={detailLabel} required={detailRequired}>
            <Input
              id="finish-referral-other"
              type="text"
              value={draft.referralOther}
              showClear
              onClear={() => setDraft((current) => ({ ...current, referralOther: '' }))}
              onChange={(event) => setDraft((current) => ({ ...current, referralOther: event.target.value }))}
              placeholder={draft.referral === REFERRAL_OTHER ? tFields('referralOtherPlaceholder') : tFields('referralNamePlaceholder')}
              disabled={saving}
            />
          </FormField>
        )}

        <FormField label={tFields('phoneLabel')} required>
          <Input
            id="finish-phone"
            type="tel"
            value={draft.phone}
            showClear
            onClear={() => setDraft((current) => ({ ...current, phone: '' }))}
            onChange={(event) => setDraft((current) => ({ ...current, phone: formatPhoneNumber(event.target.value) }))}
            placeholder={tFields('phonePlaceholder')}
            disabled={saving}
          />
        </FormField>

        <label className="flex items-start">
          <input
            type="checkbox"
            checked={agree}
            onChange={(event) => setAgree(event.target.checked)}
            disabled={saving}
            className="w-4 h-4 mt-0.5 border-2 border-black rounded accent-black checked:bg-black checked:border-black"
            style={{ accentColor: 'black' }}
          />
          <span className="ml-2 text-sm text-gray-600">
            {t('termsPrefix')}{' '}
            <Link href={`/${locale}/legal/terms`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
              {tTerms('termsOfService')}
            </Link>
            {' '}{tTerms('and')}{' '}
            <Link href={`/${locale}/legal/privacy`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
              {tTerms('privacyPolicy')}
            </Link>
          </span>
        </label>

        <Button type="button" onClick={() => { void submit(); }} disabled={saving || leaving} loading={saving}>
          {saving ? t('submitting') : t('submit')}
        </Button>
        <button
          type="button"
          onClick={() => { void leave(); }}
          disabled={saving || leaving}
          className="text-sm text-gray-600 underline hover:text-black disabled:opacity-50"
        >
          {t('cancel')}
        </button>
        <p className="text-xs text-gray-500">{t('cancelHint')}</p>
      </div>
    </Modal>
  );
}
