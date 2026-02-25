'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HiQuestionMarkCircle } from 'react-icons/hi';

interface TipModalProps {
  /** The informational message to display in the tip */
  message: string;
  /** Optional className for the container */
  className?: string;
  /** When true, tooltip shows on hover only, hides when not hovered, and icon is not clickable (e.g. for PC) */
  hoverOnly?: boolean;
}

/**
 * TipModal component displays a question mark icon that shows an informational tooltip when clicked.
 * With hoverOnly, tooltip shows on hover only and the icon is not clickable.
 */
export function TipModal({ message, className = '', hoverOnly = false }: TipModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Close if click is outside both the container (button) and the tooltip
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsideTooltip = tooltipRef.current?.contains(target);
      
      if (!isInsideContainer && !isInsideTooltip) {
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

  // Calculate tooltip position when opening and update on scroll/resize
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPosition({
          top: rect.top - 8, // Position above the icon with 8px margin
          left: rect.left + rect.width / 2, // Center horizontally
        });
      }
    };

    // Initial position
    updatePosition();

    // Update on scroll and resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const toggleTooltip = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape' && isOpen) {
      e.stopPropagation();
      setIsOpen(false);
    }
  };

  // Hover-only: show tooltip on hover, hide when not hovered, icon not clickable
  if (hoverOnly) {
    return (
      <div className={`group relative inline-flex items-center ${className}`}>
        <div
          className="w-4 h-4 bg-red-500 border-2 border-red-500 rounded flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors pointer-events-auto"
          aria-label="Field information (hover to view)"
        >
          <HiQuestionMarkCircle className="w-3 h-3 text-white" />
        </div>
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-white border-2 border-red-500 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none z-[9999]"
          role="tooltip"
        >
          <p className="text-sm text-black">{message}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="w-3 h-3 bg-white border-r-2 border-b-2 border-red-500 rotate-45" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={containerRef}>
      <div
        role="button"
        tabIndex={0}
        onClick={toggleTooltip}
        onKeyDown={handleKeyDown}
        className="w-4 h-4 bg-red-500 border-2 border-red-500 rounded flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
        aria-label="Show field information"
        aria-expanded={isOpen}
      >
        <HiQuestionMarkCircle className="w-3 h-3 text-white" />
      </div>

      {isOpen &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-[9999] w-64 p-3 bg-white border-2 border-red-500 rounded-lg shadow-lg"
            style={{
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
              transform: 'translate(-50%, -100%)',
              marginBottom: '8px',
            }}
            role="tooltip"
          >
            <p className="text-sm text-black">{message}</p>
            {/* Arrow pointing down */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
              <div className="w-3 h-3 bg-white border-r-2 border-b-2 border-red-500 rotate-45"></div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

