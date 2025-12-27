'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldPath, FieldPathValue, SubmitErrorHandler, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LinkItem } from '@/components/proscard/ProLinks';
import { businessSchema, type BusinessFormValues } from '@/lib/schemas/business';
import { useAddressField } from '@/hooks/useAddressField';
import { type PersonalData } from '@/lib/utils/personalData';

export interface BusinessUIState {
  currentStep: number;
  error: string | null;
  isLoading: boolean;
}

const TOTAL_STEPS = 5;

export function useAddBusinessForm(personalData?: PersonalData) {
  const [uiState, setUiState] = useState<BusinessUIState>({
    currentStep: 1,
    error: null,
    isLoading: false,
  });

  const methods = useForm<BusinessFormValues>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      businessName: '',
      slug: '',
      companyDescription: '',
      businessLogo: '',
      businessBackground: '',
      licenses: [{ license: '', licenseNumber: '' }],
      address: '',
      streetAddress: '',
      city: '',
      state: 'NV',
      zipCode: '',
      apartment: '',
      email: '',
      phone: '',
      mobilePhone: '',
      links: [],
    },
    mode: 'onChange',
  });

  const { 
    setValue, 
    trigger, 
    handleSubmit, 
    formState: { errors } 
  } = methods;

  const applyPersonalAddress = (): void => {
    if (personalData) {
      const address = personalData.address || '';
      const streetAddress = personalData.streetAddress || address;
      
      setValue('address', address);
      setValue('streetAddress', streetAddress);
      setValue('city', personalData.city || '');
      setValue('state', personalData.state || 'NV');
      setValue('zipCode', personalData.zipCode || '');
      setValue('apartment', personalData.apartment || '');
      trigger(['streetAddress', 'city', 'state', 'zipCode']);
    }
  };

  const applyPersonalEmail = (): void => {
    if (personalData?.email) {
      setValue('email', personalData.email);
      trigger('email');
    }
  };

  const applyPersonalPhone = (): void => {
    if (personalData?.phone) {
      setValue('phone', personalData.phone);
      trigger('phone');
    }
  };

  const applyPersonalMobilePhone = (): void => {
    if (personalData?.mobilePhone) {
      setValue('mobilePhone', personalData.mobilePhone);
      trigger('mobilePhone');
    } else if (personalData?.phone) {
      setValue('mobilePhone', personalData.phone);
      trigger('mobilePhone');
    }
  };

  const { handleAddressSelect, handleAddressChange } = useAddressField(setValue, trigger);

  const updateLink = (type: LinkItem['type'], url?: string, value?: string) => {
    const currentLinks = methods.getValues('links') || [];
    const newLinks = [...currentLinks];
    const existingIndex = newLinks.findIndex(link => link.type === type);
    
    // If no values provided and it exists, it's a removal request
    if (existingIndex >= 0 && url === undefined && value === undefined) {
      newLinks.splice(existingIndex, 1);
      setValue('links', newLinks, { shouldValidate: true });
      return;
    }

    const linkData = { 
      type, 
      url: url || '', 
      value: value || '' 
    };

    if (existingIndex >= 0) {
      newLinks[existingIndex] = linkData;
    } else {
      // Limit to 15 links as requested
      if (newLinks.length < 15) {
        newLinks.push(linkData);
      }
    }
    
    setValue('links', newLinks, { shouldValidate: true });
  };

  const reorderLinks = (fromIndex: number, toIndex: number) => {
    const currentLinks = methods.getValues('links') || [];
    const newLinks = [...currentLinks];
    const [movedLink] = newLinks.splice(fromIndex, 1);
    newLinks.splice(toIndex, 0, movedLink);
    setValue('links', newLinks);
  };

  const reorderLicenses = (fromIndex: number, toIndex: number) => {
    const currentLicenses = methods.getValues('licenses') || [];
    const newLicenses = [...currentLicenses];
    const [movedLicense] = newLicenses.splice(fromIndex, 1);
    newLicenses.splice(toIndex, 0, movedLicense);
    setValue('licenses', newLicenses);
  };

  const getTotalSteps = (): number => TOTAL_STEPS;

  const getStepLabel = (): string => {
    switch (uiState.currentStep) {
      case 1: return 'stepLabels.businessInformation';
      case 2: return 'stepLabels.licenses';
      case 3: return 'stepLabels.address';
      case 4: return 'stepLabels.contact';
      case 5: return 'stepLabels.links';
      default: return '';
    }
  };

  const handleNext = async () => {
    let fieldsToValidate: FieldPath<BusinessFormValues>[] = [];
    if (uiState.currentStep === 1) {
      fieldsToValidate = ['businessName', 'slug', 'companyDescription'];
    } else if (uiState.currentStep === 2) {
      fieldsToValidate = ['licenses'];
    } else if (uiState.currentStep === 3) {
      fieldsToValidate = ['streetAddress', 'city', 'state', 'zipCode'];
    } else if (uiState.currentStep === 4) {
      fieldsToValidate = ['email', 'phone', 'mobilePhone'];
    }

    const isStepValid = await trigger(fieldsToValidate);

    if (isStepValid && uiState.currentStep === 4) {
      const phone = methods.getValues('phone');
      const mobilePhone = methods.getValues('mobilePhone');
      if (!phone?.trim() && !mobilePhone?.trim()) {
        methods.setError('phone', { message: 'At least one phone number is required' });
        return;
      }
    }

    if (isStepValid && uiState.currentStep < TOTAL_STEPS) {
      methods.clearErrors(); // Clear any existing errors when moving to next step
      setUiState(prev => ({
        ...prev,
        currentStep: prev.currentStep + 1,
        error: null,
      }));
    }
  };

  const handlePrevious = () => {
    if (uiState.currentStep > 1) {
      setUiState(prev => ({
        ...prev,
        currentStep: prev.currentStep - 1,
        error: null,
      }));
    }
  };

  return {
    formState: {
      ...uiState,
      fieldErrors: Object.keys(errors).reduce((acc, key) => {
        const errorForKey = (errors as Record<string, unknown>)[key];
        acc[key] =
          typeof errorForKey === 'object' &&
          errorForKey !== null &&
          'message' in errorForKey &&
          typeof (errorForKey as { message?: unknown }).message === 'string'
            ? (errorForKey as { message: string }).message
            : undefined;
        return acc;
      }, {} as { [key: string]: string | undefined }),
    },
    methods,
    updateField: <TField extends FieldPath<BusinessFormValues>>(
      field: TField,
      value: FieldPathValue<BusinessFormValues, TField>
    ) => setValue(field, value),
    applyPersonalAddress,
    applyPersonalEmail,
    applyPersonalPhone,
    applyPersonalMobilePhone,
    handleAddressSelect,
    handleAddressChange,
    updateLink,
    reorderLinks,
    reorderLicenses,
    setError: (error: string | null) => setUiState(prev => ({ ...prev, error })),
    setFieldErrors: () => {},
    setLoading: (isLoading: boolean) => setUiState(prev => ({ ...prev, isLoading })),
    getTotalSteps,
    getStepLabel,
    handleNext,
    handlePrevious,
    handleSubmit: (
      onValid: SubmitHandler<BusinessFormValues>,
      onInvalid?: SubmitErrorHandler<BusinessFormValues>
    ) => handleSubmit(onValid, onInvalid),
  };
}
