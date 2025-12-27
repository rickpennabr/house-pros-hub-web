'use client';

import { useState, useRef, useEffect } from 'react';
import { HiQuestionMarkCircle } from 'react-icons/hi';

interface TipModalProps {
  /** The informational message to display in the tip */
  message: string;
  /** Optional className for the container */
  className?: string;
}

/**
 * TipModal component displays a question mark icon that shows an informational tooltip when clicked.
 * The tooltip appears above the icon and contains helpful information about the form field.
 */
export function TipModal({ message, className = '' }: TipModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Close if click is outside the container (which includes both button and tooltip)
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    // Use a small delay to prevent immediate closing when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const toggleTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={toggleTooltip}
        className="w-4 h-4 bg-red-500 border-2 border-red-500 rounded flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
        aria-label="Show field information"
        aria-expanded={isOpen}
      >
        <HiQuestionMarkCircle className="w-3 h-3 text-white" />
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 w-64 p-3 bg-white border-2 border-red-500 rounded-lg shadow-lg"
          role="tooltip"
        >
          <p className="text-sm text-black">{message}</p>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-3 h-3 bg-white border-r-2 border-b-2 border-red-500 rotate-45"></div>
          </div>
        </div>
      )}
    </div>
  );
}

