'use client';

import { SelectHTMLAttributes } from 'react';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  error?: string;
  className?: string;
}

export function Select({ error, className = '', ...props }: SelectProps) {
  const hasError = !!error;
  const borderClass = hasError 
    ? 'border-red-500 focus:border-red-500' 
    : 'border-black';

  return (
    <select
      {...props}
      className={`w-full px-2 py-3 border-2 rounded-lg bg-white dark:bg-[#1a1a1a] text-black dark:text-gray-100 focus:outline-none transition-all dark:border-gray-600 ${borderClass} ${className}`}
    />
  );
}

