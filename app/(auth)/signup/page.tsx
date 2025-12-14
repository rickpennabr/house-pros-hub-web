'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { X, Plus } from 'lucide-react';
import Logo from '@/components/Logo';
import CategoryCarousel from '@/components/CategoryCarousel';
import AddressAutocomplete, { AddressData } from '@/components/AddressAutocomplete';
import { useAuth } from '@/contexts/AuthContext';
import { getReturnUrl, getRedirectPath } from '@/lib/redirect';

type UserType = 'customer' | 'contractor';

export default function SignUpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup, isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [userType, setUserType] = useState<UserType>('customer');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyRole, setCompanyRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [licenses, setLicenses] = useState<Array<{ license: string; trade: string }>>([{ license: '', trade: '' }]);
  const [locationPhone, setLocationPhone] = useState('');
  const [mobilePhone, setMobilePhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  // Customer-specific fields
  const [referral, setReferral] = useState('');
  const [referralOther, setReferralOther] = useState('');
  // Contractor-specific fields
  const [selectedName, setSelectedName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  // Address fields
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('NV');
  const [zipCode, setZipCode] = useState('');
  const [apartment, setApartment] = useState('');
  const [gateCode, setGateCode] = useState('');
  const [addressNote, setAddressNote] = useState('');
  const [addressSelected, setAddressSelected] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const returnUrl = getReturnUrl(searchParams);
      const redirectPath = getRedirectPath(returnUrl);
      router.push(redirectPath);
    }
  }, [isAuthenticated, searchParams, router]);


  // Calculate total steps based on user type
  const getTotalSteps = () => {
    return userType === 'contractor' ? 4 : 3;
  };

  // Get step label based on step number and user type
  const getStepLabel = () => {
    if (userType === 'customer') {
      switch (currentStep) {
        case 1:
          return 'Personal Information';
        case 2:
          return 'Address Information';
        case 3:
          return 'Credential Information';
        default:
          return '';
      }
    } else {
      // Contractor
      switch (currentStep) {
        case 1:
          return 'Personal Information';
        case 2:
          return 'Company Information';
        case 3:
          return 'Contact Information';
        case 4:
          return 'Terms & Conditions';
        default:
          return '';
      }
    }
  };

  const handleNext = () => {
    if (currentStep < getTotalSteps()) {
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

  const validateCurrentStep = () => {
    setError(null);
    
    if (userType === 'customer') {
      if (currentStep === 1) {
        if (!referral) {
          setError('Please select how you heard about us');
          return false;
        }
        if (referral === 'Other' && !referralOther.trim()) {
          setError('Please enter how you heard about us');
          return false;
        }
        if (!firstName) {
          setError('First name is required');
          return false;
        }
        if (!lastName) {
          setError('Last name is required');
          return false;
        }
      } else if (currentStep === 2) {
          if (!streetAddress.trim()) {
            setError('Street address is required');
            return false;
          }
          if (!city.trim()) {
            setError('City is required');
            return false;
          }
          if (!state.trim()) {
            setError('State is required');
            return false;
          }
          if (!zipCode.trim()) {
            setError('ZIP code is required');
            return false;
          }
      } else if (currentStep === 3) {
        if (!phone.trim()) {
          setError('Phone is required');
          return false;
        }
        if (!email) {
          setError('Email is required');
          return false;
        }
        if (!password) {
          setError('Password is required');
          return false;
        }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
          return false;
        }
      }
    } else {
      // Contractor validation
      if (currentStep === 1) {
        if (!selectedName) {
          setError('Please select a name');
          return false;
        }
        if (!firstName) {
          setError('First name is required');
          return false;
        }
        if (!lastName) {
          setError('Last name is required');
          return false;
        }
        if (!email) {
          setError('Email is required');
          return false;
        }
        if (!password) {
          setError('Password is required');
          return false;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          return false;
        }
      } else if (currentStep === 2) {
        if (!companyName) {
          setError('Company name is required');
          return false;
        }
      } else if (currentStep === 3) {
        // Step 3 validation can be added here if needed
      }
    }
    
    return true;
  };

  const handleStepNext = () => {
    if (validateCurrentStep()) {
      handleNext();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreeToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await signup({
        email,
        password,
        firstName,
        lastName,
        companyName: companyName || undefined,
        companyRole: companyRole || undefined,
      });
      
      // Redirect after successful signup
      const returnUrl = getReturnUrl(searchParams);
      const redirectPath = getRedirectPath(returnUrl);
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset step when user type changes
  useEffect(() => {
    setCurrentStep(1);
    setError(null);
    // Reset address fields
    setAddress('');
    setStreetAddress('');
    setCity('');
    setState('NV');
    setZipCode('');
    setApartment('');
    setGateCode('');
    setAddressNote('');
    setAddressSelected(false);
    // Reset contractor fields
    setSelectedName('');
  }, [userType]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-2 md:p-8">
      <div className="w-full md:w-[90%] h-[calc(100vh-1rem)] md:max-h-[90vh] bg-white rounded-lg overflow-hidden border-2 border-black flex flex-col">
        <div className="relative grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0 overflow-hidden">
          {/* Left Side - Carousel (Always visible, no sliding) */}
          <div className="hidden md:flex flex-col bg-white px-6 py-12 border-r-2 border-black h-full relative z-10">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-6 text-center">
              Sign up to find your House Pro.
            </h1>
            <div className="flex-1 flex flex-col justify-center">
              <CategoryCarousel direction="right" />
              <CategoryCarousel direction="left" />
              <CategoryCarousel direction="right" />
            </div>
          </div>

          {/* Right Side - Form (Keep same format, don't expand) */}
          <div className="flex flex-col bg-white transition-all duration-500 ease-in-out flex-1 min-h-0 overflow-y-auto pt-2 md:pt-6 px-3 md:px-12 pb-3 md:pb-12">
          <div className="w-full max-w-md mx-auto flex flex-col">
            {/* Fixed Header Section - Desktop Only */}
            <div className="md:sticky md:top-0 md:z-20 md:bg-white">
              {/* Header with Logo and Toggle Buttons */}
              <div className="flex items-center justify-between mb-2 md:mb-6 gap-4">
                {/* Logo on the left */}
                <Link href="/" className="cursor-pointer flex-shrink-0">
                  <Logo width={200} height={50} className="h-10 md:h-12 w-auto" />
                </Link>

                {/* Toggle Buttons */}
                <div className="flex gap-0 border-2 border-black rounded-lg overflow-hidden flex-shrink-0">
                <button
                  type="button"
                  onClick={() => router.push('/signin')}
                  disabled={isLoading}
                  className="px-3 md:px-3 py-2 md:py-1.5 text-sm md:text-sm font-medium transition-colors cursor-pointer bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/signup')}
                  disabled={isLoading}
                  className="px-3 md:px-3 py-2 md:py-1.5 text-sm md:text-sm font-medium transition-colors cursor-pointer bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sign Up
                </button>
                </div>
              </div>

              {/* User Type Tabs (Customer/Contractor) */}
              <div className="flex mb-4 border-b-2 border-black">
                  <button
                    type="button"
                    onClick={() => setUserType('customer')}
                    disabled={isLoading}
                    className={`flex-1 py-3 px-4 font-medium transition-colors cursor-pointer ${
                      userType === 'customer'
                        ? 'border-b-4 border-black bg-white'
                        : 'bg-white hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserType('contractor')}
                    disabled={isLoading}
                    className={`flex-1 py-3 px-4 font-medium transition-colors cursor-pointer ${
                      userType === 'contractor'
                        ? 'border-b-4 border-black bg-white'
                        : 'bg-white hover:bg-gray-50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Contractor
                  </button>
                </div>

              {/* Steps Counter */}
              <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">
                      Step {currentStep} of {getTotalSteps()}
                    </span>
                    <div className="flex gap-1">
                      {Array.from({ length: getTotalSteps() }).map((_, index) => (
                        <div
                          key={index}
                          className={`h-2 w-8 rounded-sm transition-colors ${
                            index + 1 <= currentStep
                              ? 'bg-black'
                              : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className="text-lg font-semibold text-black">
                      {getStepLabel()}
                    </span>
                  </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Sign Up Form */}
              <form onSubmit={handleSignUp} className="space-y-6 flex-1 flex flex-col min-h-[400px]">
                {/* Customer Step 1: Referral, First Name, Last Name */}
                {userType === 'customer' && currentStep === 1 && (
                  <div className="space-y-6 flex-1">
                    <div>
                      <label 
                        htmlFor="referral" 
                        className="block text-sm font-medium mb-2"
                      >
                        How did you hear about us?
                      </label>
                      <select
                        id="referral"
                        value={referral}
                        onChange={(e) => {
                          setReferral(e.target.value);
                          if (e.target.value !== 'Other') {
                            setReferralOther('');
                          }
                        }}
                        required
                        className="w-full px-2 py-3 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                        disabled={isLoading}
                      >
                        <option value="">Select an option</option>
                        <option value="Google">Google</option>
                        <option value="Instagram">Instagram</option>
                        <option value="Facebook">Facebook</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {referral === 'Other' && (
                      <div>
                        <label 
                          htmlFor="referralOther" 
                          className="block text-sm font-medium mb-2"
                        >
                          Please specify
                        </label>
                        <div className="relative">
                          <input
                            id="referralOther"
                            type="text"
                            value={referralOther}
                            onChange={(e) => setReferralOther(e.target.value)}
                            required
                            className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                            placeholder="How did you hear about us?"
                            disabled={isLoading}
                          />
                          {referralOther && (
                            <button
                              type="button"
                              onClick={() => setReferralOther('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                              disabled={isLoading}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <label 
                        htmlFor="firstName" 
                        className="block text-sm font-medium mb-2"
                      >
                        First Name
                      </label>
                      <div className="relative">
                        <input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="First name"
                          disabled={isLoading}
                        />
                        {firstName && (
                          <button
                            type="button"
                            onClick={() => setFirstName('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor="lastName" 
                        className="block text-sm font-medium mb-2"
                      >
                        Last Name
                      </label>
                      <div className="relative">
                        <input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Last name"
                          disabled={isLoading}
                        />
                        {lastName && (
                          <button
                            type="button"
                            onClick={() => setLastName('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer Step 2: Address */}
                {userType === 'customer' && currentStep === 2 && (
                  <div className="space-y-6 flex-1">
                    <div>
                      <label 
                        htmlFor="address" 
                        className="block text-sm font-medium mb-2"
                      >
                        Search Address (Nevada only)
                      </label>
                      <p className="text-xs text-gray-600 mb-2">
                        Search for your address or fill in the fields below manually
                      </p>
                      <AddressAutocomplete
                        id="address"
                        value={address}
                        onChange={(value) => {
                          setAddress(value);
                          // Clear address fields if user clears the search
                          if (!value) {
                            setStreetAddress('');
                            setCity('');
                            setState('NV');
                            setZipCode('');
                            setApartment('');
                            setGateCode('');
                            setAddressNote('');
                            setAddressSelected(false);
                          }
                        }}
                        onAddressSelect={(addressData: AddressData) => {
                          console.log('🎯 Parent: onAddressSelect called with:', addressData);
                          
                          // Set all address fields
                          setStreetAddress(addressData.streetAddress);
                          setCity(addressData.city);
                          setState(addressData.state);
                          setZipCode(addressData.zipCode);
                          setApartment('');
                          setAddressSelected(true);
                          
                          // Set the search address field to show only the street address portion
                          setAddress(addressData.streetAddress);
                          
                          console.log('✅ Parent: State updated -', {
                            streetAddress: addressData.streetAddress,
                            city: addressData.city,
                            state: addressData.state,
                            zipCode: addressData.zipCode,
                          });
                        }}
                        placeholder="Search for your Nevada address"
                        disabled={isLoading}
                      />
                    </div>

                    {/* Street Address - Hidden input for form validation, populated from search */}
                    <input
                      type="hidden"
                      value={streetAddress}
                      required
                    />

                    <div>
                      <label 
                        htmlFor="apartment" 
                        className="block text-sm font-medium mb-2"
                      >
                        Apartment, Suite, Unit (Optional)
                      </label>
                      <div className="relative">
                        <input
                          id="apartment"
                          type="text"
                          value={apartment}
                          onChange={(e) => setApartment(e.target.value)}
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Apt, Suite, Unit, etc."
                          disabled={isLoading}
                        />
                        {apartment && (
                          <button
                            type="button"
                            onClick={() => setApartment('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label 
                          htmlFor="city" 
                          className="block text-sm font-medium mb-2"
                        >
                          City
                        </label>
                        <div className="relative">
                          <input
                            id="city"
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            required
                            className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                            placeholder="City"
                            disabled={isLoading}
                          />
                          {city && (
                            <button
                              type="button"
                              onClick={() => setCity('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                              disabled={isLoading}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label 
                          htmlFor="state" 
                          className="block text-sm font-medium mb-2"
                        >
                          State
                        </label>
                        <div className="relative">
                          <input
                            id="state"
                            type="text"
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            required
                            className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                            placeholder="State"
                            disabled={isLoading}
                          />
                          {state && (
                            <button
                              type="button"
                              onClick={() => setState('NV')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                              disabled={isLoading}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor="zipCode" 
                        className="block text-sm font-medium mb-2"
                      >
                        ZIP Code
                      </label>
                      <div className="relative">
                        <input
                          id="zipCode"
                          type="text"
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          required
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="ZIP Code"
                          disabled={isLoading}
                        />
                        {zipCode && (
                          <button
                            type="button"
                            onClick={() => setZipCode('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor="gateCode" 
                        className="block text-sm font-medium mb-2"
                      >
                        Gate Code
                      </label>
                      <div className="relative">
                        <input
                          id="gateCode"
                          type="text"
                          value={gateCode}
                          onChange={(e) => setGateCode(e.target.value)}
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Gate code"
                          disabled={isLoading}
                        />
                        {gateCode && (
                          <button
                            type="button"
                            onClick={() => setGateCode('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor="addressNote" 
                        className="block text-sm font-medium mb-2"
                      >
                        Address Note
                      </label>
                      <div className="relative">
                        <textarea
                          id="addressNote"
                          value={addressNote}
                          onChange={(e) => setAddressNote(e.target.value)}
                          rows={3}
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all resize-none"
                          placeholder="Additional address notes or instructions"
                          disabled={isLoading}
                        />
                        {addressNote && (
                          <button
                            type="button"
                            onClick={() => setAddressNote('')}
                            className="absolute right-2 top-2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Customer Step 3: Phone, Email, Password, Repeat Password, Terms */}
                {userType === 'customer' && currentStep === 3 && (
                  <div className="space-y-6 flex-1">
                    <div>
                      <label 
                        htmlFor="phone" 
                        className="block text-sm font-medium mb-2"
                      >
                        Phone
                      </label>
                      <div className="relative">
                        <input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Enter your phone number"
                          disabled={isLoading}
                        />
                        {phone && (
                          <button
                            type="button"
                            onClick={() => setPhone('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                <div>
                  <label 
                    htmlFor="signup-email" 
                    className="block text-sm font-medium mb-2"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                      placeholder="Enter your email"
                      disabled={isLoading}
                    />
                    {email && (
                      <button
                        type="button"
                        onClick={() => setEmail('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                        disabled={isLoading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label 
                    htmlFor="signup-password" 
                    className="block text-sm font-medium mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-2 py-3 pr-10 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                      placeholder="password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m0 0l-2.4 2.4M21 21l-2.4-2.4M21 21l-3.228-3.228M21 21l-3.228-3.228"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                    <div>
                      <label 
                        htmlFor="confirm-password" 
                        className="block text-sm font-medium mb-2"
                      >
                        Repeat Password
                      </label>
                      <div className="relative">
                        <input
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          className="w-full px-2 py-3 pr-10 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="repeat password"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                          disabled={isLoading}
                        >
                          {showConfirmPassword ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className="w-5 h-5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m0 0l-2.4 2.4M21 21l-2.4-2.4M21 21l-3.228-3.228M21 21l-3.228-3.228"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className="w-5 h-5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="flex items-start">
                        <input
                          type="checkbox"
                          checked={agreeToTerms}
                          onChange={(e) => setAgreeToTerms(e.target.checked)}
                          className="w-4 h-4 mt-0.5 border-2 border-black rounded focus:ring-2 focus:ring-black"
                          disabled={isLoading}
                        />
                        <span className="ml-2 text-sm text-gray-600">
                          I agree to the{' '}
                          <Link href="/terms" className="underline hover:text-black">
                            Terms of Service
                          </Link>
                          {' '}and{' '}
                          <Link href="/privacy" className="underline hover:text-black">
                            Privacy Policy
                          </Link>
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Contractor Step 1: Name Dropdown, First Name, Last Name, Email, Password */}
                {userType === 'contractor' && currentStep === 1 && (
                  <div className="space-y-6 flex-1">
                    <div>
                      <label 
                        htmlFor="selectedName" 
                        className="block text-sm font-medium mb-2"
                      >
                        Select Name
                      </label>
                      <select
                        id="selectedName"
                        value={selectedName}
                        onChange={(e) => setSelectedName(e.target.value)}
                        required
                        className="w-full px-2 py-3 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                        disabled={isLoading}
                      >
                        <option value="">Select a name</option>
                        <option value="Vinny">Vinny</option>
                        <option value="Iris">Iris</option>
                        <option value="Delan">Delan</option>
                        <option value="Enrique">Enrique</option>
                      </select>
                    </div>

                    <div>
                      <label 
                        htmlFor="firstName" 
                        className="block text-sm font-medium mb-2"
                      >
                        First Name
                      </label>
                      <div className="relative">
                        <input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="First name"
                          disabled={isLoading}
                        />
                        {firstName && (
                          <button
                            type="button"
                            onClick={() => setFirstName('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor="lastName" 
                        className="block text-sm font-medium mb-2"
                      >
                        Last Name
                      </label>
                      <div className="relative">
                        <input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Last name"
                          disabled={isLoading}
                        />
                        {lastName && (
                          <button
                            type="button"
                            onClick={() => setLastName('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor="signup-email" 
                        className="block text-sm font-medium mb-2"
                      >
                        Email
                      </label>
                      <div className="relative">
                        <input
                          id="signup-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Enter your email"
                          disabled={isLoading}
                        />
                        {email && (
                          <button
                            type="button"
                            onClick={() => setEmail('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor="signup-password" 
                        className="block text-sm font-medium mb-2"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="signup-password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full px-2 py-3 pr-10 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="password"
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                          disabled={isLoading}
                        >
                          {showPassword ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className="w-5 h-5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m0 0l-2.4 2.4M21 21l-2.4-2.4M21 21l-3.228-3.228M21 21l-3.228-3.228"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              stroke="currentColor"
                              className="w-5 h-5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                <div>
                  <label 
                    htmlFor="confirm-password" 
                    className="block text-sm font-medium mb-2"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-2 py-3 pr-10 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                      placeholder="confirm password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m0 0l-2.4 2.4M21 21l-2.4-2.4M21 21l-3.228-3.228M21 21l-3.228-3.228"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                  </div>
                )}

                {/* Contractor Step 2: Company Information */}
                {userType === 'contractor' && currentStep === 2 && (
                  <div className="space-y-6 flex-1">
                    <div>
                      <label 
                        htmlFor="companyName" 
                        className="block text-sm font-medium mb-2"
                      >
                        Company Name
                      </label>
                      <div className="relative">
                        <input
                          id="companyName"
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          required
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Company name"
                          disabled={isLoading}
                        />
                        {companyName && (
                          <button
                            type="button"
                            onClick={() => setCompanyName('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor="companyRole" 
                        className="block text-sm font-medium mb-2"
                      >
                        Company Role
                      </label>
                      <div className="relative">
                        <input
                          id="companyRole"
                          type="text"
                          value={companyRole}
                          onChange={(e) => setCompanyRole(e.target.value)}
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Your role in the company"
                          disabled={isLoading}
                        />
                        {companyRole && (
                          <button
                            type="button"
                            onClick={() => setCompanyRole('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Conditional Fields - Contractor Only */}
                {currentStep === 3 && userType === 'contractor' && (
                  <div className="space-y-6 flex-1">
                    <div>
                      <label 
                        htmlFor="companyName" 
                        className="block text-sm font-medium mb-2"
                      >
                        Company Name
                      </label>
                      <div className="relative">
                        <input
                          id="companyName"
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          required
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Company name"
                          disabled={isLoading}
                        />
                        {companyName && (
                          <button
                            type="button"
                            onClick={() => setCompanyName('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor="companyRole" 
                        className="block text-sm font-medium mb-2"
                      >
                        Company Role
                      </label>
                      <div className="relative">
                        <input
                          id="companyRole"
                          type="text"
                          value={companyRole}
                          onChange={(e) => setCompanyRole(e.target.value)}
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Your role in the company"
                          disabled={isLoading}
                        />
                        {companyRole && (
                          <button
                            type="button"
                            onClick={() => setCompanyRole('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor="locationPhone" 
                        className="block text-sm font-medium mb-2"
                      >
                        Location Phone
                      </label>
                      <div className="relative">
                        <input
                          id="locationPhone"
                          type="tel"
                          value={locationPhone}
                          onChange={(e) => setLocationPhone(e.target.value)}
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Location phone number"
                          disabled={isLoading}
                        />
                        {locationPhone && (
                          <button
                            type="button"
                            onClick={() => setLocationPhone('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label 
                        htmlFor="mobilePhone" 
                        className="block text-sm font-medium mb-2"
                      >
                        Mobile Phone
                      </label>
                      <div className="relative">
                        <input
                          id="mobilePhone"
                          type="tel"
                          value={mobilePhone}
                          onChange={(e) => setMobilePhone(e.target.value)}
                          className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                          placeholder="Mobile phone number"
                          disabled={isLoading}
                        />
                        {mobilePhone && (
                          <button
                            type="button"
                            onClick={() => setMobilePhone('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                            disabled={isLoading}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 (Customer) or Step 4 (Contractor): Terms and Submit */}
                {((currentStep === 3 && userType === 'customer') || (currentStep === 4 && userType === 'contractor')) && (
                  <div className="space-y-6 flex-1">
                <div>
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={agreeToTerms}
                      onChange={(e) => setAgreeToTerms(e.target.checked)}
                      className="w-4 h-4 mt-0.5 border-2 border-black rounded focus:ring-2 focus:ring-black"
                      disabled={isLoading}
                    />
                    <span className="ml-2 text-sm text-gray-600">
                      I agree to the{' '}
                      <Link href="/terms" className="underline hover:text-black">
                        Terms of Service
                      </Link>
                      {' '}and{' '}
                      <Link href="/privacy" className="underline hover:text-black">
                        Privacy Policy
                      </Link>
                    </span>
                  </label>
                </div>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-4 pt-4 mt-auto">
                  {currentStep > 1 && (
                <button
                      type="button"
                      onClick={handlePrevious}
                  disabled={isLoading}
                      className="flex-1 py-3 px-4 border-2 border-black rounded-lg bg-white font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                  )}
                  {currentStep < getTotalSteps() ? (
                    <button
                      type="button"
                      onClick={handleStepNext}
                      disabled={isLoading}
                      className="flex-1 py-3 px-4 border-2 border-black rounded-lg bg-black text-white font-medium hover:bg-gray-800 active:bg-gray-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={isLoading || !agreeToTerms}
                      className="flex-1 py-3 px-4 border-2 border-black rounded-lg bg-black text-white font-medium hover:bg-gray-800 active:bg-gray-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating account...' : 'Sign Up'}
                </button>
                  )}
                </div>
              </form>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

