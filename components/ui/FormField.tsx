'use client';

import { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, error, required, children, className = '' }: FormFieldProps) {
  // When there's an error, replace the label with the error message styled as a warning
  const displayLabel = error || label;
  const isError = !!error;

  return (
    <div className={className}>
      <label className={`block text-sm font-medium mb-2 ${isError ? 'text-red-600' : ''}`}>
        {displayLabel}
        {required && !error && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

