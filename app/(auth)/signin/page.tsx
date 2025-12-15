'use client';

import { useState } from 'react';
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

export default function SignInPage() {
  const { login } = useAuth();
  const { redirectAfterAuth } = useAuthRedirect();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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
          <FormField label="Email" required>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onClear={() => setEmail('')}
              showClear
              required
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </FormField>

          <PasswordInput
            id="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="password"
            disabled={isLoading}
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
