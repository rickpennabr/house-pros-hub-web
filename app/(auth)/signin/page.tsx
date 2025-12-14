'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import Logo from '@/components/Logo';
import CategoryCarousel from '@/components/CategoryCarousel';
import { useAuth } from '@/contexts/AuthContext';
import { getReturnUrl, getRedirectPath } from '@/lib/redirect';


export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const returnUrl = getReturnUrl(searchParams);
      const redirectPath = getRedirectPath(returnUrl);
      router.push(redirectPath);
    }
  }, [isAuthenticated, searchParams, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    
    try {
      await login(email, password);
      
      // Redirect after successful login
      const returnUrl = getReturnUrl(searchParams);
      const redirectPath = getRedirectPath(returnUrl);
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-2 md:p-8">
      <div className="w-full md:w-[90%] h-[calc(100vh-1rem)] md:max-h-[90vh] bg-white rounded-lg overflow-hidden border-2 border-black flex flex-col">
        <div className="relative grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0 overflow-hidden">
          {/* Left Side - Carousel */}
          <div className="hidden md:flex flex-col bg-white px-6 py-12 border-r-2 border-black h-full relative z-10">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-6 text-center">
              Signin or Sign up to find your House Pro.
            </h1>
            <div className="flex-1 flex flex-col justify-center">
              <CategoryCarousel direction="right" />
              <CategoryCarousel direction="left" />
              <CategoryCarousel direction="right" />
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="flex flex-col bg-white transition-all duration-500 ease-in-out flex-1 min-h-0 overflow-y-auto pt-2 md:pt-6 px-3 md:px-12 pb-3 md:pb-12">
          <div className="w-full max-w-md mx-auto flex flex-col">
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
                className="px-3 md:px-3 py-2 md:py-1.5 text-sm md:text-sm font-medium transition-colors cursor-pointer bg-black text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => router.push('/signup')}
                disabled={isLoading}
                className="px-3 md:px-3 py-2 md:py-1.5 text-sm md:text-sm font-medium transition-colors cursor-pointer bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sign Up
              </button>
              </div>
            </div>

            {/* Title */}
            <>
              <h2 className="text-3xl font-semibold text-center mb-2">
                Welcome back
              </h2>
              <p className="text-center text-gray-600 mb-8">
                Sign in to your account
              </p>
            </>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Sign In Form */}
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
              className="w-full py-3 px-4 border-2 border-black rounded-lg bg-black text-white font-medium hover:bg-gray-800 active:bg-gray-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
            </form>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

