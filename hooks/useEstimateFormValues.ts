import { useWatch } from 'react-hook-form';
import { UseFormReturn } from 'react-hook-form';
import { EstimateSchema } from '@/lib/schemas/estimate';

/**
 * Custom hook to efficiently watch multiple form fields at once
 * This reduces re-renders compared to multiple individual watch() calls
 */
export function useEstimateFormValues(methods: UseFormReturn<EstimateSchema>) {
  const formValues = useWatch({
    control: methods.control,
    name: [
      'firstName',
      'lastName',
      'email',
      'phone',
      'streetAddress',
      'city',
      'state',
      'zipCode',
      'projectType',
      'projectTypeOther',
      'trades',
      'projectDescription',
      'budgetRange',
      'timeline',
      'preferredContactMethod',
    ],
  });

  return {
    firstName: formValues[0] as string | undefined,
    lastName: formValues[1] as string | undefined,
    email: formValues[2] as string | undefined,
    phone: formValues[3] as string | undefined,
    streetAddress: formValues[4] as string | undefined,
    city: formValues[5] as string | undefined,
    state: formValues[6] as string | undefined,
    zipCode: formValues[7] as string | undefined,
    selectedProjectType: formValues[8] as EstimateSchema['projectType'],
    projectTypeOther: formValues[9] as string | undefined,
    selectedTrades: (formValues[10] as string[]) || [],
    projectDescription: formValues[11] as string | undefined,
    budgetRange: formValues[12] as EstimateSchema['budgetRange'],
    timeline: formValues[13] as EstimateSchema['timeline'],
    selectedContactMethod: formValues[14] as EstimateSchema['preferredContactMethod'],
  };
}

