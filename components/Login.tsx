'use client';

import { useState } from 'react';
import { AuthFormLayout } from './auth/AuthFormLayout';
import { AuthTabs } from './auth/AuthTabs';
import { SignInForm } from './auth/SignInForm';
import { SignUpForm } from './auth/SignUpForm';

type TabType = 'signin' | 'signup';

interface LoginProps {
  onLogin?: (email: string, password: string) => void;
  onForgotPassword?: () => void;
  onSignUp?: (email: string, password: string, confirmPassword: string) => void;
}

export default function Login({ onLogin, onForgotPassword, onSignUp }: LoginProps) {
  const [activeTab, setActiveTab] = useState<TabType>('signin');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (onLogin) {
        await onLogin(email, password);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (email: string, password: string, confirmPassword: string) => {
    setIsLoading(true);
    try {
      if (onSignUp) {
        await onSignUp(email, password, confirmPassword);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthFormLayout>
      <AuthTabs activeTab={activeTab} onTabChange={setActiveTab} isLoading={isLoading} />

      {activeTab === 'signin' && (
        <SignInForm
          onLogin={handleLogin}
          onForgotPassword={onForgotPassword}
          isLoading={isLoading}
        />
      )}

      {activeTab === 'signup' && (
        <SignUpForm onSignUp={handleSignUp} isLoading={isLoading} />
      )}
    </AuthFormLayout>
  );
}
