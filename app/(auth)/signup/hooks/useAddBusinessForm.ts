'use client';

import { useState } from 'react';
import { AddressData } from '@/components/AddressAutocomplete';
import { LinkItem } from '@/components/proscard/ProLinks';

export interface BusinessFormState {
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
  links: LinkItem[];
  currentStep: number;
  error: string | null;
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
}

const initialState: BusinessFormState = {
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
  links: [],
  currentStep: 1,
  error: null,
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
    const newLicenses = [...formState.licenses];
    newLicenses[index] = { ...newLicenses[index], [field]: value };
    updateField('licenses', newLicenses);
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

  const setError = (error: string | null) => {
    setFormState(prev => ({ ...prev, error }));
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
      }));
    }
  };

  const handlePrevious = () => {
    if (formState.currentStep > 1) {
      setFormState(prev => ({
        ...prev,
        currentStep: prev.currentStep - 1,
        error: null,
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
    handleAddressSelect,
    handleAddressChange,
    updateLink,
    setError,
    setLoading,
    getTotalSteps,
    getStepLabel,
    handleNext,
    handlePrevious,
  };
}

