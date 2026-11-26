'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface PickerOption {
  value: string;
  label: string;
  /** Second line: address, email, amount… Also searched. */
  detail?: string | null;
}

interface PickerSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  /** Shown in the box when nothing is picked. */
  placeholder?: string;
  /** Adds a first row that clears the pick ("No project", "None"). Its value is ''. */
  noneLabel?: string;
  disabled?: boolean;
  /** Kept for callers; the box itself is the search field now. */
  searchPlaceholder?: string;
  /** Picks an option right away on change (e.g. to scroll to the next step). */
  className?: string;
  'aria-label'?: string;
}

const SEARCH_FROM = 7;

/**
 * The standard picker for people, places and things (customers, suppliers, properties, projects,
 * vehicles, crew, tools). Looks like a dropdown; opens the Hub's own list under it, with a search
 * bar when the list is long and a second line per row. Stays inside the screen, long text wraps.
 * Short fixed choices (unit, status, days) keep the plain Select. Rule: .cursor/rules/component-styling/pickers.md
 */
export function PickerSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  noneLabel,
  disabled = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  searchPlaceholder: _searchPlaceholder,
  className = '',
  'aria-label': ariaLabel,
}: PickerSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const searchable = options.length >= SEARCH_FROM;
  const rows = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const all = noneLabel ? [{ value: '', label: noneLabel, detail: null }, ...options] : options;
    if (!words.length) return all;
    return all.filter((row) => {
      const text = `${row.label} ${row.detail ?? ''}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [options, noneLabel, query]);

  const current = options.find((row) => row.value === value) ?? null;
  const shown = current ? current.label : value === '' && noneLabel ? noneLabel : placeholder;

  const toggle = () => {
    if (disabled) return;
    setQuery('');
    setOpen((was) => {
      return !was;
    });
  };

  const pick = (next: string) => {
    setOpen(false);
    setQuery('');
    searchRef.current?.blur();
    if (next !== value) onChange(next);
  };

  return (
    <div ref={boxRef} className={`relative w-full ${className}`}>
      {searchable ? (
        // Long list: the box itself is the search field (red search icon, type to filter).
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-red-500" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            name="hub-picker"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={ariaLabel ?? placeholder}
            disabled={disabled}
            value={open ? query : current ? current.label : value === '' && noneLabel ? noneLabel : ''}
            placeholder={placeholder}
            onFocus={() => {
              setQuery('');
              setOpen(true);
            }}
            onClick={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            className="min-h-12 w-full rounded-lg border-2 border-black bg-white py-2 pl-10 pr-9 text-base text-black placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400"
          />
          <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </div>
      ) : (
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        className="flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border-2 border-black bg-white px-2 py-2 text-left text-black transition-all disabled:cursor-not-allowed disabled:border-gray-300 disabled:text-gray-400 md:px-3"
      >
        <span className={`min-w-0 truncate ${current || (value === '' && noneLabel) ? '' : 'text-gray-500'}`}>{shown}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      )}
      {open ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border-2 border-black bg-white shadow-lg">
          <ul id={listId} role="listbox" className="max-h-72 overflow-y-auto">
            {rows.length === 0 ? (
              <li className="p-3 text-sm text-gray-500">No match for “{query.trim()}”.</li>
            ) : (
              rows.map((row) => {
                const selected = row.value === value;
                return (
                  <li key={row.value || '__none'}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => pick(row.value)}
                      className={`flex w-full items-start gap-2 border-b border-gray-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-gray-50 ${selected ? 'bg-gray-100' : ''}`}
                    >
                      <span className="min-w-0 flex-1 break-words">
                        <span className={`block ${row.value ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{row.label}</span>
                        {row.detail ? <span className="block text-xs text-gray-600">{row.detail}</span> : null}
                      </span>
                      {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
