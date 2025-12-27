import { useMemo } from 'react';
import { EstimateSchema } from '@/lib/schemas/estimate';

interface UseEstimateFormValidationProps {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  selectedProjectType?: EstimateSchema['projectType'];
  projectTypeOther?: string;
  selectedTrades: string[];
  projectDescription?: string;
  budgetRange?: EstimateSchema['budgetRange'];
  timeline?: EstimateSchema['timeline'];
  selectedContactMethod?: EstimateSchema['preferredContactMethod'];
  errors: {
    projectType?: { message?: string };
    projectTypeOther?: { message?: string };
    trades?: { message?: string };
    projectDescription?: { message?: string };
    budgetRange?: { message?: string };
    timeline?: { message?: string };
    preferredContactMethod?: { message?: string };
  };
}

export function useEstimateFormValidation({
  firstName,
  lastName,
  email,
  phone,
  streetAddress,
  city,
  state,
  zipCode,
  selectedProjectType,
  projectTypeOther,
  selectedTrades,
  projectDescription,
  budgetRange,
  timeline,
  selectedContactMethod,
}: UseEstimateFormValidationProps) {
  return useMemo(() => {
    const isCustomerInfoComplete = Boolean(
      firstName?.trim() &&
      lastName?.trim() &&
      email?.trim() &&
      phone?.trim() &&
      streetAddress?.trim() &&
      city?.trim() &&
      state?.trim() &&
      zipCode?.trim()
    );

    const isProjectTypeComplete = Boolean(
      selectedProjectType &&
      (selectedProjectType !== 'other' || (projectTypeOther?.trim() && projectTypeOther.trim().length > 0))
    );

    const isTradesComplete = selectedTrades.length > 0;

    const isDescriptionComplete = Boolean(
      projectDescription?.trim() && projectDescription.trim().length >= 10
    );

    const isBudgetTimelineComplete = Boolean(budgetRange && timeline);

    const isContactMethodComplete = Boolean(selectedContactMethod);

    return {
      isCustomerInfoComplete,
      isProjectTypeComplete,
      isTradesComplete,
      isDescriptionComplete,
      isBudgetTimelineComplete,
      isContactMethodComplete,
    };
  }, [
    firstName,
    lastName,
    email,
    phone,
    streetAddress,
    city,
    state,
    zipCode,
    selectedProjectType,
    projectTypeOther,
    selectedTrades,
    projectDescription,
    budgetRange,
    timeline,
    selectedContactMethod,
  ]);
}

