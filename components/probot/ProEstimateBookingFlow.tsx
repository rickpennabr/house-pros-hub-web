'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GoogleHandoffOverlay } from '@/components/auth/GoogleHandoffOverlay';
import { SignupStepsIndicator } from '@/app/[locale]/(auth)/signup/components/SignupStepsIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { formatCatalogPrice, type CatalogService, type ServiceUnit } from '@/lib/booking/catalogService';
import {
  clearBookingDraft,
  dateFromDraftDay,
  draftDayFromDate,
  readBookingDraft,
  saveBookingDraft,
} from '@/lib/booking/bookingDraft';
import { icsPathFromManagePath, visitCalendarDescription, visitCalendarTitle } from '@/lib/booking/calendarLinks';
import { formatVisitAddress } from '@/lib/booking/visitAddress';
import { startGoogleOAuth } from '@/lib/auth/googleOAuth';
import { createSignUpUrl } from '@/lib/redirect';
import AddToCalendar from '@/components/booking/AddToCalendar';

export interface GuestContactData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  apartment?: string;
}

interface ProEstimateBookingFlowProps {
  businessId: string;
  businessName: string;
  isAuthenticated: boolean;
  guestContact?: GuestContactData | null;
  /** Catalog service chosen from the business page, when the link includes ?service= */
  initialServiceId?: string | null;
  /** After signup, return here on the confirm step */
  bookingReturnPath?: string | null;
  /** Restore a saved draft and open confirm (from ?step=confirm) */
  resumeConfirm?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = 'service' | 'calendar' | 'slots' | 'confirm' | 'done';

export default function ProEstimateBookingFlow({
  businessId,
  businessName,
  isAuthenticated,
  guestContact,
  initialServiceId,
  bookingReturnPath,
  resumeConfirm = false,
  onSuccess,
  onCancel,
}: ProEstimateBookingFlowProps) {
  const t = useTranslations('probot.booking');
  const tServices = useTranslations('businessServices');
  const tHandoff = useTranslations('auth.googleHandoff');
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('calendar');
  const [managePath, setManagePath] = useState<string | null>(null);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [servicesReady, setServicesReady] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(initialServiceId ? [initialServiceId] : []);
  const [generalEstimate, setGeneralEstimate] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<{ start: string; end: string }[]>([]);
  const [slotTimeZone, setSlotTimeZone] = useState('America/Los_Angeles');
  const [slotsNote, setSlotsNote] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [visit, setVisit] = useState({
    streetAddress: guestContact?.streetAddress ?? '',
    city: guestContact?.city ?? '',
    state: guestContact?.state ?? '',
    zipCode: guestContact?.zipCode ?? '',
    note: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Account address (signup / Google finish) is the visit location — no address form on confirm.
  useEffect(() => {
    const street = user?.streetAddress?.trim() || guestContact?.streetAddress?.trim() || '';
    const city = user?.city?.trim() || guestContact?.city?.trim() || '';
    const state = user?.state?.trim() || guestContact?.state?.trim() || '';
    const zipCode = user?.zipCode?.trim() || guestContact?.zipCode?.trim() || '';
    if (!street && !city && !state && !zipCode) return;
    setVisit((current) => ({
      streetAddress: current.streetAddress || street,
      city: current.city || city,
      state: current.state || state,
      zipCode: current.zipCode || zipCode,
      note: current.note,
    }));
  }, [user, guestContact]);

  const monthLabel = new Date(year, month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array(firstDay).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const isPast = (d: number) => {
    const dte = new Date(year, month, d);
    dte.setHours(23, 59, 59);
    return dte < today;
  };

  const unitLabels: Record<ServiceUnit, string> = {
    job: tServices('job'),
    hour: tServices('hour'),
    sqft: tServices('sqft'),
    each: tServices('each'),
  };
  const chosenServices = services.filter((service) => selectedServiceIds.includes(service.id));
  const selectionItems = [
    ...(generalEstimate ? [t('generalEstimate')] : []),
    ...chosenServices.map((service) => service.name),
  ];
  const selectionLabel = selectionItems.join(', ');
  const selectionLabelKey = selectionItems.length > 1 ? 'services' : 'service';
  const stepTitleClass =
    'text-left text-[1.26rem] font-bold leading-tight text-gray-900 md:text-[1.2rem] md:font-medium md:leading-normal';
  const progressSteps = useMemo(
    () => (services.length > 0 ? (['service', 'calendar', 'slots', 'confirm'] as const) : (['calendar', 'slots', 'confirm'] as const)),
    [services.length]
  );
  const progressIndex = Math.max(1, progressSteps.indexOf(step as (typeof progressSteps)[number]) + 1);
  const progressLabel =
    step === 'service' || step === 'calendar' || step === 'slots' || step === 'confirm'
      ? t(`stepLabels.${step}`)
      : t('stepLabels.confirm');

  useEffect(() => {
    let cancelled = false;
    setServicesReady(false);
    setDraftRestored(false);
    fetch(`/api/businesses/${encodeURIComponent(businessId)}/services`)
      .then((res) => (res.ok ? res.json() : { services: [] }))
      .then((data: { services?: CatalogService[] }) => {
        if (cancelled) return;
        const list = (data.services ?? []).filter((service) => service.isActive !== false);
        setServices(list);

        const draft = resumeConfirm ? readBookingDraft(businessId) : null;
        if (draft?.selectedSlot) {
          const allowedIds = new Set(list.map((service) => service.id));
          setSelectedServiceIds(draft.selectedServiceIds.filter((id) => allowedIds.has(id)));
          setGeneralEstimate(draft.generalEstimate);
          const restoredDate = dateFromDraftDay(draft.selectedDate);
          if (restoredDate) {
            setSelectedDate(restoredDate);
            setYear(restoredDate.getFullYear());
            setMonth(restoredDate.getMonth());
          }
          setSelectedSlot(draft.selectedSlot);
          setVisit(draft.visit);
          setStep('confirm');
          setDraftRestored(true);
          return;
        }

        const initialOk = !!initialServiceId && list.some((service) => service.id === initialServiceId);
        setSelectedServiceIds(initialOk && initialServiceId ? [initialServiceId] : []);
        setGeneralEstimate(false);
        setStep(list.length > 0 && !initialOk ? 'service' : 'calendar');
      })
      .catch(() => {
        if (cancelled) return;
        setServices([]);
        setStep('calendar');
      })
      .finally(() => {
        if (!cancelled) setServicesReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, initialServiceId, resumeConfirm]);

  useEffect(() => {
    if (isAuthenticated && draftRestored) {
      clearBookingDraft(businessId);
    }
  }, [isAuthenticated, draftRestored, businessId]);

  const persistDraftForSignup = useCallback(() => {
    if (!selectedSlot) return;
    saveBookingDraft({
      businessId,
      selectedServiceIds,
      generalEstimate,
      selectedDate: selectedDate ? draftDayFromDate(selectedDate) : null,
      selectedSlot,
      visit,
      step: 'confirm',
    });
  }, [businessId, selectedServiceIds, generalEstimate, selectedDate, selectedSlot, visit]);

  const returnPathForAuth =
    bookingReturnPath ||
    `/${locale}/book/${encodeURIComponent(businessId)}?step=confirm`;

  const continueWithGoogle = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError(null);
    persistDraftForSignup();
    const result = await startGoogleOAuth({
      flow: 'customer',
      locale,
      returnUrl: returnPathForAuth,
    });
    if (result.ok) return;
    if (result.error === 'redirect_to_lan') return;
    setError(result.error === 'redirect_not_allowlisted' ? result.message : t('googleFailed'));
    setGoogleLoading(false);
  };

  const leaveForSignUp = () => {
    setError(null);
    persistDraftForSignup();
    router.push(createSignUpUrl(locale as 'en' | 'es' | 'pt', returnPathForAuth));
  };

  const fetchSlots = useCallback(async (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    setSlotsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/booking/slots?businessId=${encodeURIComponent(businessId)}&date=${y}-${m}-${d}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load times');
      if (typeof data.timezone === 'string' && data.timezone) setSlotTimeZone(data.timezone);
      if (data.bookingEnabled === false) {
        setSlots([]);
        setSlotsNote(t('notAccepting'));
      } else if (data.closed) {
        setSlots([]);
        setSlotsNote(t('closedDay'));
      } else {
        setSlots(data.slots ?? []);
        setSlotsNote(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load times');
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [businessId, t]);

  useEffect(() => {
    if (step === 'slots' && selectedDate) fetchSlots(selectedDate);
  }, [step, selectedDate, fetchSlots]);

  const handleDayClick = (d: number) => {
    if (isPast(d)) return;
    const date = new Date(year, month, d);
    setSelectedDate(date);
    setStep('slots');
  };

  const handleSlotSelect = (slot: { start: string; end: string }) => {
    setSelectedSlot(slot);
    setStep('confirm');
  };

  const needsAccountToSubmit = !isAuthenticated && !guestContact;

  const resolveVisitAddress = () => {
    const street =
      visit.streetAddress.trim() ||
      user?.streetAddress?.trim() ||
      guestContact?.streetAddress?.trim() ||
      '';
    const city = visit.city.trim() || user?.city?.trim() || guestContact?.city?.trim() || '';
    const state = visit.state.trim() || user?.state?.trim() || guestContact?.state?.trim() || '';
    const zip = visit.zipCode.trim() || user?.zipCode?.trim() || guestContact?.zipCode?.trim() || '';
    return { street, city, state, zip, note: visit.note.trim() };
  };

  const handleConfirm = async () => {
    if (needsAccountToSubmit) {
      setError(t('accountRequired'));
      return;
    }
    if (!selectedSlot || !selectedDate) return;
    const resolvedVisit = resolveVisitAddress();
    if (!resolvedVisit.street || !resolvedVisit.city || !resolvedVisit.state || !resolvedVisit.zip) {
      setError(t('addressRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Re-fetch slots for this date so we only submit if the slot is still available (avoids showing options that then fail)
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      const slotsRes = await fetch(
        `/api/booking/slots?businessId=${encodeURIComponent(businessId)}&date=${y}-${m}-${d}`
      );
      const slotsData = await slotsRes.json().catch(() => ({}));
      const currentSlots: { start: string; end: string }[] = slotsData.slots ?? [];
      const stillAvailable = currentSlots.some(
        (s) => s.start === selectedSlot.start && s.end === selectedSlot.end
      );
      if (!stillAvailable) {
        setError(t('slotNoLongerAvailable'));
        setStep('slots');
        setSelectedSlot(null);
        setSlots(currentSlots);
        return;
      }

      const body: Record<string, unknown> = {
        businessId,
        slotStartAt: selectedSlot.start,
        slotEndAt: selectedSlot.end,
      };
      if (chosenServices.length > 0) body.serviceIds = chosenServices.map((service) => service.id);
      if (generalEstimate) body.generalEstimate = true;
      body.locale = locale;
      body.visitStreet = resolvedVisit.street;
      body.visitCity = resolvedVisit.city;
      body.visitState = resolvedVisit.state;
      body.visitZip = resolvedVisit.zip;
      if (resolvedVisit.note) body.visitNote = resolvedVisit.note;
      if (!isAuthenticated && guestContact) {
        body.guestEmail = guestContact.email;
        body.guestFirstName = guestContact.firstName;
        body.guestLastName = guestContact.lastName;
        body.guestPhone = guestContact.phone || '';
      }
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      clearBookingDraft(businessId);
      setManagePath(typeof data.managePath === 'string' ? data.managePath : null);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const formatSlotTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: slotTimeZone,
    });
  /** Display slot as range e.g. "7:00 AM – 8:30 AM" */
  const formatSlotRange = (startIso: string, endIso: string) => {
    const start = new Date(startIso);
    const end = new Date(endIso);
    return `${formatSlotTime(startIso)} – ${formatSlotTime(endIso)}`;
  };
  const formatConfirmDay = () => {
    if (!selectedSlot) return '';
    return new Date(selectedSlot.start).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: slotTimeZone,
    });
  };

  if (step === 'done') {
    return (
      <div className="flex flex-col flex-1 min-h-0 py-4 px-2 overflow-y-auto">
        <div className="bg-white border-2 border-black rounded-lg p-6 flex flex-col justify-center text-center mx-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-black">{t('successTitle')}</h2>
          <p className="text-gray-700 text-sm">{t('successMessage')}</p>
          <p className="mt-2 text-sm text-gray-600">{t('manageHint')}</p>
          {selectedSlot && (
            <div className="mt-4">
              <AddToCalendar
                align="center"
                icsHref={icsPathFromManagePath(managePath)}
                event={{
                  title: visitCalendarTitle(businessName, selectionLabel),
                  description: visitCalendarDescription([
                    businessName,
                    resolveVisitAddress().note,
                    managePath && typeof window !== 'undefined' ? `${window.location.origin}${managePath}` : null,
                  ]),
                  location: formatVisitAddress(resolveVisitAddress()),
                  startAt: selectedSlot.start,
                  endAt: selectedSlot.end,
                }}
              />
            </div>
          )}
          <div className="mt-4 flex flex-col items-center gap-2">
            {managePath && (
              <Link href={managePath} className="inline-flex rounded-lg border-2 border-black bg-black px-3 py-1.5 text-sm font-medium text-white">
                {t('manageAppointment')}
              </Link>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSuccess}
            >
              {t('goHome')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!servicesReady) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-2 md:py-4">
        <p className="text-sm text-gray-500">{t('loadingSlots')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto px-2 md:py-4">
      <GoogleHandoffOverlay
        open={googleLoading}
        title={tHandoff('title')}
        subtitle={tHandoff('subtitle')}
      />
      <div className="mb-4">
        <SignupStepsIndicator
          currentStep={progressIndex}
          totalSteps={progressSteps.length}
          stepLabel={progressLabel}
        />
      </div>
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {step === 'service' && (
        <>
          <p className="mb-3 text-center text-[1.04rem] font-bold leading-tight text-gray-900 md:text-left md:text-[1.2rem] md:font-medium md:leading-normal">{t('pickService')}</p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setGeneralEstimate((current) => {
                  const next = !current;
                  if (next) setSelectedServiceIds([]);
                  return next;
                });
              }}
              aria-pressed={generalEstimate}
              className={`w-full cursor-pointer rounded-lg border-2 border-black p-2 text-center md:p-3 ${generalEstimate ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'}`}
            >
              <p className="font-semibold">{t('generalEstimate')}</p>
            </button>
            {services.map((service) => {
              const selected = selectedServiceIds.includes(service.id);
              const blockedByGeneral = generalEstimate;
              const thumb = service.imageUrl || service.imageUrls?.[0] || null;
              const price = formatCatalogPrice(service, locale, {
                requestPrice: tServices('requestPrice'),
                from: tServices('from'),
                units: unitLabels,
              });
              const priceClass = `text-sm font-bold ${selected ? 'text-white' : blockedByGeneral ? 'text-gray-400' : 'text-green-600'}`;
              const thumbRing = selected ? 'ring-1 ring-white/70' : 'ring-1 ring-black/20';
              return (
                <button
                  key={service.id}
                  type="button"
                  disabled={blockedByGeneral}
                  onClick={() => {
                    if (generalEstimate) return;
                    setSelectedServiceIds((current) => (
                      current.includes(service.id)
                        ? current.filter((id) => id !== service.id)
                        : [...current, service.id]
                    ));
                  }}
                  aria-pressed={selected}
                  aria-disabled={blockedByGeneral}
                  className={`w-full rounded-lg border-2 border-black p-2 text-left md:self-start md:p-3 ${
                    selected
                      ? 'cursor-pointer bg-black text-white'
                      : blockedByGeneral
                        ? 'cursor-not-allowed bg-gray-100 text-gray-400 opacity-60'
                        : 'cursor-pointer bg-white text-black hover:bg-gray-50'
                  }`}
                >
                  {/* Mobile: thumb + name on top, price under */}
                  <div className="md:hidden">
                    <div className="flex items-start gap-2">
                      {thumb ? (
                        <Image
                          src={thumb}
                          alt=""
                          width={40}
                          height={40}
                          className={`h-10 w-10 shrink-0 rounded object-cover ${thumbRing}`}
                        />
                      ) : null}
                      <p className="min-w-0 flex-1 font-semibold leading-tight">{service.name}</p>
                    </div>
                    <p className={`mt-1 text-center ${priceClass}`}>{price}</p>
                  </div>
                  {/* Desktop: square image left; tight name → description → price stack, equal p-3 inset */}
                  <div className="hidden md:flex md:items-start md:gap-3">
                    {thumb ? (
                      <Image
                        src={thumb}
                        alt=""
                        width={72}
                        height={72}
                        className={`h-[4.5rem] w-[4.5rem] shrink-0 rounded-lg object-cover ${thumbRing}`}
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                      <p className="font-semibold leading-tight">{service.name}</p>
                      {service.description?.trim() ? (
                        <p className={`line-clamp-2 text-xs leading-snug ${selected ? 'text-white/80' : blockedByGeneral ? 'text-gray-400' : 'text-gray-600'}`}>
                          {service.description.trim()}
                        </p>
                      ) : null}
                      <p className={`text-left leading-tight ${priceClass}`}>{price}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-between gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel} className="inline-flex items-center gap-2">
              <ArrowLeft className="h-5 w-5 shrink-0 text-red-500" />
              {t('back')}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!generalEstimate && chosenServices.length === 0}
              onClick={() => setStep('calendar')}
            >
              {t('continueToCalendar')}
            </Button>
          </div>
        </>
      )}

      {step === 'calendar' && (
        <>
          {selectionLabel && (
            <p className={`mb-2 ${stepTitleClass}`}>
              <span className="font-bold md:font-medium">{t(selectionLabelKey)}:</span> {selectionLabel}
            </p>
          )}
          <p className={`mb-3 ${stepTitleClass}`}>
            {t('pickYourDay')}
          </p>
          <div className="border-2 border-black rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-gray-50">
              <button
                type="button"
                onClick={prevMonth}
                className="p-2 rounded-lg border-2 border-black hover:bg-gray-100 cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-gray-900">{monthLabel}</h2>
              <button
                type="button"
                onClick={nextMonth}
                className="p-2 rounded-lg border-2 border-black hover:bg-gray-100 cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-7 border-b-2 border-black bg-gray-100">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="font-semibold text-gray-700 py-2 text-center text-sm border-r border-gray-300 last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr">
              {blanks.map((_, i) => (
                <div key={`b-${i}`} className="min-h-[56px] bg-gray-50 border-b border-r border-gray-200" />
              ))}
              {days.map((d) => {
                const isToday = isCurrentMonth && d === today.getDate();
                const disabled = isPast(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDayClick(d)}
                    disabled={disabled}
                    className={`min-h-[56px] flex items-center justify-center border-b border-r border-gray-200 bg-white text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-black disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 ${isToday ? 'ring-2 ring-black ring-inset bg-amber-50/50' : ''}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 flex justify-start">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="inline-flex items-center gap-2"
              onClick={() => {
                if (services.length > 0) setStep('service');
                else onCancel();
              }}
            >
              <ArrowLeft className="h-5 w-5 shrink-0 text-red-500" />
              {t('back')}
            </Button>
          </div>
        </>
      )}

      {step === 'slots' && (
        <>
          <p className={`mb-1 ${stepTitleClass}`}>
            {t('pickTime')}
          </p>
          <p className={`mb-3 ${stepTitleClass}`}>
            {t('timesIn', { zone: timeZoneLabel(slotTimeZone, locale) })}
          </p>
          <div className="border-2 border-black rounded-lg overflow-hidden bg-white p-2">
            {slotsLoading ? (
              <p className="text-sm text-gray-500">{t('loadingSlots')}</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-500">{slotsNote || t('noSlots')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    onClick={() => handleSlotSelect(slot)}
                    className="cursor-pointer rounded-lg border-2 border-black bg-white px-3 py-2.5 text-sm font-medium hover:bg-gray-50"
                  >
                    {formatSlotRange(slot.start, slot.end)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-start">
            <Button type="button" variant="secondary" size="sm" className="inline-flex items-center gap-2" onClick={() => setStep('calendar')}>
              <ArrowLeft className="h-5 w-5 shrink-0 text-red-500" />
              {t('back')}
            </Button>
          </div>
        </>
      )}

      {step === 'confirm' && selectedDate && selectedSlot && (
        <>
          <p className={`mb-3 ${stepTitleClass}`}>
            {t('confirmAppointment')}
          </p>
          <div className="space-y-2 rounded-lg border-2 border-gray-200 bg-gray-50 p-0 md:p-4">
            <div className={stepTitleClass}>
              <p>
                <span className="font-bold md:font-medium">{t('dateTime')}:</span> {formatConfirmDay()}
              </p>
              <p>{formatSlotRange(selectedSlot.start, selectedSlot.end)}</p>
            </div>
            {selectionLabel && (
              <p className={stepTitleClass}>
                <span className="font-bold md:font-medium">{t(selectionLabelKey)}:</span> {selectionLabel}
              </p>
            )}
            <p className={stepTitleClass}>
              {t('confirmWith', { name: businessName })}
            </p>
            <p className={stepTitleClass}>
              {t('timesIn', { zone: timeZoneLabel(slotTimeZone, locale) })}
            </p>
          </div>
          {needsAccountToSubmit ? (
            <div className="mt-4 space-y-3 border-t-2 border-black pt-4">
              <h2 className="text-lg font-bold text-black">{t('accountTitle')}</h2>
              <p className="text-sm text-gray-700">{t('accountBody')}</p>
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
                  variant="primary"
                  onClick={leaveForSignUp}
                  className="flex w-full items-center justify-center gap-2"
                >
                  <ClipboardList className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {t('signUp')}
                </Button>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="inline-flex items-center gap-2"
                onClick={() => setStep('slots')}
              >
                <ArrowLeft className="h-5 w-5 shrink-0 text-red-500" />
                {t('back')}
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" className="inline-flex items-center gap-2" onClick={() => setStep('slots')}>
                <ArrowLeft className="h-5 w-5 shrink-0 text-red-500" />
                {t('back')}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting ? t('confirming') : t('confirm')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function timeZoneLabel(timeZone: string, locale: string): string {
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'longGeneric' })
      .formatToParts(new Date())
      .find((item) => item.type === 'timeZoneName');
    return part?.value || timeZone;
  } catch {
    return timeZone;
  }
}
