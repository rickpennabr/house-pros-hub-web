'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Pencil, User, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { TipModal } from '@/components/ui/TipModal';
import { ZoomSlider } from '@/components/ui/ZoomSlider';
import { VerticalSlider } from '@/components/ui/VerticalSlider';
import { HorizontalSlider } from '@/components/ui/HorizontalSlider';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import { SignupStepsIndicator } from '@/app/[locale]/(auth)/signup/components/SignupStepsIndicator';
import { LeavePageWarningModal } from '@/app/[locale]/(auth)/signup/components/LeavePageWarningModal';
import { useAuth } from '@/contexts/AuthContext';
import { useReferralOptions } from '@/hooks/useReferralOptions';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import { US_PHONE_REGEX } from '@/lib/schemas/auth';
import { resizeImageSquare, validateFileSize } from '@/lib/utils/image';
import {
  REFERRAL_BY_FRIEND,
  REFERRAL_BY_PREVIOUS_CUSTOMER,
  REFERRAL_OTHER,
  REFERRAL_PREVIOUS_CUSTOMER,
  referralNeedsDetail,
} from '@/lib/constants/referral';
import { readAfterFinishDestination } from '@/lib/auth/finishSetup';

interface Draft {
  step: 1 | 2;
  firstName: string;
  lastName: string;
  userPicture: string;
  referral: string;
  referralOther: string;
  phone: string;
  address: string;
  streetAddress: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
  gateCode: string;
  addressNote: string;
}

export type FinishSetupPatch = {
  phone: string;
  referral: string;
  referralOther?: string;
  firstName?: string;
  lastName?: string;
  userPicture?: string;
  streetAddress?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  gateCode?: string;
  addressNote?: string;
};

function draftKey(userId: string) {
  return `hph-finish-setup:${userId}`;
}

function emptyDraft(seed?: { firstName?: string; lastName?: string; userPicture?: string }): Draft {
  return {
    step: 1,
    firstName: seed?.firstName || '',
    lastName: seed?.lastName || '',
    userPicture: seed?.userPicture || '',
    referral: '',
    referralOther: '',
    phone: '',
    address: '',
    streetAddress: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    gateCode: '',
    addressNote: '',
  };
}

function maskZip(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function isDisplayablePicture(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed);
}

async function toEditableDataUrl(url: string): Promise<string | null> {
  if (url.startsWith('data:image/')) return url;
  try {
    const response = await fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        resolve(result.startsWith('data:image/') ? result : '');
      };
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Same scroll-parent walk as PageCategories / quick-repair. */
function findScrollParent(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      if (node.scrollHeight > node.clientHeight) return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Bring `element` to the top of its scrollport so lower fields rise into view. */
function scrollElementToScrollportTop(element: HTMLElement) {
  const scroller = findScrollParent(element);
  const top = element.getBoundingClientRect().top;
  const portTop = scroller ? scroller.getBoundingClientRect().top + scroller.clientTop : 0;
  const delta = top - portTop;
  if (Math.abs(delta) <= 1) return;
  if (scroller) scroller.scrollBy({ top: delta, behavior: 'smooth' });
  else window.scrollBy({ top: delta, behavior: 'smooth' });
}

function readDraft(
  userId: string,
  seed?: { firstName?: string; lastName?: string; userPicture?: string }
): Draft {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return emptyDraft(seed);
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      ...emptyDraft(seed),
      step: parsed.step === 2 ? 2 : 1,
      firstName: typeof parsed.firstName === 'string' ? parsed.firstName : seed?.firstName || '',
      lastName: typeof parsed.lastName === 'string' ? parsed.lastName : seed?.lastName || '',
      userPicture:
        typeof parsed.userPicture === 'string' ? parsed.userPicture : seed?.userPicture || '',
      referral: typeof parsed.referral === 'string' ? parsed.referral : '',
      referralOther: typeof parsed.referralOther === 'string' ? parsed.referralOther : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      address: typeof parsed.address === 'string' ? parsed.address : '',
      streetAddress: typeof parsed.streetAddress === 'string' ? parsed.streetAddress : '',
      apartment: typeof parsed.apartment === 'string' ? parsed.apartment : '',
      city: typeof parsed.city === 'string' ? parsed.city : '',
      state: typeof parsed.state === 'string' ? parsed.state : '',
      zipCode: typeof parsed.zipCode === 'string' ? parsed.zipCode : '',
      gateCode: typeof parsed.gateCode === 'string' ? parsed.gateCode : '',
      addressNote: typeof parsed.addressNote === 'string' ? parsed.addressNote : '',
    };
  } catch {
    return emptyDraft(seed);
  }
}

/**
 * Blocks the Hub until a new Google customer finishes the missing fields from
 * the customer 3-step signup (referral, phone, address, terms). Closing discards
 * the unfinished Google signup.
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
      firstName={user.firstName || ''}
      lastName={user.lastName || ''}
      userPicture={user.userPicture || ''}
      onLeave={async () => {
        try {
          await fetch('/api/auth/abandon-setup', {
            method: 'POST',
            credentials: 'include',
          });
        } catch {
          // Still sign out locally.
        }
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
  firstName: string;
  lastName: string;
  userPicture: string;
  onLeave: () => Promise<void>;
  onFinished: (patch: FinishSetupPatch) => void;
}

function FinishAccountSetupModal({
  userId,
  email,
  firstName,
  lastName,
  userPicture,
  onLeave,
  onFinished,
}: FinishAccountSetupModalProps) {
  const locale = useLocale();
  const t = useTranslations('auth.finishSetup');
  const tFields = useTranslations('auth.signup.fields');
  const tTerms = useTranslations('auth.signup.terms');
  const tSteps = useTranslations('auth.signup.stepLabels');
  const tNav = useTranslations('auth.signup.navigation');
  const extraReferrals = useReferralOptions();
  const askNames = !firstName.trim() || !lastName.trim();
  const totalSteps = 2;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addressFollowUpRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft>(() =>
    emptyDraft({ firstName, lastName, userPicture })
  );
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveWarningOpen, setLeaveWarningOpen] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const seededPicture = userPicture.trim();
  const [preview, setPreview] = useState<string | null>(seededPicture || null);
  const [originalImage, setOriginalImage] = useState<string | null>(seededPicture || null);
  const [zoom, setZoom] = useState(50);
  const [verticalPosition, setVerticalPosition] = useState(50);
  const [horizontalPosition, setHorizontalPosition] = useState(50);
  const [isEditMode, setIsEditMode] = useState(false);
  const zoomRef = useRef(50);
  const verticalPositionRef = useRef(50);
  const horizontalPositionRef = useRef(50);
  const stepLabel =
    draft.step === 2 ? tSteps('customerAddress') : tSteps('customerPersonal');

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    verticalPositionRef.current = verticalPosition;
  }, [verticalPosition]);
  useEffect(() => {
    horizontalPositionRef.current = horizontalPosition;
  }, [horizontalPosition]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const saved = readDraft(userId, { firstName, lastName, userPicture });
      const rawSaved = typeof saved.userPicture === 'string' ? saved.userPicture.trim() : '';
      const rawProp = userPicture.trim();
      // Prefer a valid saved draft photo; otherwise Google/profile URL; ignore broken drafts.
      const nextPicture = [rawSaved, rawProp].find(isDisplayablePicture) || '';
      setDraft({
        ...saved,
        firstName: saved.firstName || firstName,
        lastName: saved.lastName || lastName,
        userPicture: nextPicture,
        phone: saved.phone ? formatPhoneNumber(saved.phone) : '',
        zipCode: saved.zipCode ? maskZip(saved.zipCode) : '',
      });

      if (!nextPicture) {
        if (cancelled) return;
        setPreview(null);
        setOriginalImage(null);
        setIsEditMode(false);
        setDraftReady(true);
        return;
      }

      // Show the URL immediately (Google photos need no-referrer on <img>).
      // Convert to data URL only when possible so crop/zoom can run.
      const editableSource = (await toEditableDataUrl(nextPicture)) || nextPicture;
      if (cancelled) return;

      setDraft((current) => ({
        ...current,
        userPicture: editableSource.startsWith('data:image/') ? editableSource : nextPicture,
      }));
      setPreview(nextPicture.startsWith('data:image/') ? editableSource : nextPicture);
      setOriginalImage(editableSource.startsWith('data:image/') ? editableSource : nextPicture);
      setZoom(50);
      setVerticalPosition(50);
      setHorizontalPosition(50);
      zoomRef.current = 50;
      verticalPositionRef.current = 50;
      horizontalPositionRef.current = 50;
      setIsEditMode(true);
      setDraftReady(true);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, firstName, lastName, userPicture]);

  useEffect(() => {
    if (!draftReady) return;
    localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  }, [userId, draft, draftReady]);

  const needsDetail = referralNeedsDetail(draft.referral);
  const detailRequired = draft.referral === REFERRAL_OTHER;
  const displayName = [firstName || draft.firstName, lastName || draft.lastName].filter(Boolean).join(' ');

  const requestLeave = () => {
    if (leaving || saving) return;
    setLeaveWarningOpen(true);
  };

  const confirmLeave = async () => {
    if (leaving || saving) return;
    setLeaveWarningOpen(false);
    setLeaving(true);
    await onLeave();
  };

  const goNext = () => {
    setError(null);
    setFieldError(null);
    if (askNames) {
      if (!draft.firstName.trim()) {
        setFieldError(t('errors.firstName'));
        return;
      }
      if (!draft.lastName.trim()) {
        setFieldError(t('errors.lastName'));
        return;
      }
    }
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
    setDraft((current) => ({ ...current, step: 2 }));
  };

  const submit = async () => {
    if (saving) return;
    setError(null);
    setFieldError(null);
    const street = draft.streetAddress.trim() || draft.address.trim();
    if (!street) {
      setFieldError(t('errors.street'));
      return;
    }
    if (!draft.city.trim()) {
      setFieldError(t('errors.city'));
      return;
    }
    if (draft.state.trim().length !== 2) {
      setFieldError(t('errors.state'));
      return;
    }
    if (!/^\d{5}(-\d{4})?$/.test(draft.zipCode.trim())) {
      setFieldError(t('errors.zip'));
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
          firstName: askNames ? draft.firstName.trim() : undefined,
          lastName: askNames ? draft.lastName.trim() : undefined,
          userPicture: draft.userPicture.trim() || undefined,
          streetAddress: street,
          apartment: draft.apartment.trim() || undefined,
          city: draft.city.trim(),
          state: draft.state.trim().toUpperCase(),
          zipCode: draft.zipCode.trim(),
          gateCode: draft.gateCode.trim() || undefined,
          addressNote: draft.addressNote.trim() || undefined,
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
        firstName: askNames ? draft.firstName.trim() : firstName,
        lastName: askNames ? draft.lastName.trim() : lastName,
        userPicture: draft.userPicture.trim() || undefined,
        streetAddress: street,
        apartment: draft.apartment.trim() || undefined,
        city: draft.city.trim(),
        state: draft.state.trim().toUpperCase(),
        zipCode: draft.zipCode.trim(),
        gateCode: draft.gateCode.trim() || undefined,
        addressNote: draft.addressNote.trim() || undefined,
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

  const onAddressSelect = (address: AddressData) => {
    setDraft((current) => ({
      ...current,
      address: address.fullAddress || address.streetAddress,
      streetAddress: address.streetAddress,
      apartment: address.apartment || current.apartment,
      city: address.city,
      state: address.state,
      zipCode: maskZip(address.zipCode || ''),
    }));
    // After the suggestion closes, lift apartment+ lower fields into the modal viewport.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = addressFollowUpRef.current;
        if (target) scrollElementToScrollportTop(target);
      });
    });
  };

  const applyZoom = async (
    imageSrc: string,
    zoomValue: number,
    vertPosition?: number,
    horzPosition?: number
  ) => {
    const zoomFactor = 0.5 + (zoomValue / 100) * 1.5;
    const vertPos = vertPosition ?? verticalPositionRef.current;
    const horzPos = horzPosition ?? horizontalPositionRef.current;
    try {
      const resized = await resizeImageSquare(imageSrc, 400, 0.85, zoomFactor, vertPos, horzPos);
      setPreview(resized);
      setDraft((current) => ({ ...current, userPicture: resized }));
    } catch {
      try {
        const fallback = await resizeImageSquare(imageSrc, 400, 0.85);
        setPreview(fallback);
        setDraft((current) => ({ ...current, userPicture: fallback }));
      } catch {
        setPreview(imageSrc);
        setDraft((current) => ({ ...current, userPicture: imageSrc }));
      }
    }
  };

  const handlePictureClick = () => {
    if (saving) return;
    fileInputRef.current?.click();
  };

  const handlePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFieldError(tFields('imageTypeError'));
      return;
    }
    if (!validateFileSize(file, 5)) {
      setFieldError(tFields('imageSizeError'));
      return;
    }
    setFieldError(null);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const result = String(reader.result || '');
      if (!result) {
        setFieldError(tFields('imageTypeError'));
        return;
      }
      setOriginalImage(result);
      setZoom(50);
      setVerticalPosition(50);
      setHorizontalPosition(50);
      zoomRef.current = 50;
      verticalPositionRef.current = 50;
      horizontalPositionRef.current = 50;
      setIsEditMode(true);
      await applyZoom(result, 50, 50, 50);
    };
    reader.onerror = () => setFieldError(tFields('imageTypeError'));
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePicture = () => {
    setPreview(null);
    setOriginalImage(null);
    setZoom(50);
    setVerticalPosition(50);
    setHorizontalPosition(50);
    zoomRef.current = 50;
    verticalPositionRef.current = 50;
    horizontalPositionRef.current = 50;
    setIsEditMode(false);
    setDraft((current) => ({ ...current, userPicture: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleZoomChange = (zoomValue: number) => {
    setZoom(zoomValue);
    zoomRef.current = zoomValue;
    if (originalImage && isEditMode) {
      void applyZoom(originalImage, zoomValue, verticalPositionRef.current, horizontalPositionRef.current);
    }
  };

  const handleVerticalPositionChange = (position: number) => {
    setVerticalPosition(position);
    verticalPositionRef.current = position;
    if (originalImage && isEditMode) {
      void applyZoom(originalImage, zoomRef.current, position, horizontalPositionRef.current);
    }
  };

  const handleHorizontalPositionChange = (position: number) => {
    setHorizontalPosition(position);
    horizontalPositionRef.current = position;
    if (originalImage && isEditMode) {
      void applyZoom(originalImage, zoomRef.current, verticalPositionRef.current, position);
    }
  };

  return (
    <>
    <Modal
      isOpen
      onClose={requestLeave}
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
          onClick={requestLeave}
          disabled={leaving || saving}
          className="w-8 h-8 shrink-0 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors disabled:opacity-50"
          aria-label={t('leaveClose')}
        >
          <X className="w-5 h-5 text-black" />
        </button>
      </div>

      <p className="mt-3 text-sm text-gray-700">{t('subtitle')}</p>
      {(displayName || email) && (
        <p className="mt-2 text-[1.05rem] font-bold text-black">
          {displayName}
          {displayName && email ? ' · ' : ''}
          {email}
        </p>
      )}

      <div className="mt-5">
        <SignupStepsIndicator
          currentStep={draft.step}
          totalSteps={totalSteps}
          stepLabel={stepLabel}
        />
      </div>

      <div className="mt-4 flex flex-col gap-6">
        {error && <ErrorMessage message={error} />}
        {fieldError && <ErrorMessage message={fieldError} />}

        {draft.step === 1 ? (
          <div className="flex flex-col gap-6 animate-fade-in">
            <section className="flex flex-col items-center gap-3 md:gap-2">
              <div className={`flex flex-col items-center gap-3 md:gap-2 ${preview && isEditMode ? 'pt-4 md:pt-0' : ''}`}>
                {preview && isEditMode && (
                  <div className="flex items-center gap-2">
                    <div className="w-1" />
                    <div className="w-24 flex justify-center">
                      <div className="w-[91.2px]">
                        <HorizontalSlider
                          initialPosition={horizontalPosition}
                          onPositionChange={handleHorizontalPositionChange}
                        />
                      </div>
                    </div>
                    <div className="w-4" />
                  </div>
                )}
                <div className="relative flex items-center gap-3 md:gap-2">
                  {preview && isEditMode && (
                    <div className="h-[91.2px] flex items-center justify-center">
                      <VerticalSlider
                        initialPosition={verticalPosition}
                        onPositionChange={handleVerticalPositionChange}
                      />
                    </div>
                  )}
                  <div className="relative flex items-start justify-end gap-1.5">
                    <div
                      role="button"
                      tabIndex={saving ? -1 : 0}
                      onClick={handlePictureClick}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handlePictureClick();
                        }
                      }}
                      className="w-24 h-24 rounded-lg border-2 border-black flex items-center justify-center bg-white cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative aspect-square"
                      aria-label={tFields('uploadPicture')}
                    >
                      {preview ? (
                        // Native img: Google avatars often break under Next/Image without no-referrer.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={() => {
                            setPreview(null);
                            setOriginalImage(null);
                            setIsEditMode(false);
                            setDraft((current) => ({ ...current, userPicture: '' }));
                          }}
                        />
                      ) : (
                        <User className="w-10 h-10 text-black" />
                      )}
                    </div>
                    {preview ? (
                      <div className="flex flex-col gap-3 md:gap-1.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemovePicture();
                          }}
                          disabled={saving}
                          className="w-6 h-6 md:w-4 md:h-4 rounded bg-red-500 border-2 border-red-500 flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors shadow-lg disabled:opacity-50"
                          aria-label={tFields('removeProfilePicture')}
                        >
                          <X className="w-3.5 h-3.5 md:w-2.5 md:h-2.5 text-white" strokeWidth={3} />
                        </button>
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            setIsEditMode(true);
                            if (originalImage) {
                              await applyZoom(
                                originalImage,
                                zoomRef.current,
                                verticalPositionRef.current,
                                horizontalPositionRef.current
                              );
                            }
                          }}
                          disabled={saving}
                          className="w-6 h-6 md:w-4 md:h-4 rounded bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors shadow-lg disabled:opacity-50"
                          aria-label="Edit profile picture"
                        >
                          <Pencil className="w-3.5 h-3.5 md:w-2.5 md:h-2.5 text-white" strokeWidth={2} />
                        </button>
                        {isEditMode ? (
                          <button
                            type="button"
                            onClick={async (event) => {
                              event.stopPropagation();
                              if (originalImage) {
                                await applyZoom(
                                  originalImage,
                                  zoomRef.current,
                                  verticalPositionRef.current,
                                  horizontalPositionRef.current
                                );
                              }
                              setIsEditMode(false);
                            }}
                            disabled={saving}
                            className="w-6 h-6 md:w-4 md:h-4 rounded bg-green-500 border-2 border-green-500 flex items-center justify-center cursor-pointer hover:bg-green-600 transition-colors shadow-lg disabled:opacity-50"
                            aria-label="Confirm image adjustments"
                          >
                            <Check className="w-3.5 h-3.5 md:w-2.5 md:h-2.5 text-white" strokeWidth={3} />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                {preview && isEditMode && (
                  <div className="flex items-center gap-2">
                    <div className="w-1" />
                    <div className="w-24 flex justify-center">
                      <div className="w-[91.2px]">
                        <ZoomSlider initialZoom={zoom} onZoomChange={handleZoomChange} />
                      </div>
                    </div>
                    <div className="w-4" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-black">{tFields('uploadPicture')}</span>
                <TipModal message="It will only be publicly visible on comments on business card" hoverOnly />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePictureChange}
                className="hidden"
                disabled={saving}
              />
            </section>

            {askNames && (
              <>
                <FormField label={tFields('firstNameLabel')} required>
                  <Input
                    id="finish-first-name"
                    type="text"
                    value={draft.firstName}
                    showClear
                    onClear={() => setDraft((current) => ({ ...current, firstName: '' }))}
                    onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))}
                    disabled={saving}
                  />
                </FormField>
                <FormField label={tFields('lastNameLabel')} required>
                  <Input
                    id="finish-last-name"
                    type="text"
                    value={draft.lastName}
                    showClear
                    onClear={() => setDraft((current) => ({ ...current, lastName: '' }))}
                    onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))}
                    disabled={saving}
                  />
                </FormField>
              </>
            )}

            <FormField label={tFields('referralLabel')} required tip="Help us understand how you found our platform">
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

            <FormField label={tFields('phoneLabel')} required tip="For contact and unique identification purpose">
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
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-fade-in">
            <FormField
              label={tFields('searchAddressLabel')}
              required
              tip="Address where services will be provided."
            >
              <AddressAutocomplete
                id="finish-address"
                value={draft.address}
                onChange={(value) => setDraft((current) => ({ ...current, address: value }))}
                onAddressSelect={onAddressSelect}
                placeholder={tFields('searchAddressPlaceholder')}
                disabled={saving}
                required
              />
            </FormField>

            <div ref={addressFollowUpRef} className="flex flex-col gap-6">
              <FormField label={tFields('apartmentLabel')}>
                <Input
                  id="finish-apartment"
                  type="text"
                  value={draft.apartment}
                  showClear
                  onClear={() => setDraft((current) => ({ ...current, apartment: '' }))}
                  onChange={(event) => setDraft((current) => ({ ...current, apartment: event.target.value }))}
                  placeholder={tFields('apartmentPlaceholder')}
                  disabled={saving}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label={tFields('cityLabel')} required>
                  <Input
                    id="finish-city"
                    type="text"
                    value={draft.city}
                    showClear
                    onClear={() => setDraft((current) => ({ ...current, city: '' }))}
                    onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))}
                    placeholder={tFields('cityPlaceholder')}
                    disabled={saving}
                  />
                </FormField>
                <FormField label={tFields('stateLabel')} required>
                  <Input
                    id="finish-state"
                    type="text"
                    value={draft.state}
                    showClear
                    onClear={() => setDraft((current) => ({ ...current, state: '' }))}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        state: event.target.value.toUpperCase().slice(0, 2),
                      }))
                    }
                    placeholder={tFields('statePlaceholder')}
                    disabled={saving}
                  />
                </FormField>
              </div>

              <FormField label={tFields('zipLabel')} required>
                <Input
                  id="finish-zip"
                  type="text"
                  value={draft.zipCode}
                  showClear
                  onClear={() => setDraft((current) => ({ ...current, zipCode: '' }))}
                  onChange={(event) => setDraft((current) => ({ ...current, zipCode: maskZip(event.target.value) }))}
                  placeholder={tFields('zipPlaceholder')}
                  disabled={saving}
                />
              </FormField>

              <FormField label={tFields('gateCodeLabel')}>
                <Input
                  id="finish-gate"
                  type="text"
                  value={draft.gateCode}
                  showClear
                  onClear={() => setDraft((current) => ({ ...current, gateCode: '' }))}
                  onChange={(event) => setDraft((current) => ({ ...current, gateCode: event.target.value }))}
                  placeholder={tFields('gateCodePlaceholder')}
                  disabled={saving}
                />
              </FormField>

              <FormField label={tFields('addressNoteLabel')}>
                <div className="relative">
                  <textarea
                    id="finish-address-note"
                    rows={3}
                    value={draft.addressNote}
                    onChange={(event) => setDraft((current) => ({ ...current, addressNote: event.target.value }))}
                    className="w-full resize-none rounded-lg border-2 border-black bg-white px-2 py-3 pr-8 focus:outline-none transition-all"
                    placeholder={tFields('addressNotePlaceholder')}
                    disabled={saving}
                  />
                  {draft.addressNote && (
                    <button
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, addressNote: '' }))}
                      className="absolute right-2 top-2 cursor-pointer text-gray-600 transition-colors hover:text-black"
                      disabled={saving}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </FormField>

              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(event) => setAgree(event.target.checked)}
                  disabled={saving}
                  className="mt-0.5 h-4 w-4 rounded border-2 border-black accent-black checked:border-black checked:bg-black"
                  style={{ accentColor: 'black' }}
                />
                <span className="ml-2 text-sm text-gray-600">
                  {tTerms('prefix')}{' '}
                  <Link href={`/${locale}/legal/terms`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
                    {tTerms('termsOfService')}
                  </Link>{' '}
                  {tTerms('and')}{' '}
                  <Link href={`/${locale}/legal/privacy`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
                    {tTerms('privacyPolicy')}
                  </Link>{' '}
                  {tTerms('suffix')}
                </span>
              </label>
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-4">
          <div className="flex gap-4">
            {draft.step > 1 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setFieldError(null);
                  setError(null);
                  setDraft((current) => ({ ...current, step: 1 }));
                }}
                disabled={saving || leaving}
                className="flex-1 whitespace-nowrap px-2 py-2 md:px-4 md:py-3"
              >
                {tNav('previous')}
              </Button>
            )}
            {draft.step < totalSteps ? (
              <Button
                type="button"
                variant="primary"
                onClick={goNext}
                disabled={saving || leaving}
                className="flex-1 whitespace-nowrap px-2 py-2 md:px-4 md:py-3"
              >
                {tNav('next')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  void submit();
                }}
                disabled={saving || leaving || !agree}
                loading={saving}
                className={`flex-1 whitespace-nowrap px-2 py-2 md:px-4 md:py-3 ${
                  agree && !saving ? 'bg-black text-white' : ''
                }`}
              >
                {saving ? t('submitting') : t('submit')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>

    <LeavePageWarningModal
      isOpen={leaveWarningOpen}
      onCancel={() => setLeaveWarningOpen(false)}
      onConfirm={() => {
        void confirmLeave();
      }}
      title={t('leaveTitle')}
      message={t('leaveMessage')}
      cancelLabel={t('leaveStay')}
      confirmLabel={t('leaveConfirm')}
    />
    </>
  );
}
