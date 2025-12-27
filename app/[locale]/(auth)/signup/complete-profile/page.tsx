'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { SignupHeader } from '../components/SignupHeader';
import { SignupSuccessMessage } from '../components/SignupSuccessMessage';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { USER_TYPES } from '@/lib/constants/auth';
import { CustomerStep1 } from '../components/steps/CustomerStep1';
import { CustomerStep2 } from '../components/steps/CustomerStep2';
import { CustomerStep3 } from '../components/steps/CustomerStep3';
import { ContractorStep1 } from '../components/steps/ContractorStep1';
import { ContractorStep2 } from '../components/steps/ContractorStep2';
import { ContractorStep3 } from '../components/steps/ContractorStep3';
import { ContractorStep4 } from '../components/steps/ContractorStep4';
import { ContractorStepLinks } from '../components/steps/ContractorStepLinks';
import { LinkItem } from '@/components/proscard/ProLinks';
import { SignupStepsIndicator } from '../components/SignupStepsIndicator';
import { useForm, FormProvider, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupSchema } from '@/lib/schemas/auth';
import { AddressData } from '@/components/AddressAutocomplete';

function CompleteProfileForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const { user, updateUser, checkAuth } = useAuth();
  const role = searchParams.get('role') as 'customer' | 'contractor' | 'both' | null;
  
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Determine user type for form display
  const userType = role === 'both' ? USER_TYPES.CONTRACTOR : (role === 'customer' ? USER_TYPES.CUSTOMER : USER_TYPES.CONTRACTOR);
  // Contractors now have 5 steps: Personal Info, License/Company, Contact, Links, Terms
  const totalSteps = userType === USER_TYPES.CONTRACTOR ? 5 : 3;

  const methods = useForm<SignupSchema>({
    resolver: zodResolver(signupSchema) as any,
    defaultValues: {
      userType,
      referral: '',
      referralOther: '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      companyName: '',
      companyRole: '',
      companyRoleOther: '',
      email: user?.email || '',
      password: '',
      confirmPassword: '',
      phone: user?.phone || '',
      address: '',
      streetAddress: user?.streetAddress || '',
      city: user?.city || '',
      state: user?.state || 'NV',
      zipCode: user?.zipCode || '',
      apartment: user?.apartment || '',
      gateCode: user?.gateCode || '',
      addressNote: user?.addressNote || '',
      agreeToTerms: false,
      licenses: [{ license: '', trade: '' }],
      links: [],
      userPicture: user?.userPicture || '',
    },
    mode: 'onChange',
  });

  const { watch, setValue, trigger, handleSubmit } = methods;
  const referral = watch('referral');
  const companyRole = watch('companyRole');
  const isAuthenticated = !!user;

  // Links management functions
  const updateLink = (type: LinkItem['type'], url?: string, value?: string) => {
    const currentLinks = (methods.getValues('links') || []) as LinkItem[];
    const newLinks = [...currentLinks];
    const existingIndex = newLinks.findIndex(link => link.type === type);
    
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
      if (newLinks.length < 15) {
        newLinks.push(linkData);
      }
    }
    
    setValue('links', newLinks, { shouldValidate: true });
  };

  const reorderLinks = (fromIndex: number, toIndex: number) => {
    const currentLinks = (methods.getValues('links') || []) as LinkItem[];
    const newLinks = [...currentLinks];
    const [movedLink] = newLinks.splice(fromIndex, 1);
    newLinks.splice(toIndex, 0, movedLink);
    setValue('links', newLinks);
  };

  // Note: We don't auto-redirect here because:
  // 1. OAuth users may have firstName/lastName from Google but still need to complete profile
  // 2. Users explicitly come to this page to complete their profile
  // The form submission will handle the redirect after completion

  const handleAddressSelect = (addressData: AddressData) => {
    setValue('streetAddress', addressData.streetAddress);
    setValue('city', addressData.city);
    setValue('state', addressData.state);
    setValue('zipCode', addressData.zipCode);
    setValue('apartment', '');
    setValue('address', addressData.streetAddress);
    trigger(['streetAddress', 'city', 'state', 'zipCode']);
  };

  const handleAddressChange = (value: string) => {
    setValue('address', value);
    setValue('streetAddress', value);
    if (!value) {
      setValue('streetAddress', '');
      setValue('city', '');
      setValue('state', 'NV');
      setValue('zipCode', '');
      setValue('apartment', '');
      setValue('gateCode', '');
      setValue('addressNote', '');
    }
    if (value) {
      trigger('streetAddress');
    }
  };

  const handleNext = async () => {
    let fieldsToValidate: FieldPath<SignupSchema>[] = [];
    
    if (userType === USER_TYPES.CUSTOMER) {
      if (currentStep === 1) {
        fieldsToValidate = ['firstName', 'lastName', 'referral'];
        if (referral === 'Other') fieldsToValidate.push('referralOther');
      } else if (currentStep === 2) {
        fieldsToValidate = ['streetAddress', 'city', 'state', 'zipCode'];
      }
    } else {
      if (currentStep === 1) {
        fieldsToValidate = ['firstName', 'lastName', 'referral'];
        if (referral === 'Other') fieldsToValidate.push('referralOther');
      } else if (currentStep === 2) {
        // For OAuth users (authenticated), skip email/password validation
        if (isAuthenticated) {
          fieldsToValidate = ['companyName', 'companyRole', 'licenses'];
        } else {
          fieldsToValidate = ['email', 'password', 'confirmPassword', 'companyName', 'companyRole', 'licenses'];
        }
        if (companyRole === 'Other') fieldsToValidate.push('companyRoleOther');
      } else if (currentStep === 3) {
        // Step 3 for contractor has no required fields (contact info is optional)
      } else if (currentStep === 4) {
        // Step 4 (Links) has no required fields
      }
    }

    const isStepValid = await trigger(fieldsToValidate);
    
    if (isStepValid && currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      setError(null);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const onSubmit = async (data: SignupSchema) => {
    if (!user) {
      setError('You must be logged in to complete your profile');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await updateUser({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        referral: data.referral,
        referralOther: data.referralOther,
        companyName: data.companyName,
        companyRole: data.companyRole,
        companyRoleOther: data.companyRoleOther,
        userPicture: data.userPicture,
      });

      // Upsert personal address (source of truth: addresses table)
      const hasAnyAddressField = !!(
        data.streetAddress?.trim() ||
        data.city?.trim() ||
        data.state?.trim() ||
        data.zipCode?.trim()
      );

      if (hasAnyAddressField) {
        // Get CSRF token
        let csrfToken = '';
        try {
          const csrfRes = await fetch('/api/csrf-token', { method: 'GET', credentials: 'include' });
          if (csrfRes.ok) {
            const csrfData = await csrfRes.json();
            csrfToken = csrfData.csrfToken;
          }
        } catch {
          // If CSRF token fetch fails, address write will be rejected and surfaced below
        }

        // Find existing personal address (if any)
        let existingPersonalId: string | null = null;
        try {
          const addrRes = await fetch('/api/addresses?type=personal', { method: 'GET', credentials: 'include' });
          if (addrRes.ok) {
            const addrData = await addrRes.json();
            const addr = Array.isArray(addrData.addresses) ? addrData.addresses[0] : null;
            if (addr?.id) existingPersonalId = addr.id;
          }
        } catch {
          // Non-fatal, fallback to creating new
        }

        const payload = {
          addressType: 'personal',
          streetAddress: (data.streetAddress || '').trim(),
          apartment: (data.apartment || '').trim() || undefined,
          city: (data.city || '').trim(),
          state: (data.state || 'NV').trim(),
          zipCode: (data.zipCode || '').trim(),
          gateCode: (data.gateCode || '').trim() || undefined,
          addressNote: (data.addressNote || '').trim() || undefined,
          isPublic: false,
        };

        const url = existingPersonalId ? `/api/addresses/${existingPersonalId}` : '/api/addresses';
        const method = existingPersonalId ? 'PUT' : 'POST';

        const saveRes = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to save address');
        }
      }

      await checkAuth();
      
      // Redirect based on role
      if (role === 'contractor' || role === 'both') {
        // Store licenses and links temporarily for business creation
        // Convert licenses to business format (license -> licenseNumber, trade -> licenseNumber)
        const businessLicenses = (data.licenses || [])
          .filter((l) => l.license && l.trade)
          .map((l) => ({
            license: l.license!,
            licenseNumber: l.trade!, // In signup schema, trade is the license number
          }));
        
        const pendingContractorData = {
          licenses: businessLicenses,
          links: (data.links || []) as LinkItem[],
        };

        // Store in sessionStorage for business form to pick up
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pendingContractorData', JSON.stringify(pendingContractorData));
        }

        router.push(`/${locale}/business/add`);
      } else {
        router.push(`/${locale}/account-management`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    if (userType === USER_TYPES.CUSTOMER) {
      switch (currentStep) {
        case 1:
          return <CustomerStep1 />;
        case 2:
          return (
            <CustomerStep2
              onAddressSelect={handleAddressSelect}
              onAddressChange={handleAddressChange}
            />
          );
        case 3:
          return <CustomerStep3 />;
        default:
          return null;
      }
    } else {
      switch (currentStep) {
        case 1:
          return <ContractorStep1 />;
        case 2:
          return <ContractorStep2 />;
        case 3:
          return <ContractorStep3 />;
        case 4:
          return (
            <ContractorStepLinks
              updateLink={updateLink}
              reorderLinks={reorderLinks}
              personalData={{
                phone: watch('phone'),
                mobilePhone: watch('mobilePhone'),
              }}
            />
          );
        case 5:
          return <ContractorStep4 />;
        default:
          return null;
      }
    }
  };

  const getStepLabel = (): string => {
    if (userType === USER_TYPES.CUSTOMER) {
      switch (currentStep) {
        case 1: return 'Personal Information';
        case 2: return 'Address Information';
        case 3: return 'Complete';
        default: return '';
      }
    } else {
      switch (currentStep) {
        case 1: return 'Personal Information';
        case 2: return 'Contractor License';
        case 3: return 'Contact Information';
        case 4: return 'Links';
        case 5: return 'Terms & Conditions';
        default: return '';
      }
    }
  };

  // Note: Removed auto-success message check - users should complete the form
  // even if they have basic info from OAuth

  if (!user) {
    return (
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-gray-600 mb-4">Please sign in to complete your profile.</p>
          <Button onClick={() => router.push(`/${locale}/signin`)}>Sign In</Button>
        </div>
      </AuthPageLayout>
    );
  }

  return (
    <AuthPageLayout>
      <div className="w-full max-w-md mx-auto flex flex-col text-black">
        <FormProvider {...methods}>
          <div className="md:sticky md:top-0 md:z-20 md:bg-white">
            <SignupHeader isLoading={isLoading} />

            <SignupStepsIndicator
              currentStep={currentStep}
              totalSteps={totalSteps}
              stepLabel={getStepLabel()}
            />
          </div>

          <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6 flex-1 flex flex-col min-h-[400px]">
            <ErrorMessage message={error || ''} />
            {renderStep()}

            <div className="flex gap-4 mt-auto">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePrevious}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Previous
                </Button>
              )}
              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleNext}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isLoading || (userType === USER_TYPES.CONTRACTOR && !watch('agreeToTerms'))}
                  className="flex-1"
                >
                  {isLoading ? 'Saving...' : 'Complete Profile'}
                </Button>
              )}
            </div>
          </form>
        </FormProvider>
      </div>
    </AuthPageLayout>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-gray-600">Loading...</p>
        </div>
      </AuthPageLayout>
    }>
      <CompleteProfileForm />
    </Suspense>
  );
}

