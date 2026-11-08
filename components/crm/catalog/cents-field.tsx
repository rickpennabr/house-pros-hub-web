'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';

interface CentsFieldProps {
  label: string;
  cents: number;
  onChange: (cents: number) => void;
}

export function CentsField({ label, cents, onChange }: CentsFieldProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');
  const shown = focused ? raw : cents ? (cents / 100).toFixed(2) : '';

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      <Input
        type="text"
        inputMode="decimal"
        value={shown}
        placeholder="0.00"
        className="w-full"
        onFocus={() => {
          setFocused(true);
          setRaw(cents ? (cents / 100).toFixed(2) : '');
        }}
        onChange={(event) => {
          const next = event.target.value;
          setRaw(next);
          const parsed = Number.parseFloat(next || '0');
          if (!Number.isNaN(parsed)) onChange(Math.max(0, Math.round(parsed * 100)));
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = Number.parseFloat(raw.trim() || '0');
          if (!Number.isNaN(parsed)) onChange(Math.max(0, Math.round(parsed * 100)));
        }}
      />
    </label>
  );
}
