'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  showHeader?: boolean;
  showCloseButton?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  onOverlayClick?: () => void;
  preventCloseOnOverlayClick?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  children,
  title,
  showHeader = false,
  showCloseButton = true,
  maxWidth = 'md',
  className = '',
  onOverlayClick,
  preventCloseOnOverlayClick = false,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        event.stopPropagation();
        event.preventDefault();
        if (!preventCloseOnOverlayClick) {
          if (onOverlayClick) {
            onOverlayClick();
          } else {
            onClose();
          }
        }
      }
    };

    if (isOpen) {
      // Use a small delay to prevent immediate propagation
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, onOverlayClick, preventCloseOnOverlayClick]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'md:max-w-sm',
    md: 'md:max-w-md',
    lg: 'md:max-w-lg',
    xl: 'md:max-w-xl',
    full: 'md:max-w-full',
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation();
      e.preventDefault();
      if (!preventCloseOnOverlayClick) {
        if (onOverlayClick) {
          onOverlayClick();
        } else {
          onClose();
        }
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center md:p-4 bg-black/50"
      onClick={handleOverlayClick}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div 
        ref={modalRef} 
        className={`bg-white md:rounded-lg border-2 border-black w-full h-full md:w-full md:h-auto ${maxWidthClasses[maxWidth]} md:max-h-[90vh] overflow-y-auto flex flex-col ${className}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(showHeader || title) && (
          <div className="flex items-center justify-between p-4 border-b-2 border-black">
            {title && (
              <h2 className="text-xl font-bold text-black">{title}</h2>
            )}
            {showCloseButton && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onClose();
                }}
                className="w-8 h-8 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-black" />
              </button>
            )}
          </div>
        )}
        
        {/* Content */}
        {children}
      </div>
    </div>
  );
}

