'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HiQuestionMarkCircle } from 'react-icons/hi';

interface TipModalProps {
  /** The informational message to display in the tip */
  message: string;
  /** Optional className for the container */
  className?: string;
  /** Also open on hover. A tap still pins the tip open, which is what phones need. */
  hoverOnly?: boolean;
}

/**
 * TipModal shows a question-mark icon with an informational tooltip.
 * Hover opens it on a mouse. A tap pins it open (phones have no hover).
 */
export function TipModal({ message, className = '', hoverOnly = false }: TipModalProps) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isOpen = pinned || (hoverOnly && hovered);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const ignoreHoverRef = useRef(false);

  const closeTip = () => {
    setPinned(false);
    setHovered(false);
  };

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Close if click is outside both the container (button) and the tooltip
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsideTooltip = tooltipRef.current?.contains(target);

      if (!isInsideContainer && !isInsideTooltip) {
        closeTip();
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
        setPinned(false);
        setHovered(false);
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
        const tipWidth = 256;
        const margin = 8;
        const center = rect.left + rect.width / 2;
        const left = Math.min(
          window.innerWidth - tipWidth / 2 - margin,
          Math.max(tipWidth / 2 + margin, center)
        );
        setTooltipPosition({
          top: rect.top - 8,
          left,
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
    e.preventDefault();
    e.stopPropagation();
    // A tap also synthesizes mouseenter. Ignore that so the tip stays on the tap, not hover.
    ignoreHoverRef.current = true;
    window.setTimeout(() => {
      ignoreHoverRef.current = false;
    }, 500);
    setHovered(false);
    setPinned((open) => !open);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      setPinned((open) => !open);
    } else if (e.key === 'Escape' && isOpen) {
      e.stopPropagation();
      closeTip();
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={toggleTooltip}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => {
          if (hoverOnly && !ignoreHoverRef.current) setHovered(true);
        }}
        onMouseLeave={() => {
          if (hoverOnly) setHovered(false);
        }}
        className="relative w-4 h-4 bg-red-500 border-2 border-red-500 rounded flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 before:absolute before:-inset-3 before:content-['']"
        aria-label="Show field information"
        aria-expanded={isOpen}
      >
        <HiQuestionMarkCircle className="w-3 h-3 text-white" />
      </button>

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

