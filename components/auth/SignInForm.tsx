'use client';

import { useState, FormEvent } from 'react';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';

interface SignInFormProps {
  onLogin?: (email: string, password: string) => void;
  onForgotPassword?: () => void;
  isLoading?: boolean;
}

export function SignInForm({ onLogin, onForgotPassword, isLoading = false }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (onLogin) {
      await onLogin(email, password);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <FormField label="Password" required>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Enter your password"
          disabled={isLoading}
        />
      </FormField>

      {onForgotPassword && (
        <div className="text-right">
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm text-gray-600 hover:text-black underline transition-colors cursor-pointer"
            disabled={isLoading}
          >
            Forgot password?
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 border-2 border-black rounded-lg bg-white font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}

