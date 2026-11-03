'use client';

import { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TipModal } from './TipModal';

/**
 * Single accordion panel. For a group of accordions where only one should be open at a time,
 * use the useSingleOpenAccordion hook from @/hooks/useSingleOpenAccordion.
 */
interface AccordionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  /** When true, hide error state (red border) when closed. When showCompleteStyle is also true, header gets black bg. */
  isComplete?: boolean;
  /** When false, isComplete only suppresses error styling; header stays white (no black "complete" style). Default true. */
  showCompleteStyle?: boolean;
  error?: string;
  required?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  hasErrors?: boolean;
  missingInfoMessage?: string;
  tip?: string;
}

export default function Accordion({
  title,
  isOpen,
  onToggle,
  isComplete = false,
  showCompleteStyle = true,
  error,
  required = false,
  icon,
  children,
  className = '',
  missingInfoMessage,
  tip,
}: AccordionProps) {
  // Determine if we should show error styling (red border and message)
  // Show when accordion is collapsed, required, and incomplete (has errors or missing info)
  const showErrorState = !isOpen && required && !isComplete;
  const useCompleteStyle = showCompleteStyle && isComplete;
  const showRequiredMark = required && !isComplete && !error;

  return (
    <div className={`border-2 rounded-lg bg-white overflow-hidden ${
      showErrorState ? 'border-red-600' : 'border-black'
    } ${className}`}>
      <div
        className={`relative w-full transition-colors ${
          isOpen ? 'rounded-t-lg' : 'rounded-lg'
        } ${useCompleteStyle ? 'bg-black' : 'bg-white'}`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="absolute inset-0 z-0 cursor-pointer"
        >
          <span className="sr-only">{isOpen ? `Collapse ${title}` : `Expand ${title}`}</span>
        </button>
        <div className="relative z-10 flex items-center justify-between p-2 md:p-4 pointer-events-none">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {icon && (
              <div className={useCompleteStyle ? 'text-white' : 'text-red-600'}>
                {icon}
              </div>
            )}
            <div className="flex items-center gap-x-2 gap-y-1 flex-1 min-w-0 flex-wrap">
              <h2 className={`text-base md:text-lg font-bold overflow-hidden text-ellipsis whitespace-nowrap md:whitespace-normal md:overflow-visible ${useCompleteStyle ? 'text-white' : 'text-black'}`}>
                {title}
                {showRequiredMark && <span className="text-red-500 ml-1">*</span>}
              </h2>
              {showRequiredMark && tip && (
                <span className="pointer-events-auto shrink-0">
                  <TipModal message={tip} hoverOnly />
                </span>
              )}
              {showErrorState && missingInfoMessage && (
                <span className="ml-2 font-normal text-sm text-red-600 whitespace-nowrap flex-shrink-0">
                  {missingInfoMessage}
                </span>
              )}
              {error && (
                <span className={`ml-2 font-normal text-xs ${useCompleteStyle ? 'text-white' : 'text-red-600'}`}>
                  {error}
                </span>
              )}
            </div>
          </div>
          {isOpen ? (
            <ChevronUp className={`w-5 h-5 shrink-0 ml-4 ${useCompleteStyle ? 'text-white' : 'text-black'}`} />
          ) : (
            <ChevronDown className={`w-5 h-5 shrink-0 ml-4 ${useCompleteStyle ? 'text-white' : (showErrorState ? 'text-red-600' : 'text-black')}`} />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="px-2 md:px-4 pb-2 md:pb-4 border-t-2 border-black space-y-4 pt-2 md:pt-4 rounded-b-lg">
          {children}
        </div>
      )}
    </div>
  );
}

