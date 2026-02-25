'use client';

import { InputHTMLAttributes } from 'react';
import { ClearButton } from './ClearButton';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  showClear?: boolean;
  onClear?: () => void;
  error?: string;
  className?: string;
}

export function Input({ showClear, onClear, value, disabled, error, className = '', ...props }: InputProps) {
  const hasError = !!error;
  const borderClass = hasError 
    ? 'border-red-500 focus:border-red-500' 
    : 'border-black';

  return (
    <div className="relative">
      <input
        {...props}
        value={value}
        disabled={disabled}
        className={`w-full px-3 py-2.5 pr-8 border-2 rounded-lg bg-white dark:bg-[#1a1a1a] text-black dark:text-gray-100 focus:outline-none transition-all placeholder:dark:placeholder-gray-400 ${borderClass} dark:border-gray-600 ${className}`}
      />
      {showClear && value && onClear && (
        <ClearButton onClick={onClear} disabled={disabled} />
      )}
    </div>
  );
}

