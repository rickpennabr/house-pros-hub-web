'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
  /** When true, button is disabled. Not passed to DOM (invalid on <button>). */
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  loading,
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 'font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed rounded-lg';

  const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-black text-white hover:bg-gray-800 active:bg-gray-900 border-2 border-black',
    secondary: 'bg-white border-2 border-black hover:bg-gray-50 active:bg-gray-100',
    outline: 'bg-transparent border-2 border-black hover:bg-gray-50',
    ghost: 'bg-transparent border-2 border-transparent hover:bg-gray-100',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-3',
    lg: 'px-6 py-4 text-lg',
  };

  return (
    <button
      {...props}
      disabled={disabled ?? loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
}

