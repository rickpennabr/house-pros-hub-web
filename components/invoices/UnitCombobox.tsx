'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { UNIT_OPTIONS, DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import type { UnitOption } from '@/lib/constants/unitOptions';

function getLabelForValue(value: string): string {
  const opt = UNIT_OPTIONS.find((o) => o.value === value);
  return opt ? opt.label : value;
}

interface UnitComboboxProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function UnitCombobox({
  value,
  onChange,
  className = '',
  placeholder = 'Unit',
}: UnitComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const generalOptions = UNIT_OPTIONS.filter(
    (o) => o.group === 'general' && (q === '' || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
  );
  const constructionOptions = UNIT_OPTIONS.filter(
    (o) => o.group === 'construction' && (q === '' || o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
  );
  const flatFiltered = [...generalOptions, ...constructionOptions];
  const totalOptions = flatFiltered.length;

  useEffect(() => {
    if (!open) {
      setHighlightIndex(-1);
      return;
    }
    setHighlightIndex(flatFiltered.length > 0 ? 0 : -1);
  }, [open, flatFiltered.length]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(getLabelForValue(value) || value);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery(getLabelForValue(value) || value);
        return;
      }
      if (!open) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : prev));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : 0));
        return;
      }
      if (e.key === 'Enter' && highlightIndex >= 0 && flatFiltered[highlightIndex]) {
        e.preventDefault();
        const opt = flatFiltered[highlightIndex];
        onChange(opt.value);
        setQuery(opt.label);
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, highlightIndex, totalOptions, value, flatFiltered, onChange]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-option-index="${highlightIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  const handleFocus = () => {
    setOpen(true);
    setQuery(getLabelForValue(value) || value);
  };

  const handleBlur = () => {
    setOpen(false);
    setQuery(getLabelForValue(value) || value);
  };

  const handleSelect = (opt: UnitOption) => {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
  };

  const displayValue = open ? query : (getLabelForValue(value) || value || DEFAULT_UNIT);

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="text"
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={handleFocus}
        onClick={handleFocus}
        onBlur={handleBlur}
        className={`text-sm py-1.5 border-gray-300 min-w-[80px] w-28 ${className}`}
        autoComplete="off"
      />
      {open && (
        <div
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-0.5 border border-gray-300 rounded-lg bg-white shadow-lg max-h-56 overflow-y-auto py-1"
          role="listbox"
        >
          {generalOptions.length > 0 && (
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 sticky top-0">
              General
            </div>
          )}
          {generalOptions.map((opt, i) => {
            const flatIndex = i;
            return (
              <button
                key={opt.value}
                type="button"
                data-option-index={flatIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlightIndex(flatIndex)}
                className={`w-full flex items-center px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                  highlightIndex === flatIndex ? 'bg-gray-100' : ''
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          {constructionOptions.length > 0 && (
            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 sticky top-0 mt-1">
              Construction
            </div>
          )}
          {constructionOptions.map((opt, i) => {
            const flatIndex = generalOptions.length + i;
            return (
              <button
                key={opt.value}
                type="button"
                data-option-index={flatIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlightIndex(flatIndex)}
                className={`w-full flex items-center px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                  highlightIndex === flatIndex ? 'bg-gray-100' : ''
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          {flatFiltered.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">No matching units</div>
          )}
        </div>
      )}
    </div>
  );
}
