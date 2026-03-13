'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { PROBOT_ASSETS } from '@/lib/constants/probot';
import { validateCustomerEmail, validateCustomerPhone } from '@/lib/schemas/crm';

const TYPING_SPEED_MS = 30;
const TYPING_INITIAL_DELAY_MS = 500;

const STEPS = [
  { id: 'first_name', field: 'first_name', type: 'text' as const, messageKey: 'firstName' },
  { id: 'last_name', field: 'last_name', type: 'text' as const, messageKey: 'lastName' },
  { id: 'company_name', field: 'company_name', type: 'text' as const, messageKey: 'companyName' },
  { id: 'display_name', field: 'display_name', type: 'text' as const, messageKey: 'displayName' },
  { id: 'email', field: 'email', type: 'email' as const, messageKey: 'email' },
  { id: 'phone', field: 'phone', type: 'tel' as const, messageKey: 'phone' },
  { id: 'mobile_number', field: 'mobile_number', type: 'tel' as const, messageKey: 'mobileNumber' },
  { id: 'website', field: 'website', type: 'url' as const, messageKey: 'website' },
  { id: 'street_address', field: 'street_address', type: 'text' as const, messageKey: 'streetAddress' },
  { id: 'apartment', field: 'apartment', type: 'text' as const, messageKey: 'apartment' },
  { id: 'city', field: 'city', type: 'text' as const, messageKey: 'city' },
  { id: 'state', field: 'state', type: 'text' as const, messageKey: 'state' },
  { id: 'zip_code', field: 'zip_code', type: 'text' as const, messageKey: 'zipCode' },
  { id: 'notes', field: 'notes', type: 'textarea' as const, messageKey: 'notes' },
] as const;

function formatDisplayValue(step: (typeof STEPS)[number], value: string | undefined): string {
  if (value === undefined || value === null) return '';
  const trimmed = String(value).trim();
  return trimmed || '—';
}

export interface AddCustomerFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  showBackToChoice?: boolean;
  onStepIndexChange?: (stepIndex: number) => void;
  onBotTypingChange?: (typing: boolean) => void;
}

export default function AddCustomerForm({
  onSuccess,
  onCancel,
  showBackToChoice = true,
  onStepIndexChange,
  onBotTypingChange,
}: AddCustomerFormProps) {
  const tBot = useTranslations('bot');
  const tSteps = useTranslations('bot.addCustomerSteps');
  const tPlaceholders = useTranslations('bot.addCustomerPlaceholders');
  const tCommon = useTranslations('common.button');
  const tValidation = useTranslations('validation');
  const [values, setValues] = useState<Record<string, string>>({
    first_name: '',
    last_name: '',
    company_name: '',
    display_name: '',
    email: '',
    phone: '',
    mobile_number: '',
    website: '',
    street_address: '',
    apartment: '',
    city: '',
    state: '',
    zip_code: '',
    notes: '',
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [typedLength, setTypedLength] = useState(0);
  const [typingStarted, setTypingStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentStep = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const currentMessage = currentStep ? tSteps(currentStep.messageKey) : '';
  const isTypingComplete = typedLength >= currentMessage.length;

  useEffect(() => {
    setTypedLength(0);
    setTypingStarted(false);
  }, [stepIndex, currentStep?.id]);

  useEffect(() => {
    onStepIndexChange?.(stepIndex);
  }, [stepIndex, onStepIndexChange]);

  useEffect(() => {
    onBotTypingChange?.(!!currentStep && !isTypingComplete);
    return () => onBotTypingChange?.(false);
  }, [currentStep, isTypingComplete, onBotTypingChange]);

  useEffect(() => {
    if (!currentStep || !currentMessage.length) return;
    const id = setTimeout(() => setTypingStarted(true), TYPING_INITIAL_DELAY_MS);
    return () => clearTimeout(id);
  }, [currentStep?.id, currentMessage.length]);

  useEffect(() => {
    if (!currentMessage.length || !typingStarted) return;
    if (typedLength >= currentMessage.length) return;
    const id = setTimeout(() => setTypedLength((n) => n + 1), TYPING_SPEED_MS);
    return () => clearTimeout(id);
  }, [currentMessage, typingStarted, typedLength]);

  const setValue = useCallback((field: string, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    if (!currentStep) return;
    const t = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(t);
  }, [currentStep?.id, stepIndex, isTypingComplete, scrollToBottom]);

  const handleBack = useCallback(() => {
    if (isFirst && showBackToChoice && onCancel) {
      onCancel();
      return;
    }
    if (stepIndex > 0) setStepIndex((i) => i - 1);
    setError(null);
  }, [isFirst, showBackToChoice, onCancel, stepIndex]);

  const validateAndNext = useCallback(() => {
    if (!currentStep) return;
    const raw = String(values[currentStep.field] ?? '').trim();
    if (currentStep.field === 'first_name' || currentStep.field === 'last_name') {
      if (!raw) {
        setError(
          currentStep.field === 'first_name'
            ? (tValidation('firstName.required') as string)
            : (tValidation('lastName.required') as string)
        );
        return;
      }
    }
    if (currentStep.field === 'email') {
      const emailError = validateCustomerEmail(raw);
      if (emailError) {
        setError(tValidation(emailError) as string);
        return;
      }
    }
    if (currentStep.field === 'phone') {
      const phoneError = validateCustomerPhone(raw, true);
      if (phoneError) {
        setError(tValidation(phoneError) as string);
        return;
      }
    }
    if (currentStep.field === 'mobile_number') {
      const mobileError = validateCustomerPhone(raw, false);
      if (mobileError) {
        setError(tValidation(mobileError) as string);
        return;
      }
    }
    setError(null);
    if (isLast) {
      const firstName = values.first_name?.trim();
      const lastName = values.last_name?.trim();
      const email = values.email?.trim();
      const phone = values.phone?.trim();
      const mobile = values.mobile_number?.trim();
      if (!firstName || !lastName) {
        setError('First name and last name are required.');
        return;
      }
      const emailErr = validateCustomerEmail(email ?? '');
      if (emailErr) {
        setError(tValidation(emailErr) as string);
        return;
      }
      const phoneErr = validateCustomerPhone(phone ?? '', true);
      if (phoneErr) {
        setError(tValidation(phoneErr) as string);
        return;
      }
      const mobileErr = validateCustomerPhone(mobile ?? '', false);
      if (mobileErr) {
        setError(tValidation(mobileErr) as string);
        return;
      }
      const trim = (s: string) => s.trim();
      setSubmitting(true);
      fetch('/api/crm/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          company_name: trim(values.company_name) || undefined,
          display_name: trim(values.display_name) || undefined,
          email: trim(values.email) || undefined,
          phone: phone.trim(),
          mobile_number: trim(values.mobile_number) || undefined,
          website: trim(values.website) || undefined,
          street_address: trim(values.street_address) || undefined,
          apartment: trim(values.apartment) || undefined,
          city: trim(values.city) || undefined,
          state: trim(values.state) || undefined,
          zip_code: trim(values.zip_code) || undefined,
          notes: trim(values.notes) || undefined,
        }),
      })
        .then((res) => {
          if (!res.ok)
            return res.json().then((d) => Promise.reject(new Error(d?.error ?? 'Failed to add customer')));
          return res.json();
        })
        .then(() => {
          onSuccess?.();
        })
        .catch((e: Error) => {
          setError(e.message ?? 'Failed to add customer. Please try again.');
        })
        .finally(() => setSubmitting(false));
      return;
    }
    setStepIndex((i) => i + 1);
    setTimeout(scrollToBottom, 100);
  }, [currentStep, values, isLast, tValidation, onSuccess, scrollToBottom]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      validateAndNext();
    },
    [validateAndNext]
  );

  const stepHasFocusableInput = currentStep && ['text', 'email', 'tel', 'url', 'textarea'].includes(currentStep.type);
  useEffect(() => {
    if (!isTypingComplete || !stepHasFocusableInput) return;
    const t = setTimeout(() => {
      const form = document.getElementById('add-customer-form');
      if (!form) return;
      const focusable = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]), textarea'
      );
      focusable?.focus();
    }, 200);
    return () => clearTimeout(t);
  }, [isTypingComplete, stepHasFocusableInput, currentStep?.id]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
        {/* Previous steps: bot message + user reply (same as ChatSignupForm) */}
        {STEPS.slice(0, stepIndex).map((step) => (
          <div key={step.id} className="flex flex-col gap-1">
            <div className="self-start max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 text-gray-900 px-3 py-2 text-sm">
              {tSteps(step.messageKey)}
            </div>
            <div className="self-end max-w-[85%] rounded-2xl rounded-tr-sm bg-gray-900 text-white px-3 py-2 text-sm">
              {formatDisplayValue(step, values[step.field])}
            </div>
          </div>
        ))}

        {/* Current step: ProBot typing then input */}
        {currentStep && (
          <div className="flex flex-col gap-2">
            <div className="self-start flex items-end gap-0 min-h-[48px] rounded-2xl overflow-hidden">
              <div
                className="shrink-0 flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center"
                aria-hidden
              >
                <img
                  src={isTypingComplete ? PROBOT_ASSETS.avatar : PROBOT_ASSETS.avatarAnimated}
                  alt=""
                  width={48}
                  height={48}
                  className="w-full h-full object-contain pointer-events-none"
                />
              </div>
              {typingStarted && (
                <div className="max-w-[85%] rounded-2xl bg-gray-100 text-gray-900 px-3 py-2 text-sm shadow-sm border-0">
                  {currentMessage.slice(0, typedLength)}
                  {!isTypingComplete && (
                    <span className="animate-blink-caret text-gray-700" aria-hidden>|</span>
                  )}
                </div>
              )}
            </div>
            {isTypingComplete && (
              <form
                id="add-customer-form"
                onSubmit={handleSubmit}
                className="flex flex-col gap-2 mt-1"
              >
                {error && (
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}
                {currentStep.type === 'tel' ? (
                  <Input
                    type="tel"
                    value={values[currentStep.field] ?? ''}
                    onChange={(e) => setValue(currentStep.field, e.target.value)}
                    placeholder={tPlaceholders(currentStep.messageKey)}
                    autoFocus
                    className="w-full"
                  />
                ) : currentStep.type === 'textarea' ? (
                  <textarea
                    value={values[currentStep.field] ?? ''}
                    onChange={(e) => setValue(currentStep.field, e.target.value)}
                    placeholder={tPlaceholders(currentStep.messageKey)}
                    autoFocus
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                ) : (
                  <Input
                    type={currentStep.type === 'url' ? 'url' : 'text'}
                    value={values[currentStep.field] ?? ''}
                    onChange={(e) => setValue(currentStep.field, e.target.value)}
                    placeholder={tPlaceholders(currentStep.messageKey)}
                    autoFocus
                    className="w-full"
                  />
                )}
              </form>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Bottom bar: Back + Next / Add customer - fixed at bottom, same as sign-up flow */}
      {isTypingComplete && currentStep && (
        <div className="shrink-0 flex items-center gap-2 p-3 border-t border-gray-200 bg-gray-50 flex-wrap">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1 py-2 px-3 text-sm font-medium text-gray-700 hover:text-black focus:outline-none focus:ring-2 focus:ring-black rounded-lg cursor-pointer"
            aria-label={tCommon('back')}
          >
            <ChevronLeft className="w-5 h-5" />
            {tCommon('back')}
          </button>
          <button
            type="submit"
            form="add-customer-form"
            disabled={submitting}
            className="py-2 px-4 rounded-xl border-2 border-black bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
          >
            {submitting
              ? tBot('addCustomerAdding')
              : isLast
                ? tBot('addCustomerSubmit')
                : tBot('addCustomerNext')}
          </button>
        </div>
      )}
    </div>
  );
}
