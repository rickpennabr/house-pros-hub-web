'use client';

import { useRef, useState, useEffect, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface SplitButtonItem {
  label: string;
  onClick: () => void;
}

interface SplitButtonProps {
  /** Primary action label (e.g. "Save and close") */
  primaryLabel: string;
  /** Called when the main button or primary dropdown item is used */
  onPrimaryClick: () => void;
  /** Extra options in the dropdown (primary action can be first or omitted if same as button) */
  dropdownItems: SplitButtonItem[];
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * Split button: main action + dropdown for related actions (e.g. Save and close | Save and new).
 * Matches QuickBooks-style invoice footer UX.
 */
export function SplitButton({
  primaryLabel,
  onPrimaryClick,
  dropdownItems,
  variant = 'primary',
  size = 'sm',
  disabled = false,
  loading = false,
  className = '',
}: SplitButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative inline-flex rounded-lg ${className}`}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled || loading}
        onClick={() => {
          onPrimaryClick();
          setOpen(false);
        }}
        className="rounded-r-none border-r border-gray-300"
      >
        {loading ? 'Saving…' : primaryLabel}
      </Button>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        disabled={disabled || loading}
        onClick={() => setOpen((v) => !v)}
        className={`
          inline-flex items-center justify-center rounded-r-lg border-2 border-black
          px-2 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
          ${variant === 'primary' ? 'bg-black text-white hover:bg-gray-800' : 'bg-white hover:bg-gray-50'}
        `}
      >
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && dropdownItems.length > 0 && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[180px] py-1 bg-white border border-gray-200 rounded-lg shadow-lg"
          role="menu"
        >
          {dropdownItems.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-100"
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
