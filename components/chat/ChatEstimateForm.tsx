'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ChevronLeft, Upload, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/Input';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { estimateSchema, type EstimateSchema } from '@/lib/schemas/estimate';
import { SERVICE_CATEGORIES } from '@/lib/constants/categories';
import type { EstimateSchema as EstimateSchemaType } from '@/lib/schemas/estimate';

const TYPING_SPEED_MS = 30; // Fast typing for form bot
const TYPING_INITIAL_DELAY_MS = 400;

const PROJECT_TYPES: Array<EstimateSchemaType['projectType']> = [
  'new_construction',
  'renovation',
  'repair',
  'remodel',
  'other',
];

const BUDGET_VALUES: EstimateSchemaType['budgetRange'][] = [
  'under_5k',
  '5k_10k',
  '10k_25k',
  '25k_50k',
  '50k_100k',
  'over_100k',
  'not_sure',
];

const TIMELINE_VALUES: EstimateSchemaType['timeline'][] = [
  'asap',
  'within_month',
  '1_3_months',
  '3_6_months',
  '6_plus_months',
  'flexible',
];

const CONTACT_VALUES: EstimateSchemaType['preferredContactMethod'][] = [
  'phone',
  'email',
  'text',
  'either',
];

export interface ChatEstimateFormProps {
  onSuccess: () => void;
  onBack?: () => void;
  onStepIndexChange?: (index: number) => void;
  onBotTypingChange?: (typing: boolean) => void;
}

/** Form state includes useSameAddress for the bot's "use profile address?" step (not sent to API). */
type ChatEstimateValues = Partial<EstimateSchemaType> & { useSameAddress?: boolean };

type StepId =
  | 'projectType'
  | 'projectTypeOther'
  | 'hoaAnd3D'
  | 'trades'
  | 'projectDescription'
  | 'budgetRange'
  | 'timeline'
  | 'preferredContactMethod'
  | 'useSameAddress'
  | 'streetAddress'
  | 'additionalNotes';

interface StepDef {
  id: StepId;
  messageKey: string;
  type: 'choice' | 'choiceMulti' | 'text' | 'textarea' | 'hoa3d' | 'address' | 'yesNo';
  field?: keyof EstimateSchemaType;
  skipWhen?: (values: ChatEstimateValues) => boolean;
}

const STEPS: StepDef[] = [
  { id: 'projectType', messageKey: 'projectTypeLabel', type: 'choice', field: 'projectType' },
  {
    id: 'projectTypeOther',
    messageKey: 'projectTypeOtherLabel',
    type: 'text',
    field: 'projectTypeOther',
    skipWhen: (v) => v.projectType !== 'other',
  },
  { id: 'hoaAnd3D', messageKey: 'hoaAnd3DLabel', type: 'hoa3d' },
  { id: 'trades', messageKey: 'tradesLabel', type: 'choiceMulti', field: 'trades' },
  { id: 'projectDescription', messageKey: 'projectDescriptionLabel', type: 'textarea', field: 'projectDescription' },
  { id: 'budgetRange', messageKey: 'budgetRangeLabel', type: 'choice', field: 'budgetRange' },
  { id: 'timeline', messageKey: 'timelineLabel', type: 'choice', field: 'timeline' },
  {
    id: 'preferredContactMethod',
    messageKey: 'preferredContactMethodLabel',
    type: 'choice',
    field: 'preferredContactMethod',
  },
  {
    id: 'useSameAddress',
    messageKey: 'useSameAddressForEstimateLabel',
    type: 'yesNo',
    skipWhen: (v) => !(v.streetAddress?.trim()),
  },
  {
    id: 'streetAddress',
    messageKey: 'streetAddressLabel',
    type: 'address',
    field: 'streetAddress',
    skipWhen: (v) => v.useSameAddress === true || !!(v.streetAddress?.trim()),
  },
  {
    id: 'additionalNotes',
    messageKey: 'additionalNotesLabel',
    type: 'textarea',
    field: 'additionalNotes',
  },
];

export default function ChatEstimateForm({
  onSuccess,
  onBack,
  onStepIndexChange,
  onBotTypingChange,
}: ChatEstimateFormProps) {
  const locale = useLocale();
  const tFields = useTranslations('estimate.fields');
  const tOptions = useTranslations('estimate.options');
  const tCategories = useTranslations('categories');
  const tNav = useTranslations('auth.signup.navigation');
  const tButtons = useTranslations('estimate.buttons');
  const tValidation = useTranslations('estimate.validation');
  const { user, isAuthenticated } = useAuth();

  const [values, setValues] = useState<ChatEstimateValues>({
    projectType: undefined,
    projectTypeOther: '',
    trades: [],
    projectDescription: '',
    budgetRange: undefined,
    timeline: undefined,
    preferredContactMethod: undefined,
    useSameAddress: undefined,
    additionalNotes: '',
    requiresHoaApproval: false,
    wants3D: false,
    projectImages: [],
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typedLength, setTypedLength] = useState(0);
  const [typingStarted, setTypingStarted] = useState(false);
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const projectDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const additionalNotesRef = useRef<HTMLTextAreaElement>(null);
  const estimateImageInputRef = useRef<HTMLInputElement>(null);

  const visibleSteps = useMemo(
    () => STEPS.filter((step) => !step.skipWhen?.(values)),
    [values]
  );
  const currentStep = visibleSteps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === visibleSteps.length - 1;

  const currentMessage = currentStep
    ? tFields(currentStep.messageKey as Parameters<typeof tFields>[0])
    : '';
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

  // Fetch address from API when user is authenticated (same as estimate page)
  useEffect(() => {
    if (!isAuthenticated || !user?.id || addressLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/addresses?type=personal', {
          method: 'GET',
          credentials: 'include',
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const addr = Array.isArray(data.addresses) ? data.addresses[0] : null;
        if (!addr || cancelled) return;
        setValues((prev) => ({
          ...prev,
          streetAddress: addr.streetAddress || user?.streetAddress || '',
          city: addr.city || user?.city || '',
          state: addr.state || user?.state || 'NV',
          zipCode: addr.zipCode || user?.zipCode || '',
          apartment: addr.apartment || user?.apartment || '',
        }));
      } catch {
        // Fallback to user from context
        setValues((prev) => ({
          ...prev,
          streetAddress: user?.streetAddress ?? '',
          city: user?.city ?? '',
          state: user?.state ?? 'NV',
          zipCode: user?.zipCode ?? '',
          apartment: user?.apartment ?? '',
        }));
      } finally {
        if (!cancelled) setAddressLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, user?.streetAddress, user?.city, user?.state, user?.zipCode, user?.apartment, addressLoaded]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);

  useEffect(() => {
    if (!currentStep) return;
    const t = setTimeout(scrollToBottom, 150);
    return () => clearTimeout(t);
  }, [currentStep?.id, stepIndex, isTypingComplete, scrollToBottom]);

  // Auto-focus textarea when step is shown and typing is complete
  useEffect(() => {
    if (!isTypingComplete) return;
    const id = setTimeout(() => {
      if (currentStep?.id === 'projectDescription') projectDescriptionRef.current?.focus();
      if (currentStep?.id === 'additionalNotes') additionalNotesRef.current?.focus();
    }, 100);
    return () => clearTimeout(id);
  }, [currentStep?.id, isTypingComplete]);

  const setValue = useCallback(<K extends keyof EstimateSchemaType>(field: K, value: EstimateSchemaType[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleBack = useCallback(() => {
    if (isFirstStep && onBack) {
      onBack();
      return;
    }
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }, [isFirstStep, onBack, stepIndex]);

  const goNext = useCallback(() => {
    if (stepIndex < visibleSteps.length - 1) {
      setStepIndex((i) => i + 1);
      setError(null);
      setTimeout(scrollToBottom, 100);
    }
  }, [stepIndex, visibleSteps.length, scrollToBottom]);

  const validateAndSubmit = useCallback(async () => {
    if (!user) {
      setError('Please sign in to submit an estimate.');
      return;
    }
    const payload: EstimateSchemaType = {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      streetAddress: (values.streetAddress ?? user.streetAddress) || '',
      city: (values.city ?? user.city) || '',
      state: (values.state ?? user.state) || 'NV',
      zipCode: (values.zipCode ?? user.zipCode) || '',
      apartment: values.apartment ?? user.apartment ?? '',
      projectType: values.projectType!,
      projectTypeOther: values.projectTypeOther ?? undefined,
      requiresHoaApproval: values.requiresHoaApproval ?? false,
      wants3D: values.wants3D ?? false,
      trades: values.trades ?? [],
      projectDescription: values.projectDescription ?? '',
      projectImages: values.projectImages ?? [],
      budgetRange: values.budgetRange!,
      timeline: values.timeline!,
      preferredContactMethod: values.preferredContactMethod!,
      additionalNotes: values.additionalNotes ?? undefined,
    };
    const parsed = estimateSchema.safeParse(payload);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const firstKey = Object.keys(first)[0] as keyof typeof first;
      const rawMsg = Array.isArray(first[firstKey]) ? first[firstKey][0] : parsed.error.message;
      const msg = typeof rawMsg === 'string' ? rawMsg : 'Please fix the form.';
      try {
        setError(tValidation(msg as Parameters<typeof tValidation>[0]) || msg);
      } catch {
        setError(msg);
      }
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-locale': locale },
        body: JSON.stringify(parsed.data),
        credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to submit estimate');
      }
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit estimate');
    } finally {
      setIsSubmitting(false);
    }
  }, [user, values, locale, onSuccess]);

  const handleStepSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!currentStep) return;

      if (currentStep.id === 'trades') {
        const trades = (values.trades ?? []) as string[];
        if (trades.length === 0) {
          setError('Select at least one trade.');
          return;
        }
      }
      if (currentStep.id === 'projectTypeOther') {
        const other = (values.projectTypeOther ?? '').trim();
        if (!other) {
          setError('Please specify your project type.');
          return;
        }
      }
      if (currentStep.id === 'streetAddress') {
        const addr = (values.streetAddress ?? '').trim();
        if (!addr) {
          setError(tValidation('streetAddressRequired'));
          return;
        }
      }

      setError(null);
      if (isLastStep) {
        void validateAndSubmit();
        return;
      }
      goNext();
    },
    [currentStep, values, isLastStep, goNext, validateAndSubmit, tValidation]
  );

  const toggleTrade = useCallback((label: string) => {
    setValues((prev) => {
      const current = (prev.trades ?? []) as string[];
      const next = current.includes(label)
        ? current.filter((t) => t !== label)
        : [...current, label];
      return { ...prev, trades: next };
    });
  }, []);

  const projectImages = (values.projectImages ?? []) as string[];

  const handleEstimateImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const remaining = 5 - projectImages.length;
      if (files.length > remaining) {
        setImageUploadError(tFields('maxImagesError'));
        e.target.value = '';
        return;
      }
      setImageUploadError(null);
      setImageUploading(true);
      const toUpload = Array.from(files).slice(0, remaining);
      try {
        const uploads = toUpload.map(async (file) => {
          if (!file.type.startsWith('image/')) throw new Error(tFields('imageTypeError'));
          if (file.size > 5 * 1024 * 1024) throw new Error(tFields('imageSizeError'));
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/storage/upload-estimate-image', { method: 'POST', body: formData, credentials: 'include' });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error((data.error as string) || tFields('uploadError'));
          }
          const data = await res.json();
          return data.url as string;
        });
        const urls = await Promise.all(uploads);
        setValues((prev) => ({ ...prev, projectImages: [...(prev.projectImages ?? []), ...urls] }));
      } catch (err) {
        setImageUploadError(err instanceof Error ? err.message : tFields('uploadError'));
      } finally {
        setImageUploading(false);
        e.target.value = '';
      }
    },
    [projectImages.length, tFields]
  );

  const handleRemoveEstimateImage = useCallback((index: number) => {
    setValues((prev) => {
      const current = (prev.projectImages ?? []) as string[];
      return { ...prev, projectImages: current.filter((_, i) => i !== index) };
    });
  }, []);

  const showBackInBar = stepIndex > 0 || (isFirstStep && !!onBack);

  if (!currentStep) return null;

  const isTradesStep = currentStep.id === 'trades';

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className={
          isTradesStep
            ? 'flex-1 flex flex-col min-h-0 overflow-hidden p-3'
            : 'flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0'
        }
      >
        {/* On trades step, hide previous steps so bot + label sit under modal header; more room for options */}
        {!isTradesStep &&
          visibleSteps.slice(0, stepIndex).map((step) => (
            <div key={step.id} className="flex flex-col gap-1">
              <div className="self-start max-w-[85%] rounded-2xl rounded-tl-sm bg-gray-100 text-gray-900 px-3 py-2 text-sm">
                {tFields(step.messageKey as Parameters<typeof tFields>[0])}
              </div>
              <div className="self-end max-w-[85%] rounded-2xl rounded-tr-sm bg-gray-900 text-white px-3 py-2 text-sm">
                {step.id === 'hoaAnd3D'
                  ? (() => {
                      const parts = [
                        values.requiresHoaApproval ? tFields('requiresHoaApprovalLabel') : null,
                        values.wants3D ? tFields('wants3DLabel') : null,
                      ].filter(Boolean);
                      return parts.length > 0 ? parts.join(', ') : tOptions('noneSelected');
                    })()
                  : step.field === 'projectType' && values[step.field]
                    ? tOptions(`projectType.${values[step.field]}`)
                    : step.field === 'budgetRange' && values[step.field]
                      ? tOptions(`budgetRange.${values[step.field]}`)
                      : step.field === 'timeline' && values[step.field]
                        ? tOptions(`timeline.${values[step.field]}`)
                        : step.field === 'preferredContactMethod' && values[step.field]
                          ? tOptions(`preferredContactMethod.${values[step.field]}`)
                          : step.id === 'useSameAddress'
                            ? values.useSameAddress === true
                              ? tFields('yes')
                              : values.useSameAddress === false
                                ? tFields('no')
                                : ''
                          : step.field === 'trades' && step.field && Array.isArray(values[step.field])
                            ? (values[step.field] as string[])
                                .map((t) => (t === 'All' ? tCategories('all') : tCategories(t.toLowerCase())))
                                .join(', ')
                            : step.field != null
                              ? String(values[step.field] ?? '')
                              : ''}
              </div>
            </div>
          ))}

        <div
          className={
            isTradesStep
              ? 'flex flex-col flex-1 min-h-0 gap-2'
              : 'flex flex-col gap-2'
          }
        >
          {/* On trades step: sticky bot + label under modal header; options scroll below */}
          <div
            className={
              isTradesStep
                ? 'shrink-0 sticky top-0 z-10 bg-white pb-2 -mx-3 px-3 pt-0 border-b border-gray-100'
                : undefined
            }
          >
            <div className="self-start flex items-end gap-0 min-h-[48px] rounded-2xl overflow-hidden">
              <div className="shrink-0 w-12 h-12 flex items-center justify-center" aria-hidden>
                <img
                  src={isTypingComplete ? '/pro-bot-typing.png' : '/pro-bot-solo-typing-new.gif'}
                  alt=""
                  width={48}
                  height={48}
                  className="w-12 h-12 object-contain pointer-events-none"
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
          </div>
          {isTypingComplete && (
            <form
              id="chat-estimate-form"
              onSubmit={handleStepSubmit}
              className={`flex flex-col gap-2 mt-1 ${isTradesStep ? 'flex-1 min-h-0 overflow-hidden' : ''}`}
            >
              {error && (
                <p className="text-sm text-red-600 shrink-0" role="alert">
                  {error}
                </p>
              )}
              {currentStep.type === 'choice' && currentStep.field === 'projectType' && (
                <div className="flex flex-wrap gap-2">
                  {PROJECT_TYPES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setValue('projectType', value);
                        goNext();
                        setTimeout(scrollToBottom, 100);
                      }}
                      className={`py-2 px-3 rounded-xl border-2 text-sm font-medium cursor-pointer transition-colors ${
                        values.projectType === value
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-black hover:bg-gray-50'
                      }`}
                    >
                      {tOptions(`projectType.${value}`)}
                    </button>
                  ))}
                </div>
              )}
              {currentStep.type === 'text' && currentStep.field === 'projectTypeOther' && (
                <Input
                  value={String(values.projectTypeOther ?? '')}
                  onChange={(e) => setValue('projectTypeOther', e.target.value)}
                  placeholder={tFields('projectTypeOtherPlaceholder')}
                  className="rounded-xl border-2 border-black"
                  onClear={() => setValue('projectTypeOther', '')}
                  showClear
                />
              )}
              {currentStep.type === 'hoa3d' && currentStep.id === 'hoaAnd3D' && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!values.requiresHoaApproval}
                      onChange={(e) => setValue('requiresHoaApproval', e.target.checked)}
                      className="w-4 h-4 border-2 border-black rounded focus:ring-0 focus:ring-offset-0 checked:bg-black checked:border-black cursor-pointer accent-black"
                    />
                    <span className="text-sm font-medium text-black">{tFields('requiresHoaApprovalLabel')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!values.wants3D}
                      onChange={(e) => setValue('wants3D', e.target.checked)}
                      className="w-4 h-4 border-2 border-black rounded focus:ring-0 focus:ring-offset-0 checked:bg-black checked:border-black cursor-pointer accent-black"
                    />
                    <span className="text-sm font-medium text-black">{tFields('wants3DLabel')}</span>
                  </label>
                </div>
              )}
              {currentStep.type === 'choiceMulti' && currentStep.field === 'trades' && (
                <div className="flex-1 min-h-0 overflow-y-auto mt-1">
                  <div className="grid grid-cols-2 gap-2 pb-2">
                    {SERVICE_CATEGORIES.map((cat) => {
                      const isSelected = (values.trades ?? []).includes(cat.label);
                      return (
                        <button
                          key={cat.label}
                          type="button"
                          onClick={() => toggleTrade(cat.label)}
                          className={`py-2 px-2 rounded-lg border-2 text-xs font-medium cursor-pointer transition-colors ${
                            isSelected ? 'bg-black text-white border-black' : 'bg-white text-black border-black hover:bg-gray-50'
                          }`}
                        >
                          {cat.label === 'All' ? tCategories('all') : tCategories(cat.label.toLowerCase())}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {currentStep.type === 'textarea' && currentStep.field === 'projectDescription' && (
                <div className="space-y-3">
                  <textarea
                    ref={projectDescriptionRef}
                    value={String(values.projectDescription ?? '')}
                    onChange={(e) => setValue('projectDescription', e.target.value)}
                    placeholder={tFields('projectDescriptionPlaceholder')}
                    rows={3}
                    className="w-full py-2 px-3 rounded-xl border-2 border-black bg-white text-gray-900 text-sm resize-none"
                    autoFocus
                  />
                  {/* Optional project images (same as regular estimate form) */}
                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-gray-700">
                      {tFields('projectImagesLabel')} ({projectImages.length}/5)
                    </span>
                    {projectImages.length > 0 && (
                      <div className="grid grid-cols-5 gap-2">
                        {projectImages.map((url, index) => (
                          <div key={index} className="relative aspect-square rounded-lg border-2 border-black overflow-hidden bg-gray-100">
                            <Image
                              src={url}
                              alt={`Project image ${index + 1}`}
                              fill
                              className="object-cover"
                              sizes="80px"
                              unoptimized
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveEstimateImage(index)}
                              disabled={imageUploading}
                              className="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-red-500 flex items-center justify-center cursor-pointer hover:bg-red-600 text-white disabled:opacity-50"
                              aria-label={tFields('removeImage')}
                            >
                              <X className="w-3 h-3" strokeWidth={3} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {projectImages.length < 5 && (
                      <>
                        <label
                          htmlFor="chat-estimate-image-input"
                          className={`w-full py-2 px-3 border-2 border-dashed border-black rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-gray-700 cursor-pointer ${
                            imageUploading ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50'
                          }`}
                        >
                          <Upload className="w-4 h-4" />
                          {imageUploading ? tFields('uploading') : tFields('uploadImages')}
                        </label>
                        <input
                          id="chat-estimate-image-input"
                          ref={estimateImageInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={handleEstimateImageUpload}
                          className="sr-only"
                          disabled={imageUploading}
                          aria-label={tFields('uploadImages')}
                        />
                      </>
                    )}
                    {imageUploadError && <p className="text-xs text-red-600">{imageUploadError}</p>}
                    <p className="text-xs text-gray-500">{tFields('projectImagesHelp')}</p>
                  </div>
                </div>
              )}
              {currentStep.type === 'choice' && currentStep.field === 'budgetRange' && (
                <div className="flex flex-wrap gap-2">
                  {BUDGET_VALUES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setValue('budgetRange', value);
                        goNext();
                        setTimeout(scrollToBottom, 100);
                      }}
                      className={`py-2 px-3 rounded-xl border-2 text-sm font-medium cursor-pointer transition-colors ${
                        values.budgetRange === value
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-black hover:bg-gray-50'
                      }`}
                    >
                      {tOptions(`budgetRange.${value}`)}
                    </button>
                  ))}
                </div>
              )}
              {currentStep.type === 'choice' && currentStep.field === 'timeline' && (
                <div className="flex flex-wrap gap-2">
                  {TIMELINE_VALUES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setValue('timeline', value);
                        goNext();
                        setTimeout(scrollToBottom, 100);
                      }}
                      className={`py-2 px-3 rounded-xl border-2 text-sm font-medium cursor-pointer transition-colors ${
                        values.timeline === value
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-black hover:bg-gray-50'
                      }`}
                    >
                      {tOptions(`timeline.${value}`)}
                    </button>
                  ))}
                </div>
              )}
              {currentStep.type === 'choice' && currentStep.field === 'preferredContactMethod' && (
                <div className="flex flex-wrap gap-2">
                  {CONTACT_VALUES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setValue('preferredContactMethod', value);
                        goNext();
                        setTimeout(scrollToBottom, 100);
                      }}
                      className={`py-2 px-3 rounded-xl border-2 text-sm font-medium cursor-pointer transition-colors ${
                        values.preferredContactMethod === value
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-black hover:bg-gray-50'
                      }`}
                    >
                      {tOptions(`preferredContactMethod.${value}`)}
                    </button>
                  ))}
                </div>
              )}
              {currentStep.type === 'yesNo' && currentStep.id === 'useSameAddress' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setValues((prev) => ({ ...prev, useSameAddress: true }));
                      setError(null);
                      goNext();
                      setTimeout(scrollToBottom, 100);
                    }}
                    className="py-2 px-4 rounded-xl border-2 text-sm font-medium cursor-pointer transition-colors bg-white text-black border-black hover:bg-gray-50"
                  >
                    {tFields('yes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setValues((prev) => ({
                        ...prev,
                        useSameAddress: false,
                        streetAddress: '',
                        city: '',
                        state: 'NV',
                        zipCode: '',
                        apartment: '',
                      }));
                      setError(null);
                      goNext();
                      setTimeout(scrollToBottom, 100);
                    }}
                    className="py-2 px-4 rounded-xl border-2 text-sm font-medium cursor-pointer transition-colors bg-white text-black border-black hover:bg-gray-50"
                  >
                    {tFields('no')}
                  </button>
                </div>
              )}
              {currentStep.type === 'address' && currentStep.id === 'streetAddress' && (
                <AddressAutocomplete
                  value={values.streetAddress ?? ''}
                  onChange={(value) => setValue('streetAddress', value)}
                  onAddressSelect={(addr) => {
                    setValue('streetAddress', addr.streetAddress);
                    setValue('city', addr.city);
                    setValue('state', addr.state);
                    setValue('zipCode', addr.zipCode);
                    if (addr.apartment != null) setValue('apartment', addr.apartment);
                  }}
                  placeholder={tFields('streetAddressPlaceholder')}
                  required
                />
              )}
              {currentStep.type === 'textarea' && currentStep.field === 'additionalNotes' && (
                <textarea
                  ref={additionalNotesRef}
                  value={String(values.additionalNotes ?? '')}
                  onChange={(e) => setValue('additionalNotes', e.target.value)}
                  placeholder={tFields('additionalNotesPlaceholder')}
                  rows={2}
                  className="w-full py-2 px-3 rounded-xl border-2 border-black bg-white text-gray-900 text-sm resize-none"
                  autoFocus
                />
              )}
            </form>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {isTypingComplete && (
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
          <button
            type="submit"
            form="chat-estimate-form"
            disabled={isSubmitting}
            className="py-2 px-4 rounded-xl border-2 border-black bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-60 cursor-pointer"
          >
            {isLastStep
              ? isSubmitting
                ? tButtons('submitting')
                : tButtons('submit')
              : tNav('next')}
          </button>
        </div>
      )}
    </div>
  );
}
