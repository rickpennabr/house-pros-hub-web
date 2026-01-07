'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TbHomeEdit } from 'react-icons/tb';

import { estimateSchema, type EstimateSchema } from '@/lib/schemas/estimate';
import { useAuth } from '@/contexts/AuthContext';
import { createSignUpUrl } from '@/lib/redirect';
import { useAccordionState } from '@/hooks/useAccordionState';
import { useEstimateFormValues } from '@/hooks/useEstimateFormValues';
import { useEstimateFormValidation } from '@/hooks/useEstimateFormValidation';
import CustomerInfoAccordion from '@/components/estimate/CustomerInfoAccordion';
import ProjectTypeSelector from '@/components/estimate/ProjectTypeSelector';
import TradesSelector from '@/components/estimate/TradesSelector';
import ProjectDescriptionAccordion from '@/components/estimate/ProjectDescriptionAccordion';
import BudgetTimelineAccordion from '@/components/estimate/BudgetTimelineAccordion';
import ContactMethodAccordion from '@/components/estimate/ContactMethodAccordion';
import NotesAccordion from '@/components/estimate/NotesAccordion';
import Accordion from '@/components/ui/Accordion';
import { AddressData } from '@/components/AddressAutocomplete';

export default function EstimatePage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { user, isAuthenticated, isLoading } = useAuth();
  const tPage = useTranslations('estimate.page');
  const tAccordion = useTranslations('estimate.accordion');
  const tFields = useTranslations('estimate.fields');
  const tOptions = useTranslations('estimate.options');
  const tButtons = useTranslations('estimate.buttons');
  const tSuccess = useTranslations('estimate.success');
  const tHelp = useTranslations('estimate.help');
  const tTips = useTranslations('estimate.tips');
  const tCategories = useTranslations('categories');
  const tCommon = useTranslations('common');
  const tValidation = useTranslations('estimate.validation');
  
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Refs for accordion sections for auto-scrolling
  const successMessageRef = useRef<HTMLDivElement>(null);
  const customerInfoRef = useRef<HTMLDivElement>(null);
  const projectInfoRef = useRef<HTMLDivElement>(null);
  const projectTypeRef = useRef<HTMLDivElement>(null);
  const tradesRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const budgetTimelineRef = useRef<HTMLDivElement>(null);
  const contactMethodRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  // Get accordion state from hook
  const { state: accordionState, toggleAccordion, isOpen, closeAll } = useAccordionState();

  // Create translated arrays
  const PROJECT_TYPES = useMemo(() => [
    { value: 'new_construction', label: tOptions('projectType.new_construction'), explanation: '' },
    { value: 'renovation', label: tOptions('projectType.renovation'), explanation: '' },
    { value: 'repair', label: tOptions('projectType.repair'), explanation: '' },
    { value: 'remodel', label: tOptions('projectType.remodel'), explanation: '' },
    { value: 'other', label: tOptions('projectType.other'), explanation: '' },
  ], [tOptions]);

  const BUDGET_RANGES = useMemo(() => [
    { value: 'under_5k', label: tOptions('budgetRange.under_5k') },
    { value: '5k_10k', label: tOptions('budgetRange.5k_10k') },
    { value: '10k_25k', label: tOptions('budgetRange.10k_25k') },
    { value: '25k_50k', label: tOptions('budgetRange.25k_50k') },
    { value: '50k_100k', label: tOptions('budgetRange.50k_100k') },
    { value: 'over_100k', label: tOptions('budgetRange.over_100k') },
    { value: 'not_sure', label: tOptions('budgetRange.not_sure') },
  ], [tOptions]);

  const TIMELINES = useMemo(() => [
    { value: 'asap', label: tOptions('timeline.asap') },
    { value: 'within_month', label: tOptions('timeline.within_month') },
    { value: '1_3_months', label: tOptions('timeline.1_3_months') },
    { value: '3_6_months', label: tOptions('timeline.3_6_months') },
    { value: '6_plus_months', label: tOptions('timeline.6_plus_months') },
    { value: 'flexible', label: tOptions('timeline.flexible') },
  ], [tOptions]);

  const CONTACT_METHODS = useMemo(() => [
    { value: 'phone', label: tOptions('preferredContactMethod.phone') },
    { value: 'email', label: tOptions('preferredContactMethod.email') },
    { value: 'text', label: tOptions('preferredContactMethod.text') },
    { value: 'either', label: tOptions('preferredContactMethod.either') },
  ], [tOptions]);

  // Initialize form - must be called before any early returns
  const methods = useForm<EstimateSchema>({
    resolver: zodResolver(estimateSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      streetAddress: '',
      city: '',
      state: 'NV',
      zipCode: '',
      apartment: '',
      projectType: undefined,
      projectTypeOther: '',
      requiresHoaApproval: false,
      wants3D: false,
      trades: [],
      projectDescription: '',
      budgetRange: undefined,
      timeline: undefined,
      preferredContactMethod: undefined,
      additionalNotes: '',
    },
  });

  const { handleSubmit, setValue, formState: { errors, isSubmitting } } = methods;

  // Use optimized hook to watch all form values at once
  const formValues = useEstimateFormValues(methods);

  // Use validation hook
  const validation = useEstimateFormValidation({
    ...formValues,
    errors,
  });

  // Note: User data is already refreshed in SignupSuccessMessage before navigation
  // No need to call checkAuth again here as it can cause loading loops

  // Redirect to signup if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const signUpUrl = createSignUpUrl(locale as 'en' | 'es', pathname);
      router.push(signUpUrl);
    }
  }, [isAuthenticated, isLoading, router, locale, pathname]);

  // Helper function to populate form with user data (non-address fields)
  const populateUserData = useCallback(() => {
    if (isAuthenticated && user && !isLoading) {
      setValue('firstName', user.firstName || '', { shouldValidate: false });
      setValue('lastName', user.lastName || '', { shouldValidate: false });
      setValue('email', user.email || '', { shouldValidate: false });
      setValue('phone', user.phone || '', { shouldValidate: false });
    }
  }, [isAuthenticated, user, setValue, isLoading]);

  // Populate form with user data when logged in (non-address fields)
  useEffect(() => {
    populateUserData();
  }, [populateUserData]);

  // Fetch and populate address from addresses table (source of truth)
  useEffect(() => {
    if (!isAuthenticated || isLoading || !user?.id) return;

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

        // Populate address fields from addresses table
        setValue('streetAddress', addr.streetAddress || '', { shouldValidate: false });
        setValue('city', addr.city || '', { shouldValidate: false });
        setValue('state', addr.state || 'NV', { shouldValidate: false });
        setValue('zipCode', addr.zipCode || '', { shouldValidate: false });
        setValue('apartment', addr.apartment || '', { shouldValidate: false });
      } catch (error) {
        console.error('Error fetching address from addresses table:', error);
        // Non-fatal: form can still be filled manually
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, user?.id, setValue]);

  // Handle address selection
  const handleAddressSelect = useCallback((addressData: AddressData) => {
    setValue('streetAddress', addressData.streetAddress);
    setValue('city', addressData.city);
    setValue('state', addressData.state);
    setValue('zipCode', addressData.zipCode);
  }, [setValue]);

  // Handle project type selection
  const selectProjectType = useCallback((projectTypeValue: string) => {
    if (projectTypeValue === formValues.selectedProjectType) {
      // Clear the selection
      setValue('projectType', 'other' as const, { shouldValidate: true });
    } else {
      setValue('projectType', projectTypeValue as EstimateSchema['projectType'], { shouldValidate: true });
    }
  }, [formValues.selectedProjectType, setValue]);

  // Handle contact method selection
  const selectContactMethod = (contactMethodValue: string) => {
    if (contactMethodValue === formValues.selectedContactMethod) {
      // Clear the selection
      setValue('preferredContactMethod', 'either' as const, { shouldValidate: true });
    } else {
      setValue('preferredContactMethod', contactMethodValue as EstimateSchema['preferredContactMethod'], { shouldValidate: true });
    }
  };

  // Handle trade selection
  const toggleTrade = (tradeLabel: string) => {
    const currentTrades = formValues.selectedTrades;
    const isSelected = currentTrades.includes(tradeLabel);
    
    if (isSelected) {
      setValue('trades', currentTrades.filter(t => t !== tradeLabel), { shouldValidate: true });
    } else {
      setValue('trades', [...currentTrades, tradeLabel], { shouldValidate: true });
    }
  };

  // Auto-scroll to accordion when it opens
  useEffect(() => {
    const scrollToAccordion = (ref: React.RefObject<HTMLDivElement | null>) => {
      if (ref.current) {
        // Calculate offset to account for any fixed headers (if needed)
        const offset = 20;
        const elementPosition = ref.current.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    };

    // Check which accordion just opened and scroll to it
    if (isOpen('customerInfo')) {
      setTimeout(() => scrollToAccordion(customerInfoRef), 100);
    } else if (isOpen('projectInfo') && !isOpen('projectType') && !isOpen('trades') && !isOpen('description') && !isOpen('budgetTimeline') && !isOpen('contactMethod') && !isOpen('notes')) {
      // Only scroll to projectInfo if no nested accordions are open
      setTimeout(() => scrollToAccordion(projectInfoRef), 100);
    } else if (isOpen('projectType')) {
      setTimeout(() => scrollToAccordion(projectTypeRef), 100);
    } else if (isOpen('trades')) {
      setTimeout(() => scrollToAccordion(tradesRef), 100);
    } else if (isOpen('description')) {
      setTimeout(() => scrollToAccordion(descriptionRef), 100);
    } else if (isOpen('budgetTimeline')) {
      setTimeout(() => scrollToAccordion(budgetTimelineRef), 100);
    } else if (isOpen('contactMethod')) {
      setTimeout(() => scrollToAccordion(contactMethodRef), 100);
    } else if (isOpen('notes')) {
      setTimeout(() => scrollToAccordion(notesRef), 100);
    }
  }, [accordionState, isOpen]);

  // Show loading state while checking authentication
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-600">{tCommon('message.loading')}</p>
      </div>
    );
  }

  const onSubmit = async (data: EstimateSchema) => {
    try {
      setErrorMessage('');
      setSuccessMessage('');
      
      // Close all accordions so user can see the success message
      closeAll();
      
      // Send data to API endpoint
      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-locale': locale,
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to submit estimate' }));
        throw new Error(errorData.error || 'Failed to submit estimate');
      }
      
      setSuccessMessage(tSuccess('body'));
      
      // Scroll to top of page after successful submission
      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }, 100);
      
      // Reset form after success and re-populate user data
      setTimeout(() => {
        methods.reset();
        setSuccessMessage('');
        // Re-populate user data after reset
        setTimeout(() => {
          populateUserData();
        }, 100);
      }, 5000);
    } catch (error) {
      console.error('Error submitting estimate:', error);
      setErrorMessage(error instanceof Error ? error.message : tValidation('genericError'));
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-2 md:p-6 py-2 md:py-4">
      {!successMessage && (
        <div className="mb-2">
          <p className="text-base md:text-lg font-bold text-red-600 text-center md:text-left">
            {tPage('intro')}
          </p>
        </div>
      )}

      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Success/Error Messages */}
          {successMessage && (
            <div ref={successMessageRef} className="bg-green-50 border-2 border-green-600 text-green-800 rounded-lg p-4">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="bg-red-50 border-2 border-red-600 text-red-800 rounded-lg p-4">
              {errorMessage}
            </div>
          )}

          {/* Customer Information Section */}
          <div ref={customerInfoRef}>
            <CustomerInfoAccordion
              isOpen={isOpen('customerInfo')}
              onToggle={() => toggleAccordion('customerInfo')}
              isComplete={validation.isCustomerInfoComplete}
              methods={methods}
              errors={errors}
              isSubmitting={isSubmitting}
              onAddressSelect={handleAddressSelect}
              tFields={tFields}
              tAccordion={tAccordion}
              tTips={tTips}
            />
          </div>

          {/* Project Information Section */}
          <div ref={projectInfoRef}>
            <Accordion
              title={tAccordion('projectInfo')}
              isOpen={isOpen('projectInfo')}
              onToggle={() => toggleAccordion('projectInfo')}
              isComplete={false}
              icon={<TbHomeEdit className="w-5 h-5" />}
            >
              {/* Project Type Accordion */}
              <div ref={projectTypeRef}>
                <ProjectTypeSelector
                  isOpen={isOpen('projectType')}
                  onToggle={() => toggleAccordion('projectType')}
                  isComplete={validation.isProjectTypeComplete}
                  methods={methods}
                  errors={errors}
                  isSubmitting={isSubmitting}
                  projectTypes={PROJECT_TYPES}
                  selectedProjectType={formValues.selectedProjectType}
                  onSelectProjectType={selectProjectType}
                  tAccordion={tAccordion}
                  tFields={tFields}
                  tValidation={tValidation}
                  tHelp={tHelp}
                  tTips={tTips}
                />
              </div>

              {/* Trades/Services Needed Accordion */}
              <div ref={tradesRef}>
                <TradesSelector
                  isOpen={isOpen('trades')}
                  onToggle={() => toggleAccordion('trades')}
                  isComplete={validation.isTradesComplete}
                  methods={methods}
                  errors={errors}
                  selectedTrades={formValues.selectedTrades}
                  onToggleTrade={toggleTrade}
                  tAccordion={tAccordion}
                  tCategories={tCategories}
                  tHelp={tHelp}
                  tTips={tTips}
                />
              </div>

              {/* Project Description Accordion */}
              <div ref={descriptionRef}>
                <ProjectDescriptionAccordion
                  isOpen={isOpen('description')}
                  onToggle={() => toggleAccordion('description')}
                  isComplete={validation.isDescriptionComplete}
                  methods={methods}
                  errors={errors}
                  isSubmitting={isSubmitting}
                  tAccordion={tAccordion}
                  tFields={tFields}
                  tHelp={tHelp}
                  tTips={tTips}
                />
              </div>

              {/* Budget Range & Timeline Accordion */}
              <div ref={budgetTimelineRef}>
                <BudgetTimelineAccordion
                  isOpen={isOpen('budgetTimeline')}
                  onToggle={() => toggleAccordion('budgetTimeline')}
                  isComplete={validation.isBudgetTimelineComplete}
                  methods={methods}
                  errors={errors}
                  isSubmitting={isSubmitting}
                  budgetRanges={BUDGET_RANGES}
                  timelines={TIMELINES}
                  tAccordion={tAccordion}
                  tFields={tFields}
                  tHelp={tHelp}
                  tTips={tTips}
                />
              </div>

              {/* Preferred Contact Method Accordion */}
              <div ref={contactMethodRef}>
                <ContactMethodAccordion
                  isOpen={isOpen('contactMethod')}
                  onToggle={() => toggleAccordion('contactMethod')}
                  isComplete={validation.isContactMethodComplete}
                  methods={methods}
                  errors={errors}
                  isSubmitting={isSubmitting}
                  contactMethods={CONTACT_METHODS}
                  selectedContactMethod={formValues.selectedContactMethod}
                  onSelectContactMethod={selectContactMethod}
                  tAccordion={tAccordion}
                  tHelp={tHelp}
                  tTips={tTips}
                />
              </div>

              {/* Additional Notes Accordion */}
              <div ref={notesRef}>
                <NotesAccordion
                  isOpen={isOpen('notes')}
                  onToggle={() => toggleAccordion('notes')}
                  methods={methods}
                  errors={errors}
                  isSubmitting={isSubmitting}
                  tAccordion={tAccordion}
                  tFields={tFields}
                />
              </div>
            </Accordion>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`
                px-8 py-3 bg-black text-white rounded-lg border-2 border-black
                font-bold text-lg cursor-pointer
                transition-all duration-200
                hover:bg-gray-900 active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
              `}
            >
              {isSubmitting ? tButtons('submitting') : tButtons('submit')}
            </button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
