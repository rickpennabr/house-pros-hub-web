'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import AddressAutocomplete, { type AddressData } from '@/components/AddressAutocomplete';
import { formatCatalogPrice, type CatalogService, type ServiceUnit } from '@/lib/booking/catalogService';
import { icsPathFromManagePath, visitCalendarDescription, visitCalendarTitle } from '@/lib/booking/calendarLinks';
import { formatVisitAddress } from '@/lib/booking/visitAddress';
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
  onSuccess,
  onCancel,
}: ProEstimateBookingFlowProps) {
  const t = useTranslations('probot.booking');
  const tServices = useTranslations('businessServices');
  const locale = useLocale();
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
  const [error, setError] = useState<string | null>(null);

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
  const selectionLabel = [
    ...(generalEstimate ? [t('generalEstimate')] : []),
    ...chosenServices.map((service) => service.name),
  ].join(', ');

  useEffect(() => {
    let cancelled = false;
    setServicesReady(false);
    fetch(`/api/businesses/${encodeURIComponent(businessId)}/services`)
      .then((res) => (res.ok ? res.json() : { services: [] }))
      .then((data: { services?: CatalogService[] }) => {
        if (cancelled) return;
        const list = (data.services ?? []).filter((service) => service.isActive !== false);
        setServices(list);
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
  }, [businessId, initialServiceId]);

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

  const handleConfirm = async () => {
    if (!selectedSlot || !selectedDate) return;
    if (!visit.streetAddress.trim() || !visit.city.trim() || !visit.state.trim() || !visit.zipCode.trim()) {
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
      body.visitStreet = visit.streetAddress.trim();
      body.visitCity = visit.city.trim();
      body.visitState = visit.state.trim();
      body.visitZip = visit.zipCode.trim();
      if (visit.note.trim()) body.visitNote = visit.note.trim();
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
  const formatConfirmDateTime = () => {
    if (!selectedDate || !selectedSlot) return '';
    const start = new Date(selectedSlot.start);
    const dayPart = start.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: slotTimeZone,
    });
    return `${dayPart}, ${formatSlotRange(selectedSlot.start, selectedSlot.end)}`;
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
                    visit.note,
                    managePath && typeof window !== 'undefined' ? `${window.location.origin}${managePath}` : null,
                  ]),
                  location: formatVisitAddress({
                    street: visit.streetAddress,
                    city: visit.city,
                    state: visit.state,
                    zip: visit.zipCode,
                  }),
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
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto py-4 px-2">
        <p className="text-sm text-gray-500">{t('loadingSlots')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto py-4 px-2">
      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {error}
        </div>
      )}

      {step === 'service' && (
        <>
          <p className="text-base font-medium text-gray-900 mb-3">{t('pickService')}</p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setGeneralEstimate((current) => !current)}
              aria-pressed={generalEstimate}
              className={`w-full rounded-lg border-2 border-black p-3 text-left cursor-pointer ${generalEstimate ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'}`}
            >
              <p className="font-semibold">{t('generalEstimate')}</p>
            </button>
            {services.map((service) => {
              const selected = selectedServiceIds.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setSelectedServiceIds((current) => (
                      current.includes(service.id)
                        ? current.filter((id) => id !== service.id)
                        : [...current, service.id]
                    ));
                  }}
                  aria-pressed={selected}
                  className={`w-full rounded-lg border-2 border-black p-3 text-left cursor-pointer ${selected ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'}`}
                >
                  <p className="font-semibold">{service.name}</p>
                  <p className={`text-sm ${selected ? 'text-white' : 'text-gray-700'}`}>
                    {formatCatalogPrice(service, locale, {
                      requestPrice: tServices('requestPrice'),
                      from: tServices('from'),
                      units: unitLabels,
                    })}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-between gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
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
            <p className="mb-2 text-sm text-gray-700">
              <span className="font-medium">{t('service')}:</span> {selectionLabel}
            </p>
          )}
          <p className="text-base font-medium text-gray-900 mb-3">{t('pickYourDay')}</p>
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
              onClick={() => {
                if (services.length > 0) setStep('service');
                else onCancel();
              }}
            >
              {t('back')}
            </Button>
          </div>
        </>
      )}

      {step === 'slots' && (
        <>
          <button
            type="button"
            onClick={() => setStep('calendar')}
            className="text-sm font-medium text-gray-700 hover:text-black mb-3 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> {t('back')}
          </button>
          <p className="text-base font-medium text-gray-900 mb-1">{t('pickTime')}</p>
          <p className="mb-3 text-sm text-gray-600">{t('timesIn', { zone: timeZoneLabel(slotTimeZone, locale) })}</p>
          {slotsLoading ? (
            <p className="text-sm text-gray-500">{t('loadingSlots')}</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-500">{slotsNote || t('noSlots')}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => handleSlotSelect(slot)}
                  className="py-2.5 px-3 rounded-lg border-2 border-black bg-white text-sm font-medium hover:bg-gray-50 cursor-pointer"
                >
                  {formatSlotRange(slot.start, slot.end)}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === 'confirm' && selectedDate && selectedSlot && (
        <>
          <button
            type="button"
            onClick={() => setStep('slots')}
            className="text-sm font-medium text-gray-700 hover:text-black mb-3 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> {t('back')}
          </button>
          <p className="text-base font-medium text-gray-900 mb-3">{t('confirmAppointment')}</p>
          <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4 space-y-2">
            <p className="text-sm text-gray-700">
              <span className="font-medium">{t('dateTime')}:</span> {formatConfirmDateTime()}
            </p>
            {selectionLabel && (
              <p className="text-sm text-gray-700">
                <span className="font-medium">{t('service')}:</span> {selectionLabel}
              </p>
            )}
            <p className="text-sm text-gray-700">
              <span className="font-medium">{t('confirmWith', { name: businessName })}</span>
            </p>
            <p className="text-sm text-gray-600">{t('timesIn', { zone: timeZoneLabel(slotTimeZone, locale) })}</p>
          </div>
          <div className="mt-4 space-y-3">
            <p className="text-base font-medium text-gray-900">{t('visitAddress')}</p>
            <AddressAutocomplete
              id="visit-address"
              value={visit.streetAddress}
              placeholder={t('addressPlaceholder')}
              onChange={(streetAddress) => setVisit((current) => ({ ...current, streetAddress }))}
              onAddressSelect={(address: AddressData) =>
                setVisit((current) => ({
                  ...current,
                  streetAddress: address.streetAddress,
                  city: address.city,
                  state: address.state,
                  zipCode: address.zipCode,
                }))
              }
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Input value={visit.city} placeholder={t('city')} onChange={(event) => setVisit((current) => ({ ...current, city: event.target.value }))} />
              <Input value={visit.state} placeholder={t('state')} onChange={(event) => setVisit((current) => ({ ...current, state: event.target.value }))} />
              <Input value={visit.zipCode} placeholder={t('zip')} onChange={(event) => setVisit((current) => ({ ...current, zipCode: event.target.value }))} />
            </div>
            <Input value={visit.note} placeholder={t('notePlaceholder')} onChange={(event) => setVisit((current) => ({ ...current, note: event.target.value }))} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setStep('slots')}>
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
