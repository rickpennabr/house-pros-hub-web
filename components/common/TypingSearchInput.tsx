'use client';

import { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';

interface TypingSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel: string;
}

/** Search field whose empty placeholder types itself out, the same way other placeholders do. */
export function TypingSearchInput({ value, onChange, placeholder, clearLabel }: TypingSearchInputProps) {
  const placeholders = useMemo(() => [placeholder], [placeholder]);
  const [animated = ''] = useTypingPlaceholder({
    placeholders,
    typingSpeed: 70,
    startDelay: 300,
  });

  return (
    <div className="relative min-w-0 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-red-500" size={20} />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={value ? placeholder : animated || placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-lg border-2 border-black bg-white pl-10 pr-8 text-base text-black placeholder:text-gray-500 focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-gray-600 hover:text-black"
          aria-label={clearLabel}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
