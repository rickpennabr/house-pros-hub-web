'use client';

import { useState, FormEvent } from 'react';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';

interface SignUpFormProps {
  onSignUp?: (email: string, password: string, confirmPassword: string) => void;
  isLoading?: boolean;
}

export function SignUpForm({ onSignUp, isLoading = false }: SignUpFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (onSignUp) {
      await onSignUp(email, password, confirmPassword);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Email" required>
        <Input
          id="signup-email"
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
          id="signup-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="Create a password"
          disabled={isLoading}
        />
      </FormField>

      <FormField label="Confirm Password" required>
        <PasswordInput
          id="confirm-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          placeholder="Confirm your password"
          disabled={isLoading}
        />
      </FormField>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 border-2 border-black rounded-lg bg-white font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Creating account...' : 'Sign Up'}
      </button>
    </form>
  );
}

