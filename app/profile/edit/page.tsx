'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isValidEmail, isNotEmpty } from '@/lib/validation';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function EditProfilePage() {
  const { user, isAuthenticated, isLoading, updateUser } = useAuth();
  const router = useRouter();
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
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isPersonalInfoOpen, setIsPersonalInfoOpen] = useState(true);
  const [isAddressInfoOpen, setIsAddressInfoOpen] = useState(true);
  const [isCompanyInfoOpen, setIsCompanyInfoOpen] = useState(true);

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/signin?returnUrl=/profile/edit');
    }
  }, [isAuthenticated, isLoading, router]);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      console.log('Loading user data into form:', user);
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        referral: user.referral || '',
        referralOther: user.referralOther || '',
        streetAddress: user.streetAddress || '',
        apartment: user.apartment || '',
        city: user.city || '',
        state: user.state || '',
        zipCode: user.zipCode || '',
        gateCode: user.gateCode || '',
        addressNote: user.addressNote || '',
        companyName: user.companyName || '',
        companyRole: user.companyRole || '',
      });
    }
  }, [user]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated || !user) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage('');

    // Validate form
    const newErrors: Record<string, string> = {};

    if (!isNotEmpty(formData.firstName)) {
      newErrors.firstName = 'First name is required';
    }

    if (!isNotEmpty(formData.lastName)) {
      newErrors.lastName = 'Last name is required';
    }

    if (!isValidEmail(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const updates = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        referral: formData.referral || undefined,
        referralOther: formData.referralOther.trim() || undefined,
        streetAddress: formData.streetAddress.trim() || undefined,
        apartment: formData.apartment.trim() || undefined,
        city: formData.city.trim() || undefined,
        state: formData.state.trim() || undefined,
        zipCode: formData.zipCode.trim() || undefined,
        gateCode: formData.gateCode.trim() || undefined,
        addressNote: formData.addressNote.trim() || undefined,
        companyName: formData.companyName.trim() || undefined,
        companyRole: formData.companyRole.trim() || undefined,
      };
      
      console.log('Submitting profile updates:', updates);
      
      await updateUser(updates);

      setSuccessMessage('Profile updated successfully!');
      
      // Redirect to profile page after a short delay
      setTimeout(() => {
        router.push('/profile');
      }, 1500);
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Failed to update profile',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-6 py-6 md:py-8">
      <div className="md:bg-white md:rounded-lg md:border-2 md:border-black p-0 md:p-6 md:p-8">
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
              <h2 className="text-xl font-bold text-black">Personal Information</h2>
              {isPersonalInfoOpen ? (
                <ChevronUp className="w-5 h-5 text-black shrink-0 ml-4" />
              ) : (
                <ChevronDown className="w-5 h-5 text-black shrink-0 ml-4" />
              )}
            </button>
            
            {isPersonalInfoOpen && (
              <div className="px-4 pb-4 border-t-2 border-black space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  {/* Referral */}
                  <div className="md:col-span-2">
                    <label htmlFor="referral" className="block text-sm font-medium text-gray-700 mb-1">
                      How did you hear about us?
                    </label>
                    <select
                      id="referral"
                      name="referral"
                      value={formData.referral}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    >
                      <option value="">Select an option</option>
                      <option value="Google">Google</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {/* Referral Other */}
                  {formData.referral === 'Other' && (
                    <div className="md:col-span-2">
                      <label htmlFor="referralOther" className="block text-sm font-medium text-gray-700 mb-1">
                        Please specify
                      </label>
                      <input
                        type="text"
                        id="referralOther"
                        name="referralOther"
                        value={formData.referralOther}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="How did you hear about us?"
                      />
                    </div>
                  )}

                  {/* First Name */}
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                        errors.firstName ? 'border-red-600' : 'border-black'
                      }`}
                    />
                    {errors.firstName && (
                      <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                        errors.lastName ? 'border-red-600' : 'border-black'
                      }`}
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="Enter your phone number"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-black ${
                        errors.email ? 'border-red-600' : 'border-black'
                      }`}
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                    )}
                  </div>
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
              <h2 className="text-xl font-bold text-black">Address Information</h2>
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
                    <label htmlFor="streetAddress" className="block text-sm font-medium text-gray-700 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="streetAddress"
                      name="streetAddress"
                      value={formData.streetAddress}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="Street address"
                    />
                  </div>

                  {/* Apartment */}
                  <div className="md:col-span-2">
                    <label htmlFor="apartment" className="block text-sm font-medium text-gray-700 mb-1">
                      Apartment, Suite, Unit
                    </label>
                    <input
                      type="text"
                      id="apartment"
                      name="apartment"
                      value={formData.apartment}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="Apt, Suite, Unit, etc."
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="City"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      id="state"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="State"
                    />
                  </div>

                  {/* ZIP Code */}
                  <div>
                    <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-1">
                      ZIP Code
                    </label>
                    <input
                      type="text"
                      id="zipCode"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="ZIP Code"
                    />
                  </div>

                  {/* Gate Code */}
                  <div>
                    <label htmlFor="gateCode" className="block text-sm font-medium text-gray-700 mb-1">
                      Gate Code
                    </label>
                    <input
                      type="text"
                      id="gateCode"
                      name="gateCode"
                      value={formData.gateCode}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      placeholder="Gate code"
                    />
                  </div>

                  {/* Address Note */}
                  <div className="md:col-span-2">
                    <label htmlFor="addressNote" className="block text-sm font-medium text-gray-700 mb-1">
                      Address Note
                    </label>
                    <textarea
                      id="addressNote"
                      name="addressNote"
                      value={formData.addressNote}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black resize-none"
                      placeholder="Additional address notes or instructions"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Company Information */}
          <div className="border-2 border-black rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setIsCompanyInfoOpen(!isCompanyInfoOpen)}
              className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
            >
              <h2 className="text-xl font-bold text-black">Company Information (Optional)</h2>
              {isCompanyInfoOpen ? (
                <ChevronUp className="w-5 h-5 text-black shrink-0 ml-4" />
              ) : (
                <ChevronDown className="w-5 h-5 text-black shrink-0 ml-4" />
              )}
            </button>
            
            {isCompanyInfoOpen && (
              <div className="px-4 pb-4 border-t-2 border-black space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                  {/* Company Name */}
                  <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  {/* Company Role */}
                  <div>
                    <label htmlFor="companyRole" className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      id="companyRole"
                      name="companyRole"
                      value={formData.companyRole}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
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
              onClick={() => router.push('/profile')}
              className="flex-1 px-6 py-3 border-2 border-black bg-white text-black rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border-2 border-black bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

