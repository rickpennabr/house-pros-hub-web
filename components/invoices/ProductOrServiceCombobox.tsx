'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import type { ProCrmItem } from '@/components/invoices/AddProductServicePanel';

interface ProductOrServiceComboboxProps {
  value: string;
  onChange: (value: string) => void;
  items: ProCrmItem[];
  onSelectItem: (item: ProCrmItem) => void;
  onAddNew: () => void;
  className?: string;
  placeholder?: string;
  allowFreeText?: boolean;
}

export function ProductOrServiceCombobox({
  value,
  onChange,
  items,
  onSelectItem,
  onAddNew,
  className = '',
  placeholder = 'Product or service',
  allowFreeText = true,
}: ProductOrServiceComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const query = value.trim().toLowerCase();
  const filtered =
    query === ''
      ? items
      : items.filter(
          (i) =>
            i.name.toLowerCase().includes(query) ||
            (i.description ?? '').toLowerCase().includes(query)
        );
  const addNewIndex = 0;
  const itemStartIndex = 1;
  const totalOptions = 1 + filtered.length;

  useEffect(() => {
    if (!open) {
      setHighlightIndex(-1);
      return;
    }
    setHighlightIndex(-1);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const updateMenuPosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nextPosition = { top: rect.bottom + 2, left: rect.left, width: rect.width };
      setMenuPosition((prev) => {
        if (
          prev &&
          Math.abs(prev.top - nextPosition.top) < 0.5 &&
          Math.abs(prev.left - nextPosition.left) < 0.5 &&
          Math.abs(prev.width - nextPosition.width) < 0.5
        ) {
          return prev;
        }
        return nextPosition;
      });
    };

    updateMenuPosition();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((prev) => (prev < totalOptions - 1 ? prev + 1 : prev));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((prev) => (prev > -1 ? prev - 1 : prev));
        return;
      }
      if (e.key === 'Enter' && highlightIndex >= 0) {
        e.preventDefault();
        if (highlightIndex === addNewIndex) {
          onAddNew();
          setOpen(false);
        } else {
          const idx = highlightIndex - itemStartIndex;
          if (idx >= 0 && filtered[idx]) {
            onSelectItem(filtered[idx]);
            setOpen(false);
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, highlightIndex, totalOptions, filtered, onAddNew, onSelectItem]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-option-index="${highlightIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, open]);

  const handleFocus = () => setOpen(true);
  const handleAddNew = () => {
    onAddNew();
    setOpen(false);
  };
  const handleSelect = (item: ProCrmItem) => {
    onSelectItem(item);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          if (allowFreeText) onChange(e.target.value);
        }}
        onFocus={handleFocus}
        onClick={handleFocus}
        className={`text-sm py-1.5 border-gray-300 min-w-[140px] ${className}`}
        autoComplete="off"
        readOnly={!allowFreeText}
      />
      {open && menuPosition && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={listRef}
            className="fixed z-[200] border border-gray-300 rounded-lg bg-white shadow-lg max-h-56 overflow-y-auto py-1"
            style={{ top: menuPosition.top, left: menuPosition.left, width: menuPosition.width }}
            role="listbox"
          >
            <button
              type="button"
              data-option-index={addNewIndex}
              onClick={handleAddNew}
              onMouseEnter={() => setHighlightIndex(addNewIndex)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                highlightIndex === addNewIndex ? 'bg-gray-100' : ''
              }`}
            >
              <Plus className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-medium text-blue-600 whitespace-nowrap">Add new</span>
            </button>
            {filtered.map((item, i) => (
              <button
                key={item.id}
                type="button"
                data-option-index={itemStartIndex + i}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setHighlightIndex(itemStartIndex + i)}
                className={`w-full flex flex-col items-start px-3 py-2 text-left text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                  highlightIndex === itemStartIndex + i ? 'bg-gray-100' : ''
                }`}
              >
                <span className="font-medium text-gray-900">{item.name}</span>
                {item.description && (
                  <span className="text-xs text-gray-500 mt-0.5">{item.description}</span>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
