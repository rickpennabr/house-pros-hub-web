'use client';

import { useCallback } from 'react';
import { UseFormSetValue, UseFormTrigger, Path, PathValue } from 'react-hook-form';
import { AddressData } from '@/components/AddressAutocomplete';

/**
 * Hook to handle address field operations for react-hook-form
 * @param setValue - react-hook-form setValue function
 * @param trigger - react-hook-form trigger function
 * @returns Address field handlers
 */
export function useAddressField<T extends Record<string, unknown>>(
  setValue: UseFormSetValue<T>,
  trigger: UseFormTrigger<T>
) {
  const handleAddressSelect = useCallback(
    (addressData: AddressData) => {
      setValue('streetAddress' as Path<T>, addressData.streetAddress as PathValue<T, Path<T>>);
      setValue('city' as Path<T>, addressData.city as PathValue<T, Path<T>>);
      setValue('state' as Path<T>, addressData.state as PathValue<T, Path<T>>);
      setValue('zipCode' as Path<T>, addressData.zipCode as PathValue<T, Path<T>>);
      setValue('apartment' as Path<T>, '' as PathValue<T, Path<T>>);
      setValue('address' as Path<T>, addressData.streetAddress as PathValue<T, Path<T>>);
      trigger(['streetAddress', 'city', 'state', 'zipCode'] as Path<T>[]);
    },
    [setValue, trigger]
  );

  const handleAddressChange = useCallback(
    (value: string, includeAdditionalFields: boolean = false) => {
      setValue('address' as Path<T>, value as PathValue<T, Path<T>>);
      setValue('streetAddress' as Path<T>, value as PathValue<T, Path<T>>);
      
      if (!value) {
        setValue('streetAddress' as Path<T>, '' as PathValue<T, Path<T>>);
        setValue('city' as Path<T>, '' as PathValue<T, Path<T>>);
        setValue('state' as Path<T>, 'NV' as PathValue<T, Path<T>>);
        setValue('zipCode' as Path<T>, '' as PathValue<T, Path<T>>);
        
        // Optionally clear additional fields (used in signup form)
        if (includeAdditionalFields) {
          setValue('apartment' as Path<T>, '' as PathValue<T, Path<T>>);
          setValue('gateCode' as Path<T>, '' as PathValue<T, Path<T>>);
          setValue('addressNote' as Path<T>, '' as PathValue<T, Path<T>>);
        }
      }
      
      // Trigger validation if we have a value
      if (value) {
        trigger('streetAddress' as Path<T>);
      }
    },
    [setValue, trigger]
  );

  return {
    handleAddressSelect,
    handleAddressChange,
  };
}
