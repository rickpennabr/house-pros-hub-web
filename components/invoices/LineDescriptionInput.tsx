'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/Input';

/** Saved descriptions per item name, shared by every line on the page. */
const cache = new Map<string, Promise<string[]>>();

function keyOf(item: string) {
  return item.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function loadLineDescriptions(item: string, refresh = false): Promise<string[]> {
  const key = keyOf(item);
  if (!key) return Promise.resolve([]);
  if (!refresh && cache.has(key)) return cache.get(key)!;
  const request = fetch(`/api/crm/line-descriptions?item=${encodeURIComponent(item.trim())}`, { credentials: 'include' })
    .then((res) => (res.ok ? res.json() : { descriptions: [] }))
    .then((body: { descriptions?: Array<{ description: string }> }) => (body.descriptions ?? []).map((row) => row.description))
    .catch(() => [] as string[]);
  cache.set(key, request);
  // Shared by the lines open together, then fetched fresh so descriptions saved since show up.
  setTimeout(() => cache.delete(key), 15_000);
  return request;
}

/** Forget the cached list after a save so new descriptions show up. */
export function forgetLineDescriptions() {
  cache.clear();
}

/**
 * Description on an invoice or estimate line. Suggests the descriptions saved for the line's
 * product or service, matching what is typed; anything new is saved when the document is saved.
 */
export function LineDescriptionInput({
  itemName,
  value,
  onChange,
  placeholder = 'Description',
  className = '',
}: {
  itemName: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [saved, setSaved] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadLineDescriptions(itemName).then((list) => {
      if (!cancelled) setSaved(list);
    });
    return () => {
      cancelled = true;
    };
  }, [itemName]);

  const query = value.trim().toLowerCase();
  const matches = saved
    .filter((text) => text.toLowerCase() !== query && (query === '' || text.toLowerCase().includes(query)))
    .sort((a, b) => Number(!a.toLowerCase().startsWith(query)) - Number(!b.toLowerCase().startsWith(query)))
    .slice(0, 12);
  const showList = open && matches.length > 0 && position;

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 260) });
    };
    place();
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const choose = (text: string) => {
    onChange(text);
    setOpen(false);
    setHighlight(-1);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        placeholder={saved.length > 0 && !value ? `${placeholder} (${saved.length} saved)` : placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!open || matches.length === 0) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlight((index) => (index + 1) % matches.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlight((index) => (index <= 0 ? matches.length - 1 : index - 1));
          } else if (event.key === 'Enter' && highlight >= 0) {
            event.preventDefault();
            choose(matches[highlight]);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        autoComplete="off"
        className={className}
      />
      {showList && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={listRef}
              role="listbox"
              className="fixed z-[200] max-h-60 overflow-y-auto rounded-lg border-2 border-black bg-white py-1 shadow-lg"
              style={{ top: position.top, left: position.left, width: position.width }}
            >
              <p className="px-3 pb-1 pt-0.5 text-xs font-semibold uppercase text-gray-500">Saved for {itemName.trim()}</p>
              {matches.map((text, index) => (
                <button
                  key={text}
                  type="button"
                  role="option"
                  aria-selected={highlight === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => choose(text)}
                  className={`w-full px-3 py-2 text-left text-sm ${highlight === index ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  {text}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
