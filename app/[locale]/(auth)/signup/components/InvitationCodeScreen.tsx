'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';

interface InvitationCodeScreenProps {
  onValidCode: (code: string) => void;
  onBack: () => void;
}

export function InvitationCodeScreen({ onValidCode, onBack }: InvitationCodeScreenProps) {
  const t = useTranslations('auth.signup.fields');
  const tNav = useTranslations('auth.signup.navigation');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleNext = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Invitation code is required.');
      return;
    }
    setError(null);
    setIsValidating(true);
    try {
      const res = await fetch('/api/auth/validate-invitation-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.valid) {
        onValidCode(trimmed);
      } else {
        setError(data.error ?? 'Invalid or expired invitation code.');
      }
    } catch {
      setError('Unable to validate invitation code. Please try again.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col text-black md:pt-12 animate-fade-in">
      <h2 className="text-2xl font-semibold text-center mb-2">
        {t('invitationCodeLabel')}
      </h2>
      <p className="text-sm text-gray-600 text-center mb-6">
        {t('invitationCodeDescription')}
      </p>

      <FormField
        label={t('invitationCodeLabel')}
        required
        error={error ?? undefined}
      >
        <Input
          id="invitation-code"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.trim().toUpperCase());
            setError(null);
          }}
          onClear={() => {
            setCode('');
            setError(null);
          }}
          showClear
          placeholder={t('invitationCodePlaceholder')}
          disabled={isValidating}
          error={error ?? undefined}
          autoComplete="off"
        />
      </FormField>

      <ErrorMessage message={error ?? ''} />

      <div className="flex gap-4 pt-6 mt-auto">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={isValidating}
          className="flex-1"
        >
          {tNav('previous')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleNext}
          disabled={isValidating}
          className="flex-1"
        >
          {isValidating ? tNav('submitting') : tNav('next')}
        </Button>
      </div>
    </div>
  );
}
