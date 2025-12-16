'use client';

import { useState } from 'react';
import { AddressData } from '@/components/AddressAutocomplete';
import { LinkItem } from '@/components/proscard/ProLinks';

export interface BusinessFormState {
  businessLogo: string | null;
  businessName: string;
  licenses: Array<{ license: string; trade: string; licenseNumber: string }>;
  address: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  apartment: string;
  email: string;
  phone: string;
  mobilePhone: string;
  links: LinkItem[];
  currentStep: number;
  error: string | null;
  fieldErrors: { [key: string]: string | undefined };
  isLoading: boolean;
}

export interface PersonalData {
  address?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  apartment?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
}

const initialState: BusinessFormState = {
  businessLogo: null,
  businessName: '',
  licenses: [{ license: '', trade: '', licenseNumber: '' }],
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
  currentStep: 1,
  error: null,
  fieldErrors: {},
  isLoading: false,
};

const TOTAL_STEPS = 4;

export function useAddBusinessForm(personalData?: PersonalData) {
  const [formState, setFormState] = useState<BusinessFormState>(initialState);

  const updateField = <K extends keyof BusinessFormState>(
    field: K,
    value: BusinessFormState[K]
  ) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const handleLicenseChange = (
    index: number,
    field: 'license' | 'trade' | 'licenseNumber',
    value: string
  ) => {
    setFormState(prev => {
      const newLicenses = [...prev.licenses];
      newLicenses[index] = { ...newLicenses[index], [field]: value };
      return { ...prev, licenses: newLicenses };
    });
  };

  const addLicense = () => {
    updateField('licenses', [
      ...formState.licenses,
      { license: '', trade: '', licenseNumber: '' },
    ]);
  };

  const removeLicense = (index: number) => {
    if (formState.licenses.length > 1) {
      const newLicenses = formState.licenses.filter((_, i) => i !== index);
      updateField('licenses', newLicenses);
    }
  };

  const usePersonalAddress = () => {
    if (personalData) {
      updateField('address', personalData.address || '');
      updateField('streetAddress', personalData.streetAddress || '');
      updateField('city', personalData.city || '');
      updateField('state', personalData.state || 'NV');
      updateField('zipCode', personalData.zipCode || '');
      updateField('apartment', personalData.apartment || '');
    }
  };

  const usePersonalEmail = () => {
    if (personalData?.email) {
      updateField('email', personalData.email);
    }
  };

  const usePersonalPhone = () => {
    if (personalData?.phone) {
      updateField('phone', personalData.phone);
    }
  };

  const usePersonalMobilePhone = () => {
    // Use mobilePhone if available, otherwise fall back to phone
    if (personalData?.mobilePhone) {
      updateField('mobilePhone', personalData.mobilePhone);
    } else if (personalData?.phone) {
      updateField('mobilePhone', personalData.phone);
    }
  };

  const handleAddressSelect = (addressData: AddressData) => {
    setFormState(prev => ({
      ...prev,
      streetAddress: addressData.streetAddress,
      city: addressData.city,
      state: addressData.state,
      zipCode: addressData.zipCode,
      address: addressData.streetAddress,
    }));
  };

  const handleAddressChange = (value: string) => {
    setFormState(prev => {
      if (!value) {
        return {
          ...prev,
          address: '',
          streetAddress: '',
          city: '',
          state: 'NV',
          zipCode: '',
        };
      }
      return { ...prev, address: value };
    });
  };

  const updateLink = (type: LinkItem['type'], url?: string, value?: string) => {
    const newLinks = [...formState.links];
    const existingIndex = newLinks.findIndex(link => link.type === type);
    
    if (existingIndex >= 0) {
      if (url || value) {
        newLinks[existingIndex] = { type, url, value };
      } else {
        newLinks.splice(existingIndex, 1);
      }
    } else if (url || value) {
      newLinks.push({ type, url, value });
    }
    
    updateField('links', newLinks);
  };

  const reorderLinks = (fromIndex: number, toIndex: number) => {
    const newLinks = [...formState.links];
    const [movedLink] = newLinks.splice(fromIndex, 1);
    newLinks.splice(toIndex, 0, movedLink);
    updateField('links', newLinks);
  };

  const setError = (error: string | null) => {
    setFormState(prev => ({ ...prev, error }));
  };

  const setFieldErrors = (fieldErrors: { [key: string]: string | undefined }) => {
    setFormState(prev => ({ ...prev, fieldErrors }));
  };

  const setLoading = (isLoading: boolean) => {
    setFormState(prev => ({ ...prev, isLoading }));
  };

  const getTotalSteps = (): number => {
    return TOTAL_STEPS;
  };

  const getStepLabel = (): string => {
    switch (formState.currentStep) {
      case 1:
        return 'Business Information';
      case 2:
        return 'Address Information';
      case 3:
        return 'Contact Information';
      case 4:
        return 'Web Presence';
      default:
        return '';
    }
  };

  const handleNext = () => {
    if (formState.currentStep < TOTAL_STEPS) {
      setFormState(prev => ({
        ...prev,
        currentStep: prev.currentStep + 1,
        error: null,
        fieldErrors: {},
      }));
    }
  };

  const handlePrevious = () => {
    if (formState.currentStep > 1) {
      setFormState(prev => ({
        ...prev,
        currentStep: prev.currentStep - 1,
        error: null,
        fieldErrors: {},
      }));
    }
  };

  return {
    formState,
    updateField,
    handleLicenseChange,
    addLicense,
    removeLicense,
    usePersonalAddress,
    usePersonalEmail,
    usePersonalPhone,
    usePersonalMobilePhone,
    handleAddressSelect,
    handleAddressChange,
    updateLink,
    reorderLinks,
    setError,
    setFieldErrors,
    setLoading,
    getTotalSteps,
    getStepLabel,
    handleNext,
    handlePrevious,
  };
}

