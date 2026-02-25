'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, User, X, Pencil, Check } from 'lucide-react';
import { GrUserWorker } from 'react-icons/gr';
import { useLocale } from 'next-intl';
import AddressAutocomplete, { AddressData } from '@/components/AddressAutocomplete';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { ZoomSlider } from '@/components/ui/ZoomSlider';
import { VerticalSlider } from '@/components/ui/VerticalSlider';
import { HorizontalSlider } from '@/components/ui/HorizontalSlider';
import { signupSchema, signupSchemaBase, type SignupSchema } from '@/lib/schemas/auth';
import { USER_TYPES } from '@/lib/constants/auth';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import { resizeImageSquare, validateFileSize } from '@/lib/utils/image';
import { CHAT_SIGNUP_STEPS, getVisibleSteps, type ChatSignupStep } from './chatSignupSteps';
import { useAuth } from '@/contexts/AuthContext';

const TYPING_SPEED_MS = 30; // Fast typing for form bot
const TYPING_INITIAL_DELAY_MS = 500;

const defaultValues: Record<string, string | boolean> = {
  userType: USER_TYPES.CUSTOMER,
  userPicture: '',
  firstName: '',
  lastName: '',
  referral: '',
  referralOther: '',
  address: '',
  streetAddress: '',
  city: '',
  state: 'NV',
  zipCode: '',
  apartment: '',
  gateCode: '',
  addressNote: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  agreeToTerms: false,
  invitationCode: '',
};

function formatDisplayValue(step: ChatSignupStep, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (step.id === 'userType') return value === USER_TYPES.CONTRACTOR ? 'Contractor' : 'Customer';
  if (step.id === 'userPicture') return value ? 'Photo added' : '';
  if (step.id === 'agreeToTerms') return value ? 'I agree' : '';
  if (step.id === 'invitationCode') return value ? 'Entered' : '';
  // Never expose password or confirmPassword in chat history
  if (step.id === 'password' || step.id === 'confirmPassword' || step.type === 'password') {
    return typeof value === 'string' && value.length > 0 ? '••••••••' : '';
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export interface ChatSignupFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  /** When true, show back button that calls onCancel (e.g. return to choice screen) */
  showBackToChoice?: boolean;
  /** Called when the current step index changes (e.g. for close warning after step 3) */
  onStepIndexChange?: (stepIndex: number) => void;
  /** Called when bot typing state changes (true = typing) so parent can hide header image */
  onBotTypingChange?: (typing: boolean) => void;
}

export default function ChatSignupForm({
  onSuccess,
  onCancel,
  showBackToChoice = true,
  onStepIndexChange,
  onBotTypingChange,
}: ChatSignupFormProps) {
  const locale = useLocale();
  const tChat = useTranslations('auth.signup.chat');
  const tFields = useTranslations('auth.signup.fields');
  const tTerms = useTranslations('auth.signup.terms');
  const tNav = useTranslations('auth.signup.navigation');
  const tRole = useTranslations('auth.signup.roleSelection');
  const { login, checkAuth } = useAuth();
  const [values, setValues] = useState<Record<string, string | boolean>>(defaultValues);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingStep, setIsCheckingStep] = useState(false);
  const [typedLength, setTypedLength] = useState(0);
  const [signupTypingStarted, setSignupTypingStarted] = useState(false);
  const [picturePreview, setPicturePreview] = useState<string | null>(null);
  const [pictureOriginal, setPictureOriginal] = useState<string | null>(null);
  const [pictureZoom, setPictureZoom] = useState(50);
  const [pictureVert, setPictureVert] = useState(50);
  const [pictureHorz, setPictureHorz] = useState(50);
  const [pictureEditMode, setPictureEditMode] = useState(false);
  const pictureZoomRef = useRef(50);
  const pictureVertRef = useRef(50);
  const pictureHorzRef = useRef(50);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focusedReferralIndex, setFocusedReferralIndex] = useState(-1);
  const referralButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const referralContainerRef = useRef<HTMLDivElement>(null);

  const visibleSteps = useMemo(() => getVisibleSteps(values as Record<string, unknown>), [values]);
  const currentStep = visibleSteps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === visibleSteps.length - 1;

  const currentMessage = currentStep
    ? tChat(currentStep.messageKey as Parameters<typeof tChat>[0])
    : '';
  const isTypingComplete = typedLength >= currentMessage.length;

  useEffect(() => {
    setTypedLength(0);
    setSignupTypingStarted(false);
    if (currentStep?.id === 'referral') setFocusedReferralIndex(-1);
  }, [stepIndex, currentStep?.id]);

  useEffect(() => {
    if (currentStep?.id === 'referral' && typedLength >= currentMessage.length) {
      referralContainerRef.current?.focus({ preventScroll: true });
    }
  }, [currentStep?.id, typedLength, currentMessage.length]);

  useEffect(() => {
    onStepIndexChange?.(stepIndex);
  }, [stepIndex, onStepIndexChange]);

  useEffect(() => {
    onBotTypingChange?.(!!currentStep && !isTypingComplete);
    return () => onBotTypingChange?.(false);
  }, [currentStep, isTypingComplete, onBotTypingChange]);

  useEffect(() => {
    if (!currentStep || !currentMessage.length) return;
    const id = setTimeout(() => setSignupTypingStarted(true), TYPING_INITIAL_DELAY_MS);
    return () => clearTimeout(id);
  }, [currentStep?.id, currentMessage.length]);

  useEffect(() => {
    if (!currentMessage.length || !signupTypingStarted) return;
    if (typedLength >= currentMessage.length) return;
    const id = setTimeout(() => setTypedLength((n) => n + 1), TYPING_SPEED_MS);
    return () => clearTimeout(id);
  }, [currentMessage, signupTypingStarted, typedLength]);

  useEffect(() => {
    pictureZoomRef.current = pictureZoom;
  }, [pictureZoom]);
  useEffect(() => {
    pictureVertRef.current = pictureVert;
  }, [pictureVert]);
  useEffect(() => {
    pictureHorzRef.current = pictureHorz;
  }, [pictureHorz]);

  useEffect(() => {
    const photo = values.userPicture && typeof values.userPicture === 'string' ? values.userPicture : '';
    if (currentStep?.id === 'userPicture' && photo && !pictureOriginal) {
      setPicturePreview(photo);
      setPictureOriginal(photo);
    }
  }, [currentStep?.id, values.userPicture, pictureOriginal]);

  const setValue = useCallback((field: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    if (!currentStep) return;
    const t = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(t);
  }, [currentStep?.id, stepIndex, isTypingComplete, scrollToBottom]);

  const stepHasFocusableInput = currentStep && ['text', 'email', 'tel', 'password', 'address', 'textarea'].includes(currentStep.type);
  useEffect(() => {
    if (!isTypingComplete || !stepHasFocusableInput) return;
    const t = setTimeout(() => {
      const form = document.getElementById('chat-signup-form');
      if (!form) return;
      const focusable = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]):not([type="checkbox"]):not([type="file"]), textarea'
      );
      focusable?.focus();
    }, 200);
    return () => clearTimeout(t);
  }, [isTypingComplete, stepHasFocusableInput, currentStep?.id]);

  const handleBack = useCallback(() => {
    if (isFirstStep && showBackToChoice && onCancel) {
      onCancel();
      return;
    }
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }, [isFirstStep, showBackToChoice, onCancel, stepIndex]);

  const handleAddressSelect = useCallback(
    (data: AddressData) => {
      setValues((prev) => ({
        ...prev,
        address: data.fullAddress,
        streetAddress: data.streetAddress,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
      }));
    },
    []
  );

  const handleAddressChange = useCallback((value: string) => {
    setValues((prev) => ({ ...prev, address: value }));
  }, []);

  const goNext = useCallback(() => {
    if (stepIndex < visibleSteps.length - 1) {
      setStepIndex((i) => i + 1);
      setError(null);
      setTimeout(scrollToBottom, 100);
    }
  }, [stepIndex, visibleSteps.length, scrollToBottom]);

  const validateCurrentStep = useCallback((): boolean => {
    const step = visibleSteps[stepIndex];
    if (!step?.field) return true;
    const fieldSchema = signupSchemaBase.shape[step.field as keyof typeof signupSchemaBase.shape];
    if (!fieldSchema) return true;
    const fieldValue = values[step.field];
    const parsed = fieldSchema.safeParse(fieldValue);
    if (parsed.success) return true;
    // Zod uses .issues (not .errors); guard against empty issues
    const firstIssue = parsed.error.issues[0];
    const msg = firstIssue?.message ?? parsed.error.message ?? 'Please fix this field.';
    setError(msg);
    return false;
  }, [visibleSteps, stepIndex, values]);

  const handleSubmitStep = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!currentStep) return;
      // Role step is handled only by button clicks; ignore form submit (e.g. Enter key)
      if (currentStep.id === 'role') return;
      if (currentStep.id === 'agreeToTerms') {
        const raw: SignupSchema = {
          ...values,
          userType: values.userType as 'customer' | 'contractor',
          agreeToTerms: Boolean(values.agreeToTerms),
        } as SignupSchema;
        const parsed = signupSchema.safeParse(raw);
        if (!parsed.success) {
          const flattened = parsed.error.flatten().fieldErrors;
          const firstMsg =
            (Object.values(flattened).flat().find((m): m is string => typeof m === 'string') as string | undefined) ??
            parsed.error.issues[0]?.message;
          setError(firstMsg ?? 'Please fix the form.');
          return;
        }
        const data = parsed.data;
        (async () => {
          const email = data.email?.trim().toLowerCase();
          if (email) {
            try {
              const checkRes = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
              });
              const checkData = await checkRes.json().catch(() => ({}));
              if (checkData.available === false) {
                setError(tChat('emailAlreadyExists'));
                return;
              }
            } catch {
              setError('Unable to verify email. Please try again.');
              return;
            }
          }
          setIsSubmitting(true);
          setError(null);
          try {
            const res = await fetch('/api/auth/signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: data.email,
                password: data.password,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                referral: data.referral,
                referralOther: data.referralOther,
                streetAddress: data.streetAddress,
                apartment: data.apartment,
                city: data.city,
                state: data.state,
                zipCode: data.zipCode,
                gateCode: data.gateCode,
                addressNote: data.addressNote,
                userPicture: data.userPicture,
                userType: data.userType,
                ...(data.userType === 'contractor' && data.invitationCode ? { invitationCode: String(data.invitationCode).trim() } : {}),
              }),
            });
            if (!res.ok) {
              const d = await res.json().catch(() => ({}));
              throw new Error(d.error ?? 'Sign up failed');
            }
            // Sign in immediately so the user can submit an estimate from the chat right after signup
            if (data.email && data.password) {
              const loginTimeoutMs = 8000;
              try {
                await Promise.race([
                  login(data.email, data.password),
                  new Promise<void>((_, reject) =>
                    setTimeout(() => reject(new Error('Login timeout')), loginTimeoutMs)
                  ),
                ]);
                await checkAuth();
              } catch {
                setError(tChat('accountCreatedSignIn') ?? 'Account created. Please sign in with your email and password.');
              }
            }
            setIsSubmitting(false);
            onSuccess?.();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Sign up failed');
          } finally {
            setIsSubmitting(false);
          }
        })();
        return;
      }
      if (!validateCurrentStep()) return;
      // Phone step: require non-empty and valid format in chat form
      if (currentStep.id === 'phone') {
        const phone = String(values.phone ?? '').trim();
        if (!phone) {
          setError(tFields('phoneRequired') ?? 'Phone number is required.');
          return;
        }
        const phoneParsed = signupSchemaBase.shape.phone.safeParse(phone);
        if (!phoneParsed.success) {
          const msg = phoneParsed.error.issues[0]?.message ?? 'Invalid phone format (e.g. 702-555-0123)';
          setError(msg);
          return;
        }
      }
      // Require passwords to match before advancing to agreeToTerms
      if (currentStep.id === 'confirmPassword') {
        const password = String(values.password ?? '').trim();
        const confirmPassword = String(values.confirmPassword ?? '').trim();
        if (password !== confirmPassword) {
          setError(tChat('passwordsDoNotMatch'));
          return;
        }
      }
      // Email step: check availability before advancing
      if (currentStep.id === 'email') {
        const email = String(values.email ?? '').trim().toLowerCase();
        if (!email) {
          setError(tFields('emailRequired') ?? 'Email is required.');
          return;
        }
        setIsCheckingStep(true);
        setError(null);
        fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
          .then((res) => res.json().catch(() => ({})))
          .then((checkData: { available?: boolean }) => {
            if (checkData.available === false) {
              setError(tChat('emailAlreadyExists'));
              return;
            }
            goNext();
          })
          .catch(() => setError('Unable to check email. Please try again.'))
          .finally(() => setIsCheckingStep(false));
        return;
      }
      // Invitation code step (contractors): validate code before advancing
      if (currentStep.id === 'invitationCode') {
        const code = String(values.invitationCode ?? '').trim();
        if (!code) {
          setError('Invitation code is required for contractor signup.');
          return;
        }
        setIsCheckingStep(true);
        setError(null);
        fetch('/api/auth/validate-invitation-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
          .then((res) => res.json().catch(() => ({})))
          .then((data: { valid?: boolean; error?: string }) => {
            if (data.valid !== true) {
              setError(data.error ?? 'Invalid or expired invitation code.');
              return;
            }
            goNext();
          })
          .catch(() => setError('Unable to validate code. Please try again.'))
          .finally(() => setIsCheckingStep(false));
        return;
      }
      goNext();
    },
    [currentStep, values, validateCurrentStep, goNext, login, checkAuth, onSuccess, tChat, tFields]
  );

  const applyPictureZoom = useCallback(
    async (imageSrc: string, zoomVal: number, vertPos?: number, horzPos?: number) => {
      const vert = vertPos ?? pictureVertRef.current;
      const horz = horzPos ?? pictureHorzRef.current;
      const zoomFactor = 0.5 + (zoomVal / 100) * 1.5;
      try {
        const resized = await resizeImageSquare(imageSrc, 400, 0.85, zoomFactor, vert, horz);
        setPicturePreview(resized);
        setValue('userPicture', resized);
      } catch {
        try {
          const fallback = await resizeImageSquare(imageSrc, 400, 0.85);
          setPicturePreview(fallback);
          setValue('userPicture', fallback);
        } catch {
          setPicturePreview(imageSrc);
          setValue('userPicture', imageSrc);
        }
      }
    },
    [setValue]
  );

  const handlePictureZoomChange = useCallback(
    (zoomVal: number) => {
      setPictureZoom(zoomVal);
      pictureZoomRef.current = zoomVal;
      if (pictureOriginal && pictureEditMode) {
        applyPictureZoom(pictureOriginal, zoomVal, pictureVertRef.current, pictureHorzRef.current);
      }
    },
    [pictureOriginal, pictureEditMode, applyPictureZoom]
  );

  const handlePictureVerticalChange = useCallback(
    (position: number) => {
      setPictureVert(position);
      pictureVertRef.current = position;
      if (pictureOriginal && pictureEditMode) {
        applyPictureZoom(pictureOriginal, pictureZoomRef.current, position, pictureHorzRef.current);
      }
    },
    [pictureOriginal, pictureEditMode, applyPictureZoom]
  );

  const handlePictureHorizontalChange = useCallback(
    (position: number) => {
      setPictureHorz(position);
      pictureHorzRef.current = position;
      if (pictureOriginal && pictureEditMode) {
        applyPictureZoom(pictureOriginal, pictureZoomRef.current, pictureVertRef.current, position);
      }
    },
    [pictureOriginal, pictureEditMode, applyPictureZoom]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setError(tFields('imageTypeError'));
        return;
      }
      if (!validateFileSize(file, 5)) {
        setError(tFields('imageSizeError'));
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        setPictureOriginal(result);
        setPictureZoom(50);
        setPictureVert(50);
        setPictureHorz(50);
        pictureZoomRef.current = 50;
        pictureVertRef.current = 50;
        pictureHorzRef.current = 50;
        setPictureEditMode(true);
        await applyPictureZoom(result, 50, 50, 50);
      };
      reader.readAsDataURL(file);
    },
    [tFields, applyPictureZoom]
  );

  const handleRemovePicture = useCallback(() => {
    setPicturePreview(null);
    setPictureOriginal(null);
    setPictureZoom(50);
    setPictureVert(50);
    setPictureHorz(50);
    pictureZoomRef.current = 50;
    pictureVertRef.current = 50;
    pictureHorzRef.current = 50;
    setPictureEditMode(false);
    setValue('userPicture', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [setValue]);

  const handlePictureConfirm = useCallback(async () => {
    if (pictureOriginal) {
      await applyPictureZoom(
        pictureOriginal,
        pictureZoomRef.current,
        pictureVertRef.current,
        pictureHorzRef.current
      );
    }
    setPictureEditMode(false);
  }, [pictureOriginal, applyPictureZoom]);

  const displayValue = currentStep ? formatDisplayValue(currentStep, values[currentStep.field ?? currentStep.id]) : '';

  const showBackInBar = stepIndex > 0 || (isFirstStep && showBackToChoice);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Chat messages + current input */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
        {visibleSteps.slice(0, stepIndex).map((step) => (
          <div key={step.id} className="flex flex-col gap-1">
            <div className="self-start max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 text-gray-900 px-3 py-2 text-sm">
              {tChat(step.messageKey as Parameters<typeof tChat>[0])}
            </div>
            <div className="self-end max-w-[85%] rounded-2xl rounded-tr-sm bg-gray-900 text-white px-3 py-2 text-sm">
              {formatDisplayValue(step, values[step.field ?? step.id])}
            </div>
          </div>
        ))}

        {currentStep && (
          <div className="flex flex-col gap-2">
            <div className="self-start flex items-end gap-0 min-h-[48px] rounded-2xl overflow-hidden">
              {/* Bot avatar: typing gif while typing, static image when done; stays in place for next step */}
              <div className="shrink-0 flex-shrink-0 w-12 h-12 flex items-center justify-center" aria-hidden>
                <img
                  src={isTypingComplete ? '/pro-bot-typing.png' : '/pro-bot-solo-typing-new.gif'}
                  alt=""
                  width={48}
                  height={48}
                  className="w-12 h-12 object-contain pointer-events-none"
                />
              </div>
              {signupTypingStarted && (
                <div className="max-w-[85%] rounded-2xl bg-gray-100 text-gray-900 px-3 py-2 text-sm shadow-sm border-0">
                  {currentMessage.slice(0, typedLength)}
                  {!isTypingComplete && (
                    <span className="animate-blink-caret text-gray-700" aria-hidden>|</span>
                  )}
                </div>
              )}
            </div>
            {isTypingComplete && (
              <form id="chat-signup-form" onSubmit={handleSubmitStep} className="flex flex-col gap-2 mt-1">
                {error && (
                  <p className="text-sm text-red-600" role="alert">
                    {error}
                  </p>
                )}
                {currentStep.type === 'choice' && currentStep.id === 'role' && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setValues((prev) => ({ ...prev, userType: USER_TYPES.CUSTOMER }));
                        setStepIndex((i) => i + 1);
                        setError(null);
                        setTimeout(scrollToBottom, 100);
                      }}
                      className="w-full p-4 border-2 border-black rounded-lg bg-white hover:bg-gray-50 active:bg-gray-100 transition-all duration-300 hover:scale-[1.02] cursor-pointer text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg border-2 border-black bg-white flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                          <User className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-black mb-0.5">
                            {tRole('customer.title')}
                          </h3>
                          <p className="text-xs text-gray-600">
                            {tRole('customer.description')}
                          </p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setValues((prev) => ({ ...prev, userType: USER_TYPES.CONTRACTOR }));
                        setStepIndex((i) => i + 1);
                        setError(null);
                        setTimeout(scrollToBottom, 100);
                      }}
                      className="w-full p-4 border-2 border-black rounded-lg bg-white hover:bg-gray-50 active:bg-gray-100 transition-all duration-300 hover:scale-[1.02] cursor-pointer text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg border-2 border-black bg-white flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                          <GrUserWorker className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-black mb-0.5">
                            {tRole('contractor.titleWithCode')}
                          </h3>
                          <p className="text-xs text-gray-600">
                            {tRole('contractor.description')}
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              {currentStep.type === 'choice' && currentStep.id === 'referral' && (() => {
                const REFERRAL_OPTS = [
                  { value: 'Google', label: 'Google' },
                  { value: 'Instagram', label: 'Instagram' },
                  { value: 'Facebook', label: 'Facebook' },
                  { value: 'Other', label: tFields('referralOtherOption') },
                ];
                const handleReferralKeyDown = (e: React.KeyboardEvent) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = focusedReferralIndex < 0 ? 0 : (focusedReferralIndex + 1) % REFERRAL_OPTS.length;
                    setFocusedReferralIndex(next);
                    referralButtonRefs.current[next]?.focus();
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const last = REFERRAL_OPTS.length - 1;
                    const prev = focusedReferralIndex < 0 ? last : (focusedReferralIndex - 1 + REFERRAL_OPTS.length) % REFERRAL_OPTS.length;
                    setFocusedReferralIndex(prev);
                    referralButtonRefs.current[prev]?.focus();
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (focusedReferralIndex >= 0) {
                      const opt = REFERRAL_OPTS[focusedReferralIndex];
                      setValue('referral', opt.value);
                      goNext();
                    }
                  }
                };
                return (
                  <div
                    ref={referralContainerRef}
                    role="listbox"
                    tabIndex={0}
                    aria-label={tFields('referralLabel')}
                    onKeyDown={handleReferralKeyDown}
                    className="flex flex-col gap-2 outline-none"
                  >
                    {REFERRAL_OPTS.map((opt, i) => (
                      <button
                        key={opt.value}
                        ref={(el) => { referralButtonRefs.current[i] = el; }}
                        type="button"
                        role="option"
                        aria-selected={focusedReferralIndex === i}
                        onClick={() => {
                          setValue('referral', opt.value);
                          goNext();
                        }}
                        onFocus={() => setFocusedReferralIndex(i)}
                        className={`w-full py-3 px-4 rounded-xl border-2 border-black text-sm font-medium text-left transition-colors cursor-pointer ${
                          focusedReferralIndex === i
                            ? 'bg-black text-white'
                            : 'bg-white text-gray-900 hover:bg-black hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                );
              })()}
              {currentStep.type === 'upload' && (
                <div className="flex flex-col gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-2">
                    {picturePreview && pictureEditMode && (
                      <div className="flex items-center gap-2 w-full justify-center">
                        <div className="w-1" />
                        <div className="w-20 flex justify-center">
                          <div className="w-[76px]">
                            <HorizontalSlider
                              initialPosition={pictureHorz}
                              onPositionChange={handlePictureHorizontalChange}
                            />
                          </div>
                        </div>
                        <div className="w-4" />
                      </div>
                    )}
                    <div className="relative flex items-center gap-2">
                      {picturePreview && pictureEditMode && (
                        <div className="h-[76px] flex items-center justify-center">
                          <VerticalSlider
                            initialPosition={pictureVert}
                            onPositionChange={handlePictureVerticalChange}
                          />
                        </div>
                      )}
                      <div className="relative flex items-start justify-end gap-1.5">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => fileInputRef.current?.click()}
                          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                          className="w-20 h-20 rounded-lg border-2 border-black flex items-center justify-center bg-white cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative aspect-square"
                        >
                          {picturePreview ? (
                            <Image
                              src={picturePreview}
                              alt="Profile"
                              fill
                              className="object-cover"
                              sizes="80px"
                              unoptimized
                            />
                          ) : (
                            <User className="w-8 h-8 text-black" />
                          )}
                        </div>
                        {picturePreview && (
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePicture();
                              }}
                              className="w-6 h-6 rounded bg-red-500 border-2 border-red-500 flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors"
                              aria-label={tFields('removeProfilePicture')}
                            >
                              <X className="w-3 h-3 text-white" strokeWidth={3} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPictureEditMode(true);
                                if (pictureOriginal) {
                                  applyPictureZoom(
                                    pictureOriginal,
                                    pictureZoomRef.current,
                                    pictureVertRef.current,
                                    pictureHorzRef.current
                                  );
                                }
                              }}
                              className="w-6 h-6 rounded bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
                              aria-label="Edit profile picture"
                            >
                              <Pencil className="w-3 h-3 text-white" strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (pictureEditMode) {
                                  await handlePictureConfirm();
                                }
                                goNext();
                              }}
                              className="w-6 h-6 rounded bg-green-500 border-2 border-green-500 flex items-center justify-center cursor-pointer hover:bg-green-600 transition-colors"
                              aria-label={pictureEditMode ? 'Confirm image adjustments and continue' : 'Continue to next step'}
                            >
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {picturePreview && pictureEditMode && (
                      <div className="flex items-center gap-2 w-full justify-center">
                        <div className="w-1" />
                        <div className="w-20 flex justify-center">
                          <div className="w-[76px]">
                            <ZoomSlider
                              initialZoom={pictureZoom}
                              onZoomChange={handlePictureZoomChange}
                            />
                          </div>
                        </div>
                        <div className="w-4" />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {currentStep.type === 'text' && (
                <Input
                  value={String(values[currentStep.field ?? ''] ?? '')}
                  onChange={(e) => setValue(currentStep.field ?? currentStep.id, e.target.value)}
                  placeholder={tFields(`${currentStep.field}Placeholder` as Parameters<typeof tFields>[0])}
                  className="rounded-xl border-2 border-black"
                  onClear={() => setValue(currentStep.field ?? currentStep.id, '')}
                  showClear
                />
              )}
              {currentStep.type === 'email' && (
                <Input
                  type="email"
                  id="chat-signup-email"
                  value={String(values.email ?? '')}
                  onChange={(e) => setValue('email', e.target.value)}
                  placeholder={tFields('emailPlaceholder')}
                  className="rounded-xl border-2 border-black"
                  onClear={() => setValue('email', '')}
                  showClear
                />
              )}
              {currentStep.type === 'tel' && (
                <Input
                  type="tel"
                  value={String(values.phone ?? '')}
                  onChange={(e) => setValue('phone', formatPhoneNumber(e.target.value))}
                  placeholder={tFields('phonePlaceholder')}
                  className="rounded-xl border-2 border-black"
                  onClear={() => setValue('phone', '')}
                  showClear
                />
              )}
              {currentStep.type === 'password' && (
                <PasswordInput
                  value={String(values[currentStep.field ?? ''] ?? '')}
                  onChange={(e) => setValue(currentStep.field ?? currentStep.id, e.target.value)}
                  placeholder={
                    currentStep.id === 'confirmPassword'
                      ? tFields('confirmPasswordPlaceholder')
                      : tFields('passwordPlaceholder')
                  }
                  className="rounded-xl border-2 border-black"
                  label={undefined}
                  showToggle={true}
                  togglePosition="right"
                />
              )}
              {currentStep.type === 'address' && (
                <AddressAutocomplete
                  value={String(values.address ?? '')}
                  onChange={handleAddressChange}
                  onAddressSelect={handleAddressSelect}
                  onConfirmWithEnter={
                    values.streetAddress
                      ? () => goNext()
                      : undefined
                  }
                  placeholder={tFields('searchAddressPlaceholder')}
                />
              )}
              {currentStep.type === 'textarea' && (
                <textarea
                  value={String(values[currentStep.field ?? ''] ?? '')}
                  onChange={(e) => setValue(currentStep.field ?? currentStep.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      goNext();
                    }
                  }}
                  placeholder={tChat((currentStep.messageKey ?? currentStep.id) as Parameters<typeof tChat>[0])}
                  rows={2}
                  className="w-full py-2 px-3 rounded-xl border-2 border-black bg-white text-gray-900 text-sm resize-none"
                />
              )}
              {currentStep.type === 'checkbox' && (
                <div className="flex flex-col gap-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(values.agreeToTerms)}
                      onChange={(e) => setValue('agreeToTerms', e.target.checked)}
                      className="mt-1 rounded border-2 border-black"
                    />
                    <span className="text-sm text-gray-700">
                      {tTerms('prefix')}{' '}
                      <Link href={`/${locale}/terms`} className="underline cursor-pointer" target="_blank" rel="noopener noreferrer">
                        {tTerms('termsOfService')}
                      </Link>{' '}
                      {tTerms('and')}{' '}
                      <Link href={`/${locale}/privacy`} className="underline cursor-pointer" target="_blank" rel="noopener noreferrer">
                        {tTerms('privacyPolicy')}
                      </Link>{' '}
                      {tTerms('suffix')}
                    </span>
                  </label>
                </div>
              )}
            </form>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Bottom bar: Back + primary action (Next / Skip / Sign Up) */}
      {isTypingComplete && currentStep && (
        <div className="shrink-0 flex items-center gap-2 p-3 border-t border-gray-200 bg-gray-50 flex-wrap">
          {showBackInBar && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 py-2 px-3 text-sm font-medium text-gray-700 hover:text-black focus:outline-none focus:ring-2 focus:ring-black rounded-lg cursor-pointer"
              aria-label={tNav('previous')}
            >
              <ChevronLeft className="w-5 h-5" />
              {tNav('previous')}
            </button>
          )}
          {currentStep.type === 'upload' && (
            <>
              <button
                type="button"
                onClick={goNext}
                className="py-2 px-4 rounded-xl border-2 border-black bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 cursor-pointer"
              >
                {tNav('next')}
              </button>
              <button
                type="button"
                onClick={goNext}
                className="text-sm text-gray-500 underline cursor-pointer"
              >
                Skip
              </button>
            </>
          )}
          {currentStep.type === 'checkbox' && (
            <button
              type="submit"
              form="chat-signup-form"
              disabled={isSubmitting || isCheckingStep}
              className="py-2 px-4 rounded-xl border-2 border-black bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? tNav('submitting') : tNav('submit')}
            </button>
          )}
          {!['choice', 'upload', 'checkbox'].includes(currentStep.type) && (
            <button
              type="submit"
              form="chat-signup-form"
              disabled={isCheckingStep}
              className="py-2 px-4 rounded-xl border-2 border-black bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-60 cursor-pointer"
            >
              {isCheckingStep ? tNav('submitting') : tNav('next')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
