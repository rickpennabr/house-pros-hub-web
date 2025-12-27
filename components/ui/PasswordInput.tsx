'use client';

import { useState, InputHTMLAttributes } from 'react';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  label?: string;
  showToggle?: boolean;
  error?: string;
  className?: string;
}

export function PasswordInput({ label, showToggle = true, error, className = '', ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const hasError = !!error;
  const borderClass = hasError 
    ? 'border-red-500 focus:border-red-500' 
    : 'border-black';

  return (
    <div>
      {label && (
        <label htmlFor={props.id} className={`block text-sm font-medium mb-2 ${hasError ? 'text-red-600' : ''}`}>
          {error || label}
          {props.required && !error && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          {...props}
          type={showPassword ? 'text' : 'password'}
          className={`w-full px-3 py-2.5 pr-10 border-2 rounded-lg bg-white focus:outline-none transition-all ${borderClass} ${className}`}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
            disabled={props.disabled}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m0 0l-2.4 2.4M21 21l-2.4-2.4M21 21l-3.228-3.228M21 21l-3.228-3.228"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

