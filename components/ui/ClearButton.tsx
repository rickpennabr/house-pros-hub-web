'use client';

import { X } from 'lucide-react';

interface ClearButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function ClearButton({ onClick, disabled, className = '' }: ClearButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-gray-100 transition-colors cursor-pointer ${className}`}
      disabled={disabled}
    >
      <X className="w-4 h-4" />
    </button>
  );
}

