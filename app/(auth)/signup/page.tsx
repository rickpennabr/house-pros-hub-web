'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import Logo from '@/components/Logo';
import CategoryCarousel from '@/components/CategoryCarousel';

type TabType = 'signin' | 'signup';

export default function SignUpPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('signup');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyRole, setCompanyRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [trade, setTrade] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // TODO: Replace with actual login logic
      console.log('Login attempt:', { email, password, rememberMe });
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/businesslist');
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (!agreeToTerms) {
      alert('Please agree to the Terms of Service and Privacy Policy');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // TODO: Replace with actual signup logic
      console.log('Sign up attempt:', { 
        firstName, 
        lastName, 
        companyRole, 
        companyName, 
        trade, 
        email, 
        password 
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/businesslist');
    } catch (error) {
      console.error('Signup error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-1 md:p-8">
      <div className="w-full md:w-[1200px] h-[100vh] md:h-[700px] bg-white rounded-lg overflow-hidden border-2 border-black">
        <div className="relative grid grid-cols-1 md:grid-cols-2 h-full">
          {/* Left Side - Carousel (Slides out to the left when signup is active) */}
          <div className={`hidden md:flex flex-col bg-white px-6 py-12 border-r-2 border-black transition-all duration-500 ease-in-out h-full ${
            activeTab === 'signup' 
              ? 'absolute left-0 transform -translate-x-full opacity-0 pointer-events-none z-0' 
              : 'relative z-10 opacity-100'
          }`}>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-6 text-center">
              Sign up to find your House Pro.
            </h1>
            <div className="flex-1 flex flex-col justify-center">
              <CategoryCarousel direction="right" />
              <CategoryCarousel direction="left" />
              <CategoryCarousel direction="right" />
            </div>
          </div>

          {/* Right Side - Form (Expands to full width when signup is active) */}
          <div className={`flex flex-col bg-white transition-all duration-500 ease-in-out h-full overflow-y-auto ${
            activeTab === 'signup' 
              ? 'md:col-span-2 pt-3 pb-4 px-3 md:pt-6 md:pb-12 md:px-12' 
              : 'p-3 md:p-12'
          }`}>
          <div className="w-full max-w-full mx-auto">
            {/* Logo */}
            <div className={`flex justify-center ${activeTab === 'signup' ? 'mb-4' : 'mb-8'}`}>
              <Logo width={200} height={50} className="h-12 w-auto" />
            </div>

            {/* Tab Navigation */}
            <div className="flex mb-6 border-b-2 border-black">
              <button
                type="button"
                onClick={() => router.push('/signin')}
                disabled={isLoading}
                className={`flex-1 py-3 px-4 font-medium transition-colors cursor-pointer ${
                  activeTab === 'signin'
                    ? 'border-b-4 border-black bg-white'
                    : 'bg-white hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => router.push('/signup')}
                disabled={isLoading}
                className={`flex-1 py-3 px-4 font-medium transition-colors cursor-pointer ${
                  activeTab === 'signup'
                    ? 'border-b-4 border-black bg-white'
                    : 'bg-white hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Sign Up
              </button>
            </div>

            {/* Title */}
            {activeTab === 'signin' && (
              <>
                <h2 className="text-3xl font-semibold text-center mb-2">
                  Welcome back
                </h2>
                <p className="text-center text-gray-600 mb-8">
                  Sign in to your account
                </p>
              </>
            )}

            {/* Sign In Form */}
            {activeTab === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-6">
            {/* Email Input */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium mb-2"
              >
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
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

            {/* Password Input */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
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

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 border-2 border-black rounded focus:ring-2 focus:ring-black"
                  disabled={isLoading}
                />
                <span className="ml-2 text-sm">Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-sm text-gray-600 hover:text-black underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 border-2 border-black rounded-lg bg-white font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
              </form>
            )}

            {/* Sign Up Form */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignUp} className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {/* First Section: First Name, Last Name, Company Role */}
                <div className="w-full space-y-6 border-r-0 md:border-r-2 border-black pr-0 md:pr-6">
                  <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
                  <div className="space-y-4">
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
                      htmlFor="companyRole" 
                      className="block text-sm font-medium mb-2"
                    >
                      Company Role
                    </label>
                    <div className="relative">
                      <select
                        id="companyRole"
                        value={companyRole}
                        onChange={(e) => setCompanyRole(e.target.value)}
                        required
                        className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all appearance-none"
                        disabled={isLoading}
                      >
                        <option value="">Select a role</option>
                        <option value="Owner">Owner</option>
                        <option value="Admin">Admin</option>
                        <option value="Manager">Manager</option>
                        <option value="Employee">Employee</option>
                        <option value="Customer Service">Customer Service</option>
                      </select>
                      {companyRole && (
                        <button
                          type="button"
                          onClick={() => setCompanyRole('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer pointer-events-auto z-10"
                          disabled={isLoading}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  </div>
                </div>

            {/* Second Section: Company Name, Trade */}
            <div className="w-full space-y-6 border-r-0 md:border-r-2 border-black pr-0 md:pr-6">
              <h3 className="text-lg font-semibold mb-4">Company Information</h3>
              <div className="space-y-4">
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
                    htmlFor="trade" 
                    className="block text-sm font-medium mb-2"
                  >
                    Trade
                  </label>
                  <div className="relative">
                    <select
                      id="trade"
                      value={trade}
                      onChange={(e) => setTrade(e.target.value)}
                      required
                      className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all appearance-none"
                      disabled={isLoading}
                    >
                      <option value="">Select a trade</option>
                      <option value="Landscape">Landscape</option>
                      <option value="Pavers">Pavers</option>
                      <option value="Tile">Tile</option>
                      <option value="Roofing">Roofing</option>
                      <option value="Plumbing">Plumbing</option>
                      <option value="Electrical">Electrical</option>
                      <option value="HVAC">HVAC</option>
                      <option value="Painting">Painting</option>
                      <option value="Flooring">Flooring</option>
                      <option value="Windows">Windows</option>
                      <option value="Doors">Doors</option>
                      <option value="Fencing">Fencing</option>
                      <option value="Decking">Decking</option>
                    </select>
                    {trade && (
                      <button
                        type="button"
                        onClick={() => setTrade('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer pointer-events-auto z-10"
                        disabled={isLoading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label 
                    htmlFor="phoneNumber" 
                    className="block text-sm font-medium mb-2"
                  >
                    Phone Number
                  </label>
                  <div className="relative">
                    <input
                      id="phoneNumber"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                      className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                      placeholder="Phone number"
                      disabled={isLoading}
                    />
                    {phoneNumber && (
                      <button
                        type="button"
                        onClick={() => setPhoneNumber('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                        disabled={isLoading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
                </div>

                {/* Third Section: Email, Password, Confirm Password */}
                <div className="w-full space-y-6 md:col-span-1">
                  <h3 className="text-lg font-semibold mb-4">Account Details</h3>
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

                  {/* Password and Confirm Password in same row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Password Input */}
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

                    {/* Confirm Password Input */}
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
                          placeholder="confirm"
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

                  {/* Terms Agreement */}
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

                  {/* Submit Button */}
                  <div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 border-2 border-black rounded-lg bg-white font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Creating account...' : 'Sign Up'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

