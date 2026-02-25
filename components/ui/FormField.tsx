'use client';

import { ReactNode } from 'react';
import { TipModal } from './TipModal';

interface FormFieldProps {
  label: string | ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  /** Optional tip message to display in the info icon tooltip */
  tip?: string;
}

export function FormField({ label, error, required, children, className = '', tip }: FormFieldProps) {
  // When there's an error, replace the label with the error message styled as a warning
  const displayLabel = error || label;
  const isError = !!error;

  return (
    <div className={className}>
      <label className={`flex items-center gap-2 text-sm font-medium mb-2 text-gray-900 dark:text-gray-100 ${isError ? 'text-red-600 dark:text-red-400' : ''}`}>
        <span>{displayLabel}</span>
        {required && !error && <span className="text-red-500">*</span>}
        {tip && !error && <TipModal message={tip} hoverOnly />}
      </label>
      {children}
    </div>
  );
}

