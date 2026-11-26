'use client';

import { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  error?: string;
  className?: string;
}

export function Select({ error, className = '', disabled, ...props }: SelectProps) {
  const hasError = !!error;
  const borderClass = hasError
    ? 'border-red-500 focus:border-red-500'
    : 'border-black';

  return (
    <div className="relative w-full shrink-0">
      <select
        {...props}
        disabled={disabled}
        className={`w-full h-12 min-h-12 shrink-0 appearance-none bg-none py-0 pl-2 pr-8 md:pl-3 md:pr-10 leading-[44px] border-2 rounded-lg bg-white text-black focus:outline-none transition-all ${borderClass} ${className}`}
      />
      <ChevronDown
        aria-hidden
        className={`pointer-events-none absolute right-2 md:right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${disabled ? 'text-gray-400' : 'text-black'}`}
      />
    </div>
  );
}

