'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/Input';

export interface RememberedOption {
  value: string;
  label: string;
  group?: string;
  termId?: string;
  mode?: 'flat' | 'unit' | 'range';
}

interface RememberedComboboxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: RememberedOption[];
  placeholder?: string;
  onCreate?: (label: string) => Promise<void>;
  onRemove?: (option: RememberedOption) => Promise<void>;
  onPick?: (option: RememberedOption) => void;
}

export function RememberedCombobox({
  label,
  value,
  onChange,
  options,
  placeholder,
  onCreate,
  onRemove,
  onPick,
}: RememberedComboboxProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLLabelElement | null>(null);
  const query = value.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return options;
    return options.filter(
      (option) => option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query)
    );
  }, [options, query]);
  const exact = options.some(
    (option) => option.value.toLowerCase() === query || option.label.toLowerCase() === query
  );
  const groups = filtered.reduce<string[]>((names, option) => {
    const group = option.group || 'Options';
    if (!names.includes(group)) names.push(group);
    return names;
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (option: RememberedOption) => {
    onChange(option.value);
    onPick?.(option);
    setOpen(false);
  };

  return (
    <label className="relative block" ref={containerRef}>
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <Input
        value={value}
        placeholder={placeholder}
        className="w-full"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
      />
      {open ? (
        <div className="absolute z-[120] mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? <p className="px-3 py-2 text-sm text-gray-500">No matches yet.</p> : null}
          {groups.map((group) => (
            <div key={group}>
              <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{group}</p>
              {filtered
                .filter((option) => (option.group || 'Options') === group)
                .map((option) => (
                  <div key={`${group}-${option.value}`} className="flex items-center hover:bg-gray-100">
                    <button type="button" className="min-w-0 flex-1 px-3 py-2 text-left text-sm" onClick={() => choose(option)}>
                      {option.label}
                    </button>
                    {option.termId && onRemove ? (
                      <button
                        type="button"
                        className="px-2 text-gray-500 hover:text-red-600"
                        aria-label={`Remove ${option.label} from the list`}
                        onClick={() => void onRemove(option)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
            </div>
          ))}
          {onCreate && value.trim() && !exact ? (
            <button
              type="button"
              disabled={busy}
              className="w-full px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-gray-100"
              onClick={() => {
                setBusy(true);
                void onCreate(value.trim()).finally(() => setBusy(false));
              }}
            >
              {busy ? 'Saving…' : `Add "${value.trim()}" to the list`}
            </button>
          ) : null}
        </div>
      ) : null}
    </label>
  );
}
