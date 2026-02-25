'use client';

import { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TipModal } from './TipModal';

interface AccordionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  isComplete?: boolean;
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
  
  return (
    <div className={`border-2 rounded-lg bg-white overflow-hidden ${
      showErrorState ? 'border-red-600' : 'border-black'
    } ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-2 md:p-4 text-left cursor-pointer transition-colors ${
          isOpen ? 'rounded-t-lg' : 'rounded-lg'
        } ${isComplete ? 'bg-black' : 'bg-white'}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && (
            <div className={isComplete ? 'text-white' : (showErrorState ? 'text-red-600' : 'text-red-600')}>
              {icon}
            </div>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h2 className={`text-base md:text-lg font-bold overflow-hidden text-ellipsis whitespace-nowrap md:whitespace-normal md:overflow-visible ${isComplete ? 'text-white' : 'text-black'}`}>
              {title}
              {required && !isComplete && !error && (
                <>
                  <span className="text-red-500 ml-1">*</span>
                  {tip && <span className="ml-1"><TipModal message={tip} hoverOnly /></span>}
                </>
              )}
            </h2>
            {showErrorState && missingInfoMessage && (
              <span className="ml-2 font-normal text-sm text-red-600 whitespace-nowrap flex-shrink-0">
                {missingInfoMessage}
              </span>
            )}
            {error && (
              <span className={`ml-2 font-normal text-xs ${isComplete ? 'text-white' : 'text-red-600'}`}>
                {error}
              </span>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className={`w-5 h-5 shrink-0 ml-4 ${isComplete ? 'text-white' : 'text-black'}`} />
        ) : (
          <ChevronDown className={`w-5 h-5 shrink-0 ml-4 ${isComplete ? 'text-white' : (showErrorState ? 'text-red-600' : 'text-black')}`} />
        )}
      </button>

      {isOpen && (
        <div className="px-2 md:px-4 pb-2 md:pb-4 border-t-2 border-black space-y-4 pt-2 md:pt-4 rounded-b-lg">
          {children}
        </div>
      )}
    </div>
  );
}

