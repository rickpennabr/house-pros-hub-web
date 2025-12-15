'use client';

import { InputHTMLAttributes } from 'react';
import { ClearButton } from './ClearButton';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  showClear?: boolean;
  onClear?: () => void;
  className?: string;
}

export function Input({ showClear, onClear, value, disabled, className = '', ...props }: InputProps) {
  return (
    <div className="relative">
      <input
        {...props}
        value={value}
        disabled={disabled}
        className={`w-full px-3 py-2.5 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all ${className}`}
      />
      {showClear && value && onClear && (
        <ClearButton onClick={onClear} disabled={disabled} />
      )}
    </div>
  );
}

