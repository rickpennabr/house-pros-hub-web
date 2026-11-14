'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Camera, ClipboardList, HardDrive, ImagePlus, Play, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { GoogleHandoffOverlay } from '@/components/auth/GoogleHandoffOverlay';
import { ProDrivePicker } from '@/components/drive/ProDrivePicker';
import { ProDriveQuotaModal } from '@/components/drive/ProDriveQuotaModal';
import { Button } from '@/components/ui/Button';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import { createSignInUrl, createSignUpUrl } from '@/lib/redirect';
import { reverseGeocode, requestCurrentLocation, type CaptureLocation } from '@/lib/media/capture-location';
import {
  clearQuickRepairDraft,
  loadQuickRepairDraft,
  saveQuickRepairDraft,
  type QuickRepairDraft,
} from '@/lib/media/quick-repair-draft';
import { QUICK_REPAIR_PHOTO_EVENT, openQuickRepairCamera, type QuickRepairPhotoRequest } from '@/lib/media/quick-repair-camera';
import { uploadProDriveFile, ProDriveQuotaClientError } from '@/lib/drive/upload-client';
import { estimateSchema } from '@/lib/schemas/estimate';
import { createClient } from '@/lib/supabase/client';
import type { DriveFile, DriveUsage } from '@/lib/drive/types';
import type { Locale } from '@/i18n';

/** Scroll parent for the progress bar. Null means the page itself scrolls. */
function scrollParent(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent) {
    const overflow = getComputedStyle(parent).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
    parent = parent.parentElement;
  }
  return null;
}

/** Move the bar to the top of the screen, and no farther than the page allows. */
function scrollBarToScreenTop(bar: HTMLElement) {
  const scroller = scrollParent(bar);
  const barTop = bar.getBoundingClientRect().top;
  if (!scroller) {
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: Math.min(Math.max(0, window.scrollY + barTop), max), behavior: 'auto' });
    return;
  }
  const topInScroller = barTop - scroller.getBoundingClientRect().top;
  const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  scroller.scrollTo({ top: Math.min(Math.max(0, scroller.scrollTop + topInScroller), max), behavior: 'auto' });
}

const MAX_PHOTOS = 5;
const DEFAULT_TRADE = 'Handyman';
const STEPS = ['upload', 'details', 'submit'] as const;
type Step = (typeof STEPS)[number];

const CONTACT_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'streetAddress', 'city', 'state', 'zipCode'] as const;
type ContactField = (typeof CONTACT_FIELDS)[number];

/** Empty values use a "required" message. A filled value that still fails uses the schema's format message. */
const REQUIRED_MESSAGE: Record<ContactField, string> = {
  firstName: 'firstNameRequired',
  lastName: 'lastNameRequired',
  email: 'emailRequired',
  phone: 'phoneRequired',
  streetAddress: 'streetAddressRequired',
  city: 'cityRequired',
  state: 'stateRequired',
  zipCode: 'zipRequired',
};

/** ZIP is 5 digits, or 5 plus 4. Letters and extra digits are dropped. */
function maskZip(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** State is a 2-letter code. */
function maskState(value: string): string {
  return value.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
}

interface LocalPhoto {
  key: string;
  name: string;
  file: File | null;
  driveId: string | null;
  previewUrl: string | null;
}

export default function QuickRepairPage() {
  const t = useTranslations('procam');
  const tHandoff = useTranslations('auth.googleHandoff');
  const tValidation = useTranslations('estimate.validation');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [location, setLocation] = useState<CaptureLocation | null>(null);
  const [quota, setQuota] = useState<DriveUsage | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sharedPhoto, setSharedPhoto] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [trade, setTrade] = useState('');
  const [description, setDescription] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [apartment, setApartment] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const located = useRef(false);
  const uploadedIds = useRef<Map<string, string>>(new Map());
  const finished = useRef(false);
  const resumeSubmitRef = useRef(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const addFileRef = useRef<(file: File) => Promise<void>>(async () => undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSharedPhoto(params.get('shared') === '1');
  }, []);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => {
        if (photo.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    void (async () => {
      try {
        const draft = await loadQuickRepairDraft();
        const params = new URLSearchParams(window.location.search);
        if (params.get('step') === '3') resumeSubmitRef.current = true;
        const resumeSubmit = resumeSubmitRef.current;
        if (resumeSubmit && params.has('step')) {
          params.delete('step');
          const next = params.toString();
          window.history.replaceState(null, '', `${window.location.pathname}${next ? `?${next}` : ''}`);
        }
        if (cancelled) return;
        if (!draft || !draftHasWork(draft)) {
          if (isAuthenticated && resumeSubmit) setStep('submit');
          return;
        }
        const keep = (value: string, fallback: string) => value || fallback;
        setFirstName((current) => keep(draft.firstName, current));
        setLastName((current) => keep(draft.lastName, current));
        setEmail((current) => keep(draft.email, current));
        setPhone((current) => formatPhoneNumber(keep(draft.phone, current)));
        setTrade((current) => keep(draft.trade, current));
        setDescription((current) => keep(draft.description, current));
        setStreetAddress((current) => keep(draft.streetAddress, current));
        setApartment((current) => keep(draft.apartment ?? '', current));
        setCity((current) => keep(draft.city, current));
        setState((current) => maskState(keep(draft.state, current)));
        setZipCode((current) => maskZip(keep(draft.zipCode, current)));
        if (draft.latitude != null && draft.longitude != null) {
          located.current = true;
          setLocation({ latitude: draft.latitude, longitude: draft.longitude, accuracyM: draft.accuracyM });
        }
        const restoredPhotos = photosFromDraft(draft);
        setPhotos((current) => {
          if (current.length === 0) return restoredPhotos;
          const seen = new Set(restoredPhotos.map((photo) => photo.driveId || photo.name));
          const added = current.filter((photo) => !seen.has(photo.driveId || photo.name));
          return [...restoredPhotos, ...added].slice(0, MAX_PHOTOS);
        });
        for (const photo of restoredPhotos) {
          if (photo.previewUrl || !photo.driveId) continue;
          void previewFor(photo.driveId).then((url) => {
            if (!url) return;
            setPhotos((current) => current.map((item) => (item.key === photo.key ? { ...item, previewUrl: url } : item)));
          });
        }
        const readyToSend = Boolean(draft.firstName && draft.lastName && draft.email && draft.phone && draft.streetAddress && draft.city && draft.state && draft.zipCode);
        if (isAuthenticated && (readyToSend || resumeSubmit)) setStep('submit');
        else if (draft.trade || draft.description) setStep('details');
        else setStep('upload');
      } catch {
        // A missing draft just starts on the photo step.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    if (!user) return;
    setFirstName((current) => current || user.firstName || '');
    setLastName((current) => current || user.lastName || '');
    setEmail((current) => current || user.email || '');
    setPhone((current) => formatPhoneNumber(current || user.phone || ''));
    setStreetAddress((current) => current || user.streetAddress || '');
    setApartment((current) => current || user.apartment || '');
    setCity((current) => current || user.city || '');
    setState((current) => maskState(current || user.state || ''));
    setZipCode((current) => maskZip(current || user.zipCode || ''));
  }, [user]);

  useEffect(() => {
    const masked = formatPhoneNumber(phone);
    if (phone !== masked) setPhone(masked);
  }, [phone]);

  const currentDraft = (): QuickRepairDraft => ({
    firstName,
    lastName,
    email,
    phone,
    trade,
    description,
    streetAddress,
    apartment,
    city,
    state,
    zipCode,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    accuracyM: location?.accuracyM ?? null,
    photos: photos.map((photo) => ({
      name: photo.name,
      type: photo.file?.type || 'image/jpeg',
      blob: photo.file,
      driveId: photo.driveId,
    })),
  });

  useEffect(() => {
    if (!ready || done || finished.current) return;
    const draft = currentDraft();
    const handle = window.setTimeout(() => {
      if (finished.current) return;
      void saveQuickRepairDraft(draft).catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [
    ready,
    done,
    photos,
    location,
    firstName,
    lastName,
    email,
    phone,
    trade,
    description,
    streetAddress,
    apartment,
    city,
    state,
    zipCode,
  ]);

  const clearFieldError = (field: ContactField) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const contactFieldErrors = () => {
    const values = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: formatPhoneNumber(phone),
      streetAddress: streetAddress.trim(),
      apartment: apartment.trim(),
      city: city.trim(),
      state: maskState(state),
      zipCode: maskZip(zipCode),
    };
    const parsed = estimateSchema.safeParse({
      ...values,
      projectType: 'repair',
      requiresHoaApproval: false,
      wants3D: false,
      trades: [trade || DEFAULT_TRADE],
      projectDescription: description,
      budgetRange: 'not_sure',
      timeline: 'asap',
      preferredContactMethod: 'phone',
      source: 'quick_repair',
    });
    if (parsed.success) return {};
    const flat = parsed.error.flatten().fieldErrors;
    const next: Partial<Record<ContactField, string>> = {};
    for (const field of CONTACT_FIELDS) {
      const code = flat[field]?.[0];
      if (!code) continue;
      const key = values[field] ? code : REQUIRED_MESSAGE[field];
      next[field] = tValidation(key as 'firstNameRequired');
    }
    return next;
  };

  const rememberPlace = async () => {
    if (located.current) return;
    located.current = true;
    const shot = await requestCurrentLocation();
    if (!shot) return;
    setLocation(shot);
    const found = await reverseGeocode(shot.latitude, shot.longitude);
    if (!found) return;
    setStreetAddress((current) => current || found.streetAddress);
    setApartment((current) => current || found.apartment);
    setCity((current) => current || found.city);
    setState((current) => current || found.state);
    setZipCode((current) => current || found.zipCode);
  };

  const addLocalFile = async (file: File) => {
    if (photosRef.current.length >= MAX_PHOTOS) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotos((current) => {
      if (current.length >= MAX_PHOTOS) {
        URL.revokeObjectURL(previewUrl);
        return current;
      }
      return [...current, { key: crypto.randomUUID(), name: file.name, file, driveId: null, previewUrl }];
    });
  };
  addFileRef.current = addLocalFile;

  useEffect(() => {
    const onPhoto = (event: Event) => {
      const custom = event as CustomEvent<QuickRepairPhotoRequest>;
      const detail = custom.detail;
      if (!detail?.file) return;
      custom.preventDefault();
      if (finished.current) return;
      if (photosRef.current.length >= MAX_PHOTOS) {
        detail.rejectReason = 'full';
        return;
      }
      setStep('upload');
      void addFileRef.current(detail.file);
    };
    window.addEventListener(QUICK_REPAIR_PHOTO_EVENT, onPhoto);
    return () => window.removeEventListener(QUICK_REPAIR_PHOTO_EVENT, onPhoto);
  }, []);

  const onPickFiles = async (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    for (const file of incoming) {
      if (photosRef.current.length >= MAX_PHOTOS) break;
      await addLocalFile(file);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const linkExisting = async (file: DriveFile) => {
    if (photos.some((photo) => photo.driveId === file.id) || photos.length >= MAX_PHOTOS) return;
    const preview = file.previewUrl ?? (await previewFor(file.id));
    setPhotos((current) => {
      if (current.length >= MAX_PHOTOS || current.some((photo) => photo.driveId === file.id)) return current;
      return [...current, { key: file.id, name: file.name, file: null, driveId: file.id, previewUrl: preview }];
    });
  };

  const removePhoto = (key: string) => {
    setPhotos((current) => {
      const photo = current.find((item) => item.key === key);
      if (photo?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl);
      return current.filter((item) => item.key !== key);
    });
  };

  const persistNow = () => saveQuickRepairDraft(currentDraft());

  const continueWithGoogle = async () => {
    // A second OAuth start overwrites the PKCE verifier of the first one, so the
    // callback for the earlier code can no longer be exchanged.
    if (googleLoading) return;
    setGoogleLoading(true);
    setError(null);
    try {
      await persistNow();
    } catch {
      setError(t('draftFailed'));
      setGoogleLoading(false);
      return;
    }
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    const returnUrl = `/${locale}/quick-repair?step=3`;
    document.cookie = `hph_oauth_flow=customer; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    document.cookie = `hph_oauth_locale=${encodeURIComponent(locale)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    document.cookie = `hph_oauth_next=${encodeURIComponent(returnUrl)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback?locale=${encodeURIComponent(locale)}&flow=customer` },
    });
    if (oauthError) {
      setError(t('googleFailed'));
      setGoogleLoading(false);
    }
  };

  const leaveForAccount = async (href: string) => {
    setError(null);
    try {
      await persistNow();
    } catch {
      setError(t('draftFailed'));
      return;
    }
    router.push(href);
  };

  const submit = async () => {
    if (!user) {
      setStep('details');
      return;
    }
    const missing = contactFieldErrors();
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setError(null);
      return;
    }
    setFieldErrors({});
    setSaving(true);
    setError(null);
    try {
      const ids: string[] = [];
      for (const photo of photos) {
        if (photo.driveId) {
          ids.push(photo.driveId);
          continue;
        }
        if (!photo.file) continue;
        const existing = uploadedIds.current.get(photo.key);
        if (existing) {
          ids.push(existing);
          continue;
        }
        const saved = await uploadProDriveFile({
          file: photo.file,
          ownerType: 'user',
          ownerId: user.id,
          ensureFolderNames: ['ProCam'],
        });
        uploadedIds.current.set(photo.key, saved.id);
        ids.push(saved.id);
      }
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        credentials: 'include',
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: formatPhoneNumber(phone),
          streetAddress,
          apartment,
          city,
          state: maskState(state),
          zipCode: maskZip(zipCode),
          projectType: 'repair',
          requiresHoaApproval: false,
          wants3D: false,
          trades: [trade || DEFAULT_TRADE],
          projectDescription: description,
          projectImages: [],
          budgetRange: 'not_sure',
          timeline: 'asap',
          preferredContactMethod: 'phone',
          projectDriveFileIds: ids,
          latitude: location?.latitude,
          longitude: location?.longitude,
          locationAccuracyM: location?.accuracyM ?? undefined,
          source: 'quick_repair',
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || t('uploadFailed'));
      finished.current = true;
      setDone(true);
      await clearQuickRepairDraft();
    } catch (submitError) {
      if (submitError instanceof ProDriveQuotaClientError) setQuota(submitError.usage);
      else setError(submitError instanceof Error ? submitError.message : t('uploadFailed'));
    } finally {
      setSaving(false);
    }
  };

  const progressRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!ready) return;
    if (!done && step !== 'details' && step !== 'submit') return;
    if (!done && window.matchMedia('(min-width: 768px)').matches) return;
    const bar = progressRef.current;
    if (!bar) return;
    scrollBarToScreenTop(bar);
  }, [step, ready, done]);

  const stepIndex = STEPS.indexOf(step);
  const returnPath = `/${locale}/quick-repair?step=3`;
  const progress = done ? 100 : ((Math.max(stepIndex, 0) + 1) / STEPS.length) * 100;

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return (
    <div className="flex w-full flex-1 flex-col">
      <GoogleHandoffOverlay
        open={googleLoading}
        title={tHandoff('title')}
        subtitle={tHandoff('subtitle')}
      />
      {ready && !isLoading && (
        <div
          ref={progressRef}
          className="sticky top-0 z-20 bg-white"
        >
          <div
            className="h-2 w-full bg-neutral-200"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={done ? STEPS.length : stepIndex + 1}
            aria-label={t('stepOf', { current: done ? STEPS.length : stepIndex + 1, total: STEPS.length })}
          >
            <div className="h-full bg-black transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      <div className={`w-full px-2 py-2 md:px-4 md:py-4 ${done ? 'flex flex-1 flex-col' : ''}`}>
      {isLoading || !ready ? null : done ? (
        <RepairSentThanks
          name={fullName}
          thanks={t('successThanks')}
          soon={t('successSoon')}
        />
      ) : (
        <div className="mx-auto w-full max-w-xl space-y-[0.2rem] md:space-y-4">
          <p className="text-sm font-medium uppercase tracking-wide text-gray-600 md:text-xs">
            {t('stepOf', { current: stepIndex + 1, total: STEPS.length })}
          </p>
          {sharedPhoto && <p className="text-sm font-medium">{t('sharedPhoto')}</p>}

          {step === 'upload' && (
            <section className="space-y-3">
              <h2 className="text-2xl font-bold md:text-lg">{t('uploadStepTitle')}</h2>
              <p className="text-base md:text-sm">{t('uploadStepBody')}</p>
              <PhotoGrid photos={photos} onRemove={removePhoto} removeLabel={t('remove')} />
              <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap">
                <div className="flex w-full gap-2 md:contents">
                  <Button type="button" variant={photos.length === 0 ? 'primary' : 'secondary'} disabled={photos.length >= MAX_PHOTOS} className="max-md:!inline-flex max-md:h-10 max-md:flex-1 max-md:items-center max-md:justify-center max-md:whitespace-nowrap max-md:px-2 max-md:!py-0 max-md:text-base" onClick={() => openQuickRepairCamera(photos.length)}>
                    <Camera className="w-4 h-4 inline mr-2" />
                    {photos.length === 0 ? t('snap') : t('takeAnother')}
                  </Button>
                  <Button type="button" variant="secondary" disabled={photos.length >= MAX_PHOTOS} className="max-md:!inline-flex max-md:h-10 max-md:flex-1 max-md:items-center max-md:justify-center max-md:whitespace-nowrap max-md:px-2 max-md:!py-0 max-md:text-base" onClick={() => inputRef.current?.click()}>
                    <ImagePlus className="w-4 h-4 inline mr-2" />
                    {t('uploadPhoto')}
                  </Button>
                </div>
                {user && (
                  <Button type="button" variant="secondary" disabled={photos.length >= MAX_PHOTOS} className="max-md:!inline-flex max-md:h-10 max-md:items-center max-md:justify-center max-md:self-start max-md:whitespace-nowrap max-md:px-3 max-md:!py-0 max-md:text-base" onClick={() => setPickerOpen(true)}>
                    <HardDrive className="w-4 h-4 inline mr-2" />
                    {t('drive')}
                  </Button>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(event) => void onPickFiles(event.target.files)}
              />
              <Button type="button" className="max-md:!inline-flex max-md:h-10 max-md:items-center max-md:justify-center max-md:self-start max-md:whitespace-nowrap max-md:px-3 max-md:!py-0 max-md:text-base" onClick={() => {
                void rememberPlace();
                setStep('details');
              }}
              >
                {t('continue')}
              </Button>
            </section>
          )}

          {step === 'details' && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold">{t('whatBroke')}</h2>
              <p className="text-sm">{t('describeRepair')}</p>
              <textarea
                className="w-full border-2 border-black rounded-lg px-3 py-2 min-h-24"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              {isAuthenticated ? (
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => setStep('upload')}>{t('back')}</Button>
                  <Button type="button" onClick={() => {
                    setError(null);
                    setStep('submit');
                  }}
                  >
                    {t('continue')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 border-t-2 border-black pt-3">
                  <h2 className="text-lg font-bold">{t('accountTitle')}</h2>
                  <p className="text-sm">{t('accountBody')}</p>
                  <div className="flex flex-col gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={googleLoading}
                      onClick={() => void continueWithGoogle()}
                      className="flex w-full items-center justify-center gap-2"
                    >
                      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      {googleLoading ? t('googleWorking') : t('google')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void leaveForAccount(createSignUpUrl(locale, returnPath))}
                      className="flex w-full items-center justify-center gap-2"
                    >
                      <ClipboardList className="h-5 w-5 shrink-0" aria-hidden="true" />
                      {t('signUp')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void leaveForAccount(createSignInUrl(locale, returnPath))}
                      className="w-full"
                    >
                      {t('signIn')}
                    </Button>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setStep('upload')}>{t('back')}</Button>
                </div>
              )}
            </section>
          )}

          {step === 'submit' && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold">{t('reviewTitle')}</h2>
              <p className="text-sm">{t('reviewBody')}</p>
              <PhotoGrid photos={photos} onRemove={removePhoto} removeLabel={t('remove')} />
              <p className="text-sm">
                {trade ? <span className="font-medium">{trade}</span> : null}
                {description ? `${trade ? ' — ' : ''}${description}` : ''}
              </p>
              <ContactFields
                firstName={firstName}
                lastName={lastName}
                email={email}
                phone={phone}
                streetAddress={streetAddress}
                apartment={apartment}
                city={city}
                state={state}
                zipCode={zipCode}
                errors={fieldErrors}
                onClear={clearFieldError}
                onFirstName={setFirstName}
                onLastName={setLastName}
                onEmail={setEmail}
                onPhone={setPhone}
                onStreet={setStreetAddress}
                onApartment={setApartment}
                onCity={setCity}
                onState={setState}
                onZip={setZipCode}
              />
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setStep('details')}>{t('back')}</Button>
                <Button type="button" disabled={saving} onClick={() => void submit()}>
                  {saving ? t('submitting') : t('submit')}
                </Button>
              </div>
            </section>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
      {user && (
        <ProDrivePicker
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          ownerType="user"
          ownerId={user.id}
          onSelect={(file) => void linkExisting(file)}
        />
      )}
      <ProDriveQuotaModal usage={quota} onClose={() => setQuota(null)} />
      </div>
    </div>
  );
}

function draftHasWork(draft: QuickRepairDraft): boolean {
  return draft.photos.length > 0 || Boolean(draft.trade || draft.description);
}

function photosFromDraft(draft: QuickRepairDraft): LocalPhoto[] {
  return draft.photos.slice(0, MAX_PHOTOS).map((photo) => {
    const file = photo.blob
      ? new File([photo.blob], photo.name, { type: photo.type || 'image/jpeg' })
      : null;
    return {
      key: photo.driveId || crypto.randomUUID(),
      name: photo.name,
      file,
      driveId: photo.driveId,
      previewUrl: file ? URL.createObjectURL(file) : null,
    };
  });
}

async function previewFor(fileId: string): Promise<string | null> {
  const response = await fetch(`/api/prodrive/files/${fileId}/url`, { credentials: 'include' });
  if (!response.ok) return null;
  const body = (await response.json()) as { url?: string };
  return body.url ?? null;
}

function RepairSentThanks({ name, thanks, soon }: { name: string; thanks: string; soon: string }) {
  const [src, setSrc] = useState('/pro-bot-solo.gif');
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-3 py-8 text-center" role="status">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={176}
        height={176}
        className="h-40 w-40 object-contain md:h-44 md:w-44"
        onError={() => setSrc('/pro-bot-solo.png')}
      />
      <p className="mt-4 text-xl font-medium leading-snug text-black md:text-2xl">{thanks}</p>
      {name ? <p className="mt-1 text-3xl font-bold leading-tight text-black md:text-4xl">{name}</p> : null}
      <p className="mt-5 max-w-xs text-lg font-black uppercase leading-tight tracking-wide text-black md:max-w-sm md:text-xl">
        {soon}
      </p>
    </div>
  );
}

function isRepairVideo(photo: LocalPhoto): boolean {
  if (photo.file?.type.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|m4v|3gp)$/i.test(photo.name);
}

/** A recorded file often has a blank first frame, so the tile stays white until we seek. */
function frameTime(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0.1;
  return Math.min(0.5, Math.max(0.1, duration * 0.1));
}

function RepairVideoTile({ url, name }: { url: string; name: string }) {
  const t = useTranslations('procam');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [poster, setPoster] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [unplayable, setUnplayable] = useState(false);

  const showFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPoster(canvas.toDataURL('image/jpeg', 0.85));
    } catch {
      // A cross-origin clip can refuse a still. The video element still shows the frame.
    }
  };

  const seekToFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const target = frameTime(video.duration);
    if (Math.abs(video.currentTime - target) < 0.05 && video.videoWidth) {
      showFrame();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      showFrame();
    };
    video.addEventListener('seeked', onSeeked);
    try {
      video.currentTime = target;
    } catch {
      showFrame();
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <video
        ref={videoRef}
        src={url}
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
        onLoadedData={seekToFrame}
        onError={() => setUnplayable(true)}
      />
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
      ) : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute inset-0 flex items-center justify-center"
        aria-label={t('playVideo', { name })}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/75 text-white">
          <Play className="h-5 w-5 fill-white" />
        </span>
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 p-4"
              onClick={() => setOpen(false)}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black"
                aria-label={t('closeVideo')}
              >
                <X className="h-5 w-5" />
              </button>
              {unplayable ? (
                <p className="max-w-sm text-center text-base text-white">{t('videoUnsupported')}</p>
              ) : (
                <video
                  src={url}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[85vh] max-w-full"
                  onClick={(event) => event.stopPropagation()}
                  onError={() => setUnplayable(true)}
                />
              )}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function PhotoGrid({ photos, onRemove, removeLabel }: { photos: LocalPhoto[]; onRemove: (key: string) => void; removeLabel: string }) {
  if (photos.length === 0) return null;
  return (
    <div className={photos.length === 1 ? 'w-48 max-w-full' : 'grid grid-cols-3 gap-3'}>
      {photos.map((photo) => (
        <div key={photo.key} className="min-w-0">
          <div className="relative aspect-square overflow-hidden rounded-lg border-2 border-black bg-black">
            {photo.previewUrl && isRepairVideo(photo) ? (
              <RepairVideoTile url={photo.previewUrl} name={photo.name} />
            ) : photo.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo.previewUrl} alt={photo.name} className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
          </div>
          <button type="button" className="mt-1 cursor-pointer text-xs underline" onClick={() => onRemove(photo.key)}>
            {removeLabel}
          </button>
        </div>
      ))}
    </div>
  );
}

interface ContactFieldsProps {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  apartment: string;
  city: string;
  state: string;
  zipCode: string;
  errors: Partial<Record<ContactField, string>>;
  onClear: (field: ContactField) => void;
  onFirstName: (value: string) => void;
  onLastName: (value: string) => void;
  onEmail: (value: string) => void;
  onPhone: (value: string) => void;
  onStreet: (value: string) => void;
  onApartment: (value: string) => void;
  onCity: (value: string) => void;
  onState: (value: string) => void;
  onZip: (value: string) => void;
}

function ContactFields(props: ContactFieldsProps) {
  const tFields = useTranslations('estimate.fields');
  const invalid = (field: ContactField) => (props.errors[field] ? true : undefined);

  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField label={tFields('firstNameLabel')} required error={props.errors.firstName}>
        <Input
          value={props.firstName}
          onChange={(event) => {
            props.onFirstName(event.target.value);
            props.onClear('firstName');
          }}
          placeholder={tFields('firstNamePlaceholder')}
          autoComplete="given-name"
          error={props.errors.firstName}
          aria-invalid={invalid('firstName')}
        />
      </FormField>
      <FormField label={tFields('lastNameLabel')} required error={props.errors.lastName}>
        <Input
          value={props.lastName}
          onChange={(event) => {
            props.onLastName(event.target.value);
            props.onClear('lastName');
          }}
          placeholder={tFields('lastNamePlaceholder')}
          autoComplete="family-name"
          error={props.errors.lastName}
          aria-invalid={invalid('lastName')}
        />
      </FormField>
      <FormField label={tFields('emailLabel')} required error={props.errors.email}>
        <Input
          value={props.email}
          onChange={(event) => {
            props.onEmail(event.target.value.replace(/\s/g, ''));
            props.onClear('email');
          }}
          type="email"
          inputMode="email"
          placeholder={tFields('emailPlaceholder')}
          autoComplete="email"
          error={props.errors.email}
          aria-invalid={invalid('email')}
        />
      </FormField>
      <FormField label={tFields('phoneLabel')} required error={props.errors.phone}>
        <Input
          value={formatPhoneNumber(props.phone)}
          onChange={(event) => {
            props.onPhone(formatPhoneNumber(event.target.value));
            props.onClear('phone');
          }}
          type="tel"
          inputMode="tel"
          maxLength={14}
          placeholder={tFields('phonePlaceholder')}
          autoComplete="tel"
          error={props.errors.phone}
          aria-invalid={invalid('phone')}
        />
      </FormField>
      <FormField className="col-span-2" label={tFields('streetAddressLabel')} required error={props.errors.streetAddress}>
        <AddressAutocomplete
          id="quick-repair-street"
          value={props.streetAddress}
          onChange={(value) => {
            props.onStreet(value);
            props.onClear('streetAddress');
          }}
          onAddressSelect={(addr: AddressData) => {
            props.onStreet(addr.streetAddress);
            props.onClear('streetAddress');
            if (addr.apartment) props.onApartment(addr.apartment);
            if (addr.city) {
              props.onCity(addr.city);
              props.onClear('city');
            }
            if (addr.state) {
              props.onState(maskState(addr.state));
              props.onClear('state');
            }
            if (addr.zipCode) {
              props.onZip(maskZip(addr.zipCode));
              props.onClear('zipCode');
            }
          }}
          placeholder={tFields('streetAddressPlaceholder')}
          error={props.errors.streetAddress}
          required
        />
      </FormField>
      <FormField className="col-span-2" label={tFields('apartmentLabel')}>
        <Input
          value={props.apartment}
          onChange={(event) => props.onApartment(event.target.value)}
          placeholder={tFields('apartmentPlaceholder')}
          autoComplete="address-line2"
        />
      </FormField>
      <div className="col-span-2 grid grid-cols-2 gap-3 md:grid-cols-3">
        <FormField label={tFields('cityLabel')} required error={props.errors.city}>
          <Input
            value={props.city}
            onChange={(event) => {
              props.onCity(event.target.value);
              props.onClear('city');
            }}
            placeholder={tFields('cityPlaceholder')}
            autoComplete="address-level2"
            error={props.errors.city}
            aria-invalid={invalid('city')}
          />
        </FormField>
        <FormField label={tFields('stateLabel')} required error={props.errors.state}>
          <Input
            value={props.state}
          onChange={(event) => {
            props.onState(maskState(event.target.value));
            props.onClear('state');
          }}
            placeholder={tFields('statePlaceholder')}
            autoComplete="address-level1"
            maxLength={2}
            error={props.errors.state}
            aria-invalid={invalid('state')}
          />
        </FormField>
        <FormField label={tFields('zipCodeLabel')} required error={props.errors.zipCode}>
          <Input
            value={props.zipCode}
          onChange={(event) => {
            props.onZip(maskZip(event.target.value));
            props.onClear('zipCode');
          }}
          placeholder={tFields('zipCodePlaceholder')}
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={10}
            error={props.errors.zipCode}
            aria-invalid={invalid('zipCode')}
          />
        </FormField>
      </div>
    </div>
  );
}
