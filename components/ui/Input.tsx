'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { ClearButton } from './ClearButton';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  showClear?: boolean;
  onClear?: () => void;
  error?: string;
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { showClear, onClear, value, disabled, error, className = '', ...props },
  ref
) {
  const hasError = !!error;
  const borderClass = hasError
    ? 'border-red-500 focus:border-red-500'
    : 'border-black';

  return (
    <div className="relative">
      <input
        ref={ref}
        {...props}
        value={value}
        disabled={disabled}
        className={`w-full p-2 ${showClear ? 'pr-8' : ''} border-2 rounded-lg bg-white text-black placeholder:text-gray-500 focus:outline-none transition-all ${borderClass} ${className}`}
      />
      {showClear && value && onClear && (
        <ClearButton onClick={onClear} disabled={disabled} />
      )}
    </div>
  );
});

