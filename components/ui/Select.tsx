'use client';

import { SelectHTMLAttributes } from 'react';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  error?: string;
  className?: string;
}

export function Select({ error, className = '', ...props }: SelectProps) {
  const hasError = !!error;
  const borderClass = hasError 
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
    : 'border-black focus:ring-black';

  return (
    <select
      {...props}
      className={`w-full px-2 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all ${borderClass} ${className}`}
    />
  );
}

