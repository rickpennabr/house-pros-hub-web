'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { FormField } from '@/components/ui/FormField';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { AuthNavigationButtons } from '@/components/auth/AuthNavigationButtons';
import { isValidEmail, isNotEmpty } from '@/lib/validation';

function SignInForm() {
  const { login } = useAuth();
  const { redirectAfterAuth } = useAuthRedirect();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validateField = (field: 'email' | 'password', value: string): string | undefined => {
    if (field === 'email') {
      if (!isNotEmpty(value)) {
        return 'Email is required';
      }
      if (!isValidEmail(value)) {
        return 'Please enter a valid email address';
      }
    } else if (field === 'password') {
      if (!isNotEmpty(value)) {
        return 'Password is required';
      }
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    
    const emailError = validateField('email', email);
    if (emailError) errors.email = emailError;
    
    const passwordError = validateField('password', password);
    if (passwordError) errors.password = passwordError;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    // Clear error when user starts typing
    if (fieldErrors.email) {
      setFieldErrors(prev => ({ ...prev, email: undefined }));
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    // Clear error when user starts typing
    if (fieldErrors.password) {
      setFieldErrors(prev => ({ ...prev, password: undefined }));
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate form before submitting
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      redirectAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthPageLayout>
      <div className="w-full max-w-md mx-auto flex flex-col">
        {/* Header with Logo and Navigation */}
        <div className="md:sticky md:top-0 md:z-20 md:bg-white">
          <div className="flex flex-col mb-2 gap-4">
            <div className="flex items-center justify-center">
              <Link href="/" className="cursor-pointer flex-shrink-0">
                <Logo width={300} height={75} className="h-16 md:h-20 w-auto" />
              </Link>
            </div>
            <AuthNavigationButtons isLoading={isLoading} />
          </div>
        </div>

        {/* Title */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <h2 className="text-3xl font-semibold text-center animate-fade-in">Welcome back</h2>
          <span 
            className="text-3xl animate-wave" 
            style={{ 
              display: 'inline-block', 
              transformOrigin: '70% 70%',
              fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, Android Emoji, EmojiSymbols, EmojiOne Mozilla, Twemoji Mozilla, Segoe UI Symbol, sans-serif'
            }}
            role="img"
            aria-label="Waving hand"
          >
            👋
          </span>
        </div>
        <p className="text-center text-gray-600 mb-8 md:mb-6">Sign in to your account</p>

        <ErrorMessage message={error || ''} />

        {/* Sign In Form */}
        <form onSubmit={handleSignIn} className="space-y-6">
          <FormField label="Email" required error={fieldErrors.email}>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onClear={() => {
                setEmail('');
                setFieldErrors(prev => ({ ...prev, email: undefined }));
              }}
              showClear
              required
              placeholder="Enter your email"
              disabled={isLoading}
              error={fieldErrors.email}
            />
          </FormField>

          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            required
            placeholder="password"
            disabled={isLoading}
            error={fieldErrors.password}
          />

          {/* Forgot Password */}
          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-gray-600 hover:text-black underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit Button */}
          <Button type="submit" variant="primary" disabled={isLoading} className="w-full">
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </AuthPageLayout>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-gray-600">Loading...</p>
        </div>
      </AuthPageLayout>
    }>
      <SignInForm />
    </Suspense>
  );
}
