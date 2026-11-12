'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react';
import { Search, X } from 'lucide-react';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';

interface CRMSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onFocus?: () => void;
  onSubmit?: (event: FormEvent) => void;
  /** Black close button, phone only, while search owns the screen. */
  showClose?: boolean;
  onClose?: () => void;
  className?: string;
  formRef?: Ref<HTMLFormElement>;
  /** Sits to the right of the field, such as a mobile filter button. */
  endAction?: ReactNode;
}

/**
 * CRM search field matching the pros search: red icon, black border,
 * clear control, and the same character-by-character placeholder.
 */
export function CRMSearchField({
  value,
  onChange,
  placeholder,
  onFocus,
  onSubmit,
  showClose = false,
  onClose,
  className = '',
  formRef,
  endAction,
}: CRMSearchFieldProps) {
  const wasEmptyRef = useRef(!value);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    const empty = !value;
    if (empty && !wasEmptyRef.current) setAnimationKey((key) => key + 1);
    wasEmptyRef.current = empty;
  }, [value]);

  const placeholders = useMemo(() => [placeholder], [placeholder, animationKey]);
  const animated = useTypingPlaceholder({
    placeholders,
    typingSpeed: 100,
    delayBetweenFields: 0,
    startDelay: 500,
  });
  const shownPlaceholder = value ? placeholder : (animated[0] || '');

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (onSubmit) onSubmit(event);
        else event.preventDefault();
      }}
      className={`flex items-center gap-2 ${className}`}
    >
      <div className="relative h-11 min-w-0 flex-1">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          placeholder={shownPlaceholder}
          aria-label={placeholder}
          suppressHydrationWarning
          className="h-full w-full pl-8 md:pl-10 pr-10 border-2 border-black rounded-lg bg-white focus:outline-none text-black placeholder-gray-500 text-base"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none" size={20} />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>
      {endAction}
      {showClose ? (
        <button
          type="button"
          onClick={onClose}
          className="h-11 w-11 shrink-0 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 md:hidden"
          aria-label="Close search"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      ) : null}
    </form>
  );
}
