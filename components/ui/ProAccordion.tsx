'use client';

import { ReactNode, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Lightweight collapsible section with an icon + heading row (the "Project Address" style).
 * Meant for grouping fields inside a card or inside a full Accordion panel.
 * Works uncontrolled (defaultOpen) or controlled (isOpen + onToggle).
 */
interface ProAccordionProps {
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
  /** Draws a divider line above the section. */
  divider?: boolean;
  className?: string;
  contentClassName?: string;
}

export default function ProAccordion({
  title,
  icon,
  children,
  defaultOpen = true,
  isOpen,
  onToggle,
  divider = false,
  className = '',
  contentClassName = 'space-y-4',
}: ProAccordionProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = isOpen ?? internalOpen;
  const contentId = useId();

  const toggle = () => {
    const next = !open;
    if (isOpen === undefined) setInternalOpen(next);
    onToggle?.(next);
  };

  return (
    <div className={`${divider ? 'pt-2 border-t-2 border-gray-200' : ''} ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex w-full items-center gap-2 py-1 text-left cursor-pointer"
      >
        {icon ? <span className="shrink-0 text-red-600">{icon}</span> : null}
        <h3 className="flex-1 min-w-0 text-lg font-semibold text-black">{title}</h3>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-black transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <div id={contentId} hidden={!open} className={`mt-3 ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}
