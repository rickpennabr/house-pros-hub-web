'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState, useMemo } from 'react';
import { isValidEmail, isNotEmpty } from '@/lib/validation';
import { ChevronDown, ChevronUp, User as UserIcon, X, UserPen, Settings } from 'lucide-react';
import { resizeImageSquare, base64ToFile } from '@/lib/utils/image';
import { useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import Image from 'next/image';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { createSignInUrl } from '@/lib/redirect';
import type { Locale } from '@/i18n';

export default function EditProfilePage() {
  const { user, isAuthenticated, isLoading, updateUser } = useAuth();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations('profileEdit');
  const tAccount = useTranslations('accountManagement');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    referral: '',
    referralOther: '',
    streetAddress: '',
    apartment: '',
    city: '',
    state: '',
    zipCode: '',
    gateCode: '',
    addressNote: '',
    companyName: '',
    companyRole: '',
    companyRoleOther: '',
    userPicture: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(true);
  const [isAddressInfoOpen, setIsAddressInfoOpen] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [personalAddressId, setPersonalAddressId] = useState<string | null>(null);
  const [initialFormData, setInitialFormData] = useState<typeof formData | null>(null);

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(createSignInUrl(locale, '/profile/edit'));
    }
  }, [isAuthenticated, isLoading, router, locale]);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      const initialData = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        referral: user.referral || '',
        referralOther: user.referralOther || '',
        // Address is now sourced from `addresses` table (we'll hydrate below).
        // Keep legacy profile fields only as fallback until migration fully completes.
        streetAddress: user.streetAddress || '',
        apartment: user.apartment || '',
        city: user.city || '',
        state: user.state || '',
        zipCode: user.zipCode || '',
        gateCode: user.gateCode || '',
        addressNote: user.addressNote || '',
        userPicture: user.userPicture || '',
        companyName: user.companyName || '',
        companyRole: user.companyRole || '',
        companyRoleOther: user.companyRoleOther || '',
      };
      setFormData(initialData);
      setInitialFormData(initialData);
      // Only set previewImage if userPicture is a valid non-empty string
      const validPicture = user.userPicture && typeof user.userPicture === 'string' && user.userPicture.trim().length > 0
        ? user.userPicture.trim()
        : null;
      setPreviewImage(validPicture);
    }
  }, [user]);

  // Hydrate personal address from `/api/addresses?type=personal` (source of truth)
  // Only load once when user is available and we don't have an address ID yet
  useEffect(() => {
    if (!user?.id || personalAddressId !== null) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/addresses?type=personal', {
          method: 'GET',
          credentials: 'include',
        });

        if (!res.ok) return;
        const data = await res.json();
        const addr = Array.isArray(data.addresses) ? data.addresses[0] : null;
        if (!addr || cancelled) return;

        setPersonalAddressId(addr.id);
        setFormData((prev) => {
          const updated = {
            ...prev,
            streetAddress: addr.streetAddress || '',
            apartment: addr.apartment || '',
            city: addr.city || '',
            state: addr.state || '',
            zipCode: addr.zipCode || '',
            gateCode: addr.gateCode || '',
            addressNote: addr.addressNote || '',
          };
          // Update initial form data when address is loaded
          setInitialFormData((initial) => initial ? { ...initial, ...updated } : updated);
          return updated;
        });
      } catch {
        // Non-fatal: fallback to legacy fields already in state
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, personalAddressId]);

  // Check if form has been modified - compare all fields individually
  // This must be called before any early returns to follow Rules of Hooks
  const hasChanges = useMemo(() => {
    if (!initialFormData) return false;
    return (
      formData.firstName !== initialFormData.firstName ||
      formData.lastName !== initialFormData.lastName ||
      formData.email !== initialFormData.email ||
      formData.phone !== initialFormData.phone ||
      formData.referral !== initialFormData.referral ||
      formData.referralOther !== initialFormData.referralOther ||
      formData.streetAddress !== initialFormData.streetAddress ||
      formData.apartment !== initialFormData.apartment ||
      formData.city !== initialFormData.city ||
      formData.state !== initialFormData.state ||
      formData.zipCode !== initialFormData.zipCode ||
      formData.gateCode !== initialFormData.gateCode ||
      formData.addressNote !== initialFormData.addressNote ||
      formData.userPicture !== initialFormData.userPicture ||
      formData.companyName !== initialFormData.companyName ||
      formData.companyRole !== initialFormData.companyRole ||
      formData.companyRoleOther !== initialFormData.companyRoleOther
    );
  }, [formData, initialFormData]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="text-lg">{t('loading')}</div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated || !user) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Format phone number if it's the phone field
    const formattedValue = name === 'phone' ? formatPhoneNumber(value) : value;
    setFormData(prev => ({
      ...prev,
      [name]: formattedValue,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, userPicture: t('errors.imageFile') }));
      return;
    }

    if (!user?.id) {
      setErrors(prev => ({ ...prev, userPicture: t('errors.mustBeLoggedIn') }));
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Resize and upload to storage
    try {
      // Resize image first
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const resizedBase64 = await resizeImageSquare(base64, 400, 0.85);
      setPreviewImage(resizedBase64);

      // Convert base64 to File for upload
      const resizedFile = base64ToFile(resizedBase64, file.name);

      // Upload to storage
      const formDataObj = new FormData();
      formDataObj.append('file', resizedFile);
      formDataObj.append('userId', user.id);

      const response = await fetch('/api/storage/upload-profile-picture', {
        method: 'POST',
        body: formDataObj,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }

      const result = await response.json();

      // Store the URL instead of base64
      setFormData(prev => ({ ...prev, userPicture: result.url }));
    } catch (error) {
      console.error('Error uploading image:', error);
      setErrors(prev => ({ 
        ...prev, 
        userPicture: error instanceof Error ? error.message : 'Failed to upload image' 
      }));
      setPreviewImage(null);
    }
  };

  const handleRemoveImage = () => {
    setPreviewImage(null);
    setFormData(prev => ({ ...prev, userPicture: '' }));
    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Clear any image errors
    if (errors.userPicture) {
      setErrors(prev => ({ ...prev, userPicture: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage('');

    // Validate form
    const newErrors: Record<string, string> = {};

    if (!isNotEmpty(formData.firstName)) {
      newErrors.firstName = t('errors.firstNameRequired');
    }

    if (!isNotEmpty(formData.lastName)) {
      newErrors.lastName = t('errors.lastNameRequired');
    }

    if (!isValidEmail(formData.email)) {
      newErrors.email = t('errors.emailInvalid');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Get CSRF token once for state-changing API calls
      let csrfToken = '';
      try {
        const csrfRes = await fetch('/api/csrf-token', { method: 'GET', credentials: 'include' });
        if (csrfRes.ok) {
          const csrfData = await csrfRes.json();
          csrfToken = csrfData.csrfToken;
        }
      } catch {
        // If CSRF fetch fails, server will reject state-changing calls (we’ll surface that error)
      }

      // Upsert personal address (source of truth: addresses table)
      // Wrap in try-catch so address errors don't block profile updates (except validation errors)
      try {
        const hasAnyAddressField = !!(
          formData.streetAddress.trim() ||
          formData.city.trim() ||
          formData.state.trim() ||
          formData.zipCode.trim()
        );

        // If address exists but all fields are cleared, delete the address
        if (personalAddressId && !hasAnyAddressField) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          try {
            const deleteRes = await fetch(`/api/addresses/${personalAddressId}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
              },
              credentials: 'include',
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!deleteRes.ok) {
              const err = await deleteRes.json().catch(() => ({}));
              throw new Error(err.error || 'Failed to delete address');
            }

            // Clear the address ID so it won't be reloaded
            setPersonalAddressId(null);
            
            // Update initial form data to reflect deleted address
            setInitialFormData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                streetAddress: '',
                apartment: '',
                city: '',
                state: '',
                zipCode: '',
                gateCode: '',
                addressNote: '',
              };
            });
          } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
              throw new Error('Address delete request timed out. Please try again.');
            }
            throw error;
          }
      } else if (hasAnyAddressField) {
        // Ensure required fields are present and valid
        const streetAddress = formData.streetAddress.trim();
        const city = formData.city.trim();
        const state = formData.state.trim() || 'NV';
        const zipCode = formData.zipCode.trim();

        if (!streetAddress || !city || !zipCode) {
          throw new Error('Street address, city, and ZIP code are required');
        }

        // Validate state is 2 characters
        if (state.length !== 2) {
          throw new Error('State must be a 2-letter code (e.g., NV, CA, TX)');
        }

        // Validate ZIP code format (5 digits or 5+4 format)
        const zipRegex = /^\d{5}(-\d{4})?$/;
        if (!zipRegex.test(zipCode)) {
          throw new Error('ZIP code must be in format 12345 or 12345-6789');
        }

        const addressPayload = {
          addressType: 'personal',
          streetAddress,
          apartment: formData.apartment.trim() || undefined,
          city,
          state: state.toUpperCase(),
          zipCode,
          gateCode: formData.gateCode.trim() || undefined,
          addressNote: formData.addressNote.trim() || undefined,
          isPublic: false,
        };

        const addressUrl = personalAddressId ? `/api/addresses/${personalAddressId}` : '/api/addresses';
        const addressMethod = personalAddressId ? 'PUT' : 'POST';

        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        let addressRes: Response;
        try {
          addressRes = await fetch(addressUrl, {
            method: addressMethod,
            headers: {
              'Content-Type': 'application/json',
              ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
            },
            credentials: 'include',
            body: JSON.stringify(addressPayload),
            signal: controller.signal,
          });
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error('Address save request timed out. Please try again.');
          }
          throw error;
        }

        clearTimeout(timeoutId);

        if (!addressRes.ok) {
          const err = await addressRes.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to save address');
        }

        // If we created a new address, store its id for future updates
        if (!personalAddressId) {
          try {
            const created = await addressRes.json();
            if (created?.address?.id) {
              setPersonalAddressId(created.address.id);
            }
          } catch (error) {
            // Non-fatal - we can continue without the ID
            console.warn('Failed to parse address response:', error);
          }
        }
      }
      } catch (addressError) {
        // Only throw validation errors - they should block the form
        // Network/timeout errors are logged but don't block profile update
        if (addressError instanceof Error) {
          if (addressError.message.includes('required') || 
              addressError.message.includes('must be') ||
              addressError.message.includes('format')) {
            // Validation errors should block the form
            throw addressError;
          }
          // Other errors (network, timeout, etc.) are non-fatal
          console.warn('Address operation failed (non-blocking):', addressError.message);
        } else {
          console.warn('Address operation failed (non-blocking):', addressError);
        }
      }

      const updates = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        // Send phone even if empty - let the API handle empty strings vs undefined
        phone: formData.phone.trim() || undefined,
        referral: formData.referral || undefined,
        referralOther: formData.referralOther.trim() || undefined,
        userPicture: formData.userPicture || undefined,
        // Address fields are now stored in the addresses table, not in profiles
        // Removed: streetAddress, apartment, city, state, zipCode, gateCode, addressNote
        companyName: formData.companyName.trim() || undefined,
        companyRole: formData.companyRole.trim() || undefined,
        companyRoleOther: formData.companyRoleOther.trim() || undefined,
      };
      
      await updateUser(updates);

      setSuccessMessage(t('profileUpdated'));
      
      // Update initial form data after successful save to reset the button
      // Use the same values that were sent to the API
      setInitialFormData({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || '',
        referral: formData.referral || '',
        referralOther: formData.referralOther.trim() || '',
        streetAddress: formData.streetAddress.trim() || '',
        apartment: formData.apartment.trim() || '',
        city: formData.city.trim() || '',
        state: formData.state.trim() || '',
        zipCode: formData.zipCode.trim() || '',
        gateCode: formData.gateCode.trim() || '',
        addressNote: formData.addressNote.trim() || '',
        userPicture: formData.userPicture || '',
        companyName: formData.companyName.trim() || '',
        companyRole: formData.companyRole.trim() || '',
        companyRoleOther: formData.companyRoleOther.trim() || '',
      });

      // Collapse both accordions after successful save
      setIsPersonalInfoOpen(false);
      setIsAddressInfoOpen(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrors({
        submit: error instanceof Error ? error.message : t('errors.submitFailed'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-2 md:p-6 py-2 md:py-4">
      {/* Breadcrumbs */}
      <Breadcrumb 
        items={[
          { label: tAccount('title'), href: '/account-management', icon: Settings },
          { label: t('title'), icon: UserPen }
        ]}
      />
      
      <form onSubmit={handleSubmit} className="space-y-4">
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border-2 border-green-600 text-green-800 rounded-lg p-4">
              {successMessage}
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border-2 border-red-600 text-red-800 rounded-lg p-4">
              {errors.submit}
            </div>
          )}

          {/* Personal Information */}
          <div className="border-2 border-black rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setIsPersonalInfoOpen(!isPersonalInfoOpen)}
              className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
            >
              <h2 className="text-xl font-bold text-black">{t('personalInformation')}</h2>
              {isPersonalInfoOpen ? (
                <ChevronUp className="w-5 h-5 text-black shrink-0 ml-4" />
              ) : (
                <ChevronDown className="w-5 h-5 text-black shrink-0 ml-4" />
              )}
            </button>
            
            {isPersonalInfoOpen && (
              <div className="px-4 pb-4 border-t-2 border-black space-y-4 pt-6">
                {/* Profile Picture Upload */}
                <div className="flex flex-col items-center gap-2">
                  <div className="relative">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 rounded-lg border-2 border-black flex items-center justify-center bg-white cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative aspect-square"
                    >
                      {previewImage ? (
                        <Image
                          src={previewImage}
                          alt="Profile picture"
                          fill
                          className="object-cover"
                          sizes="96px"
                          quality={90}
                          loading="eager"
                        />
                      ) : (
                        <UserIcon className="w-10 h-10 text-black" />
                      )}
                    </div>
                    {previewImage && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 border-2 border-white flex items-center justify-center cursor-pointer hover:bg-red-700 transition-colors shadow-lg"
                        aria-label={t('removeProfilePicture')}
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    )}
                  </div>
                  <span className="text-sm font-medium text-black">{t('uploadProfilePicture')}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  {errors.userPicture && (
                    <p className="mt-1 text-sm text-red-600">{errors.userPicture}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Referral */}
                  <div className="md:col-span-2">
                    <label htmlFor="referral" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('howDidYouHear')}
                    </label>
                    <select
                      id="referral"
                      name="referral"
                      value={formData.referral}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none"
                    >
                      <option value="">{t('selectOption')}</option>
                      <option value="Google">Google</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Referral Other */}
                  {formData.referral === 'Other' && (
                    <div className="md:col-span-2">
                      <FormField label={t('pleaseSpecify')}>
                        <Input
                          type="text"
                          id="referralOther"
                          name="referralOther"
                          value={formData.referralOther}
                          onChange={handleChange}
                          onClear={() => {
                            setFormData(prev => ({ ...prev, referralOther: '' }));
                          }}
                          showClear
                          placeholder={t('placeholders.referralOther')}
                        />
                      </FormField>
                    </div>
                  )}

                  {/* First Name */}
                  <div>
                    <FormField label={t('fields.firstName')} required error={errors.firstName}>
                      <Input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, firstName: '' }));
                          if (errors.firstName) {
                            setErrors(prev => ({ ...prev, firstName: '' }));
                          }
                        }}
                        showClear
                        error={errors.firstName}
                      />
                    </FormField>
                  </div>

                  {/* Last Name */}
                  <div>
                    <FormField label={t('fields.lastName')} required error={errors.lastName}>
                      <Input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, lastName: '' }));
                          if (errors.lastName) {
                            setErrors(prev => ({ ...prev, lastName: '' }));
                          }
                        }}
                        showClear
                        error={errors.lastName}
                      />
                    </FormField>
                  </div>

                  {/* Phone */}
                  <div>
                    <FormField label={t('fields.phone')}>
                      <Input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, phone: '' }));
                        }}
                        showClear
                        placeholder={t('placeholders.phone')}
                      />
                    </FormField>
                  </div>

                  {/* Email */}
                  <div>
                    <FormField label={t('fields.email')} required error={errors.email}>
                      <Input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, email: '' }));
                          if (errors.email) {
                            setErrors(prev => ({ ...prev, email: '' }));
                          }
                        }}
                        showClear
                        error={errors.email}
                      />
                    </FormField>
                  </div>

                  {/* Company Name */}
                  <div className="md:col-span-2">
                    <FormField label={t('fields.companyName')}>
                      <Input
                        type="text"
                        id="companyName"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, companyName: '' }));
                        }}
                        showClear
                        placeholder={t('fields.companyNamePlaceholder')}
                      />
                    </FormField>
                  </div>

                  {/* Company Role */}
                  <div className="md:col-span-2">
                    <FormField label={t('fields.companyRoleLabel')} error={errors.companyRole}>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                          { value: 'Owner', label: 'Owner' },
                          { value: 'Manager', label: 'Manager' },
                          { value: 'Other', label: 'Other' },
                        ].map((role) => {
                          const isSelected = formData.companyRole === role.value;
                          return (
                            <button
                              key={role.value}
                              type="button"
                              onClick={() => {
                                setFormData(prev => {
                                  const newData = { ...prev, companyRole: role.value };
                                  if (role.value !== 'Other') {
                                    newData.companyRoleOther = '';
                                  }
                                  return newData;
                                });
                                if (errors.companyRole) {
                                  setErrors(prev => ({ ...prev, companyRole: '' }));
                                }
                                if (errors.companyRoleOther) {
                                  setErrors(prev => ({ ...prev, companyRoleOther: '' }));
                                }
                              }}
                              disabled={isSubmitting}
                              aria-pressed={isSelected}
                              aria-label={`Select ${role.label} as company role`}
                              className={`
                                flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer
                                ${isSelected
                                  ? 'bg-black text-white border-black'
                                  : 'bg-white text-black border-black hover:bg-gray-50'
                                }
                                ${errors.companyRole ? 'border-red-500' : ''}
                                disabled:opacity-50 disabled:cursor-not-allowed
                              `}
                            >
                              <span className="text-sm font-medium text-center">{role.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {errors.companyRole && (
                        <p className="mt-1 text-sm text-red-600">{errors.companyRole}</p>
                      )}
                    </FormField>
                  </div>

                  {/* Company Role Other */}
                  {formData.companyRole === 'Other' && (
                    <div className="md:col-span-2">
                      <FormField label={t('fields.companyRoleOtherLabel')} required error={errors.companyRoleOther}>
                        <Input
                          type="text"
                          id="companyRoleOther"
                          name="companyRoleOther"
                          value={formData.companyRoleOther}
                          onChange={handleChange}
                          onClear={() => {
                            setFormData(prev => ({ ...prev, companyRoleOther: '' }));
                            if (errors.companyRoleOther) {
                              setErrors(prev => ({ ...prev, companyRoleOther: '' }));
                            }
                          }}
                          showClear
                          required
                          placeholder={t('fields.companyRoleOtherPlaceholder')}
                          error={errors.companyRoleOther}
                        />
                      </FormField>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Address Information */}
          <div className="border-2 border-black rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setIsAddressInfoOpen(!isAddressInfoOpen)}
              className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
            >
              <h2 className="text-xl font-bold text-black">{t('addressInformation')}</h2>
              {isAddressInfoOpen ? (
                <ChevronUp className="w-5 h-5 text-black shrink-0 ml-4" />
              ) : (
                <ChevronDown className="w-5 h-5 text-black shrink-0 ml-4" />
              )}
            </button>
            
            {isAddressInfoOpen && (
              <div className="px-4 pb-4 border-t-2 border-black space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  {/* Street Address */}
                  <div className="md:col-span-2">
                    <FormField label={t('fields.streetAddress')}>
                      <Input
                        type="text"
                        id="streetAddress"
                        name="streetAddress"
                        value={formData.streetAddress}
                        onChange={handleChange}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, streetAddress: '' }));
                        }}
                        showClear
                        placeholder={t('placeholders.streetAddress')}
                      />
                    </FormField>
                  </div>

                  {/* Apartment */}
                  <div className="md:col-span-2">
                    <FormField label={t('fields.apartment')}>
                      <Input
                        type="text"
                        id="apartment"
                        name="apartment"
                        value={formData.apartment}
                        onChange={handleChange}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, apartment: '' }));
                        }}
                        showClear
                        placeholder={t('placeholders.apartment')}
                      />
                    </FormField>
                  </div>

                  {/* City */}
                  <div>
                    <FormField label={t('fields.city')}>
                      <Input
                        type="text"
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleChange}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, city: '' }));
                        }}
                        showClear
                        placeholder={t('placeholders.city')}
                      />
                    </FormField>
                  </div>

                  {/* State */}
                  <div>
                    <FormField label={t('fields.state')}>
                      <Input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, state: '' }));
                        }}
                        showClear
                        placeholder={t('placeholders.state')}
                      />
                    </FormField>
                  </div>

                  {/* ZIP Code */}
                  <div>
                    <FormField label={t('fields.zipCode')}>
                      <Input
                        type="text"
                        id="zipCode"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleChange}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, zipCode: '' }));
                        }}
                        showClear
                        placeholder={t('placeholders.zipCode')}
                      />
                    </FormField>
                  </div>

                  {/* Gate Code */}
                  <div>
                    <FormField label={t('fields.gateCode')}>
                      <Input
                        type="text"
                        id="gateCode"
                        name="gateCode"
                        value={formData.gateCode}
                        onChange={handleChange}
                        onClear={() => {
                          setFormData(prev => ({ ...prev, gateCode: '' }));
                        }}
                        showClear
                        placeholder={t('placeholders.gateCode')}
                      />
                    </FormField>
                  </div>

                  {/* Address Note */}
                  <div className="md:col-span-2">
                    <label htmlFor="addressNote" className="block text-sm font-medium text-gray-700 mb-1">
                      {t('fields.addressNote')}
                    </label>
                    <textarea
                      id="addressNote"
                      name="addressNote"
                      value={formData.addressNote}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none resize-none"
                      placeholder={t('placeholders.addressNote')}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.push(`/${locale}/account-management`)}
              className="flex-1 px-6 py-3 border-2 border-black bg-white text-black rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            {hasChanges ? (
              // Show "Save Changes" button when form is modified
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 border-2 border-black bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t('saving') : t('saveChanges')}
              </button>
            ) : (
              // Show "Go to Manage Account" button when form is unchanged
              <button
                type="button"
                onClick={() => router.push(`/${locale}/account-management`)}
                className="flex-1 px-6 py-3 border-2 border-black bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors cursor-pointer"
              >
                {t('goToManageAccount')}
              </button>
            )}
          </div>
        </form>
    </div>
  );
}

