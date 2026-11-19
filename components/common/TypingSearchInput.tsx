'use client';

import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { Search, X } from 'lucide-react';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';

interface TypingSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel: string;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
  inputClassName?: string;
  iconClassName?: string;
}

const DEFAULT_INPUT_CLASS =
  'h-10 w-full rounded-lg border-2 border-black bg-white pl-10 pr-8 text-base text-black placeholder:text-gray-500 focus:outline-none';
const DEFAULT_ICON_CLASS =
  'pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-red-500';

/** Search field whose empty placeholder types itself out, the same way other placeholders do. */
export function TypingSearchInput({
  value,
  onChange,
  placeholder,
  clearLabel,
  onFocus,
  onBlur,
  disabled = false,
  inputRef,
  className = 'relative min-w-0 flex-1',
  inputClassName = DEFAULT_INPUT_CLASS,
  iconClassName = DEFAULT_ICON_CLASS,
}: TypingSearchInputProps) {
  const wasEmptyRef = useRef(!value);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    const empty = !value;
    if (empty && !wasEmptyRef.current) setAnimationKey((key) => key + 1);
    wasEmptyRef.current = empty;
  }, [value]);

  const placeholders = useMemo(() => [placeholder], [placeholder, animationKey]);
  const [animated = ''] = useTypingPlaceholder({
    placeholders,
    typingSpeed: 100,
    delayBetweenFields: 0,
    startDelay: 500,
  });

  return (
    <div className={className}>
      <Search className={iconClassName} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={value ? placeholder : animated || placeholder}
        aria-label={placeholder}
        suppressHydrationWarning
        className={inputClassName}
      />
      {value ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
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
