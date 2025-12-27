'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ExpandableSearchbarProps {
  onSearchChange?: (query: string) => void;
  onSearchToggle?: (isOpen: boolean) => void;
  placeholder?: string;
  placeholderKey?: 'categories' | 'businesses' | 'suppliers' | 'address';
  shiftRight?: boolean; // Shift search button to the left to make room for filter button
}

export default function ExpandableSearchbar({ 
  onSearchChange,
  onSearchToggle,
  placeholder,
  placeholderKey = 'categories',
  shiftRight = false
}: ExpandableSearchbarProps) {
  const t = useTranslations('common.search');
  const displayPlaceholder = placeholder || t(placeholderKey);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLetterS, setShowLetterS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Set mounted flag after hydration to prevent hydration mismatches
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsMounted(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  // Check if mobile on mount and resize (only after mount to prevent hydration issues)
  useEffect(() => {
    if (!isMounted) return;

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isMounted]);

  // Animation: Alternate between icon and "S" every 3 seconds (desktop only)
  useEffect(() => {
    if (!isMounted) return;
    
    if (isMobile) {
      const timeoutId = window.setTimeout(() => {
        setShowLetterS(false); // Always show icon on mobile
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    const interval = setInterval(() => {
      setShowLetterS(prev => !prev);
    }, 3000);

    return () => clearInterval(interval);
  }, [isMobile, isMounted]);

  // Handle keyboard shortcuts (S to open, ESC to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // S key to open search
      if (e.key === 'S' || e.key === 's') {
        if (!isSearchOpen) {
          setIsSearchOpen(true);
          if (onSearchToggle) {
            onSearchToggle(true);
          }
        }
      }

      // ESC key to close search
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        setSearchQuery('');
        if (onSearchToggle) {
          onSearchToggle(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen, onSearchToggle]);

  // Focus input when search opens (after DOM updates)
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      // For mobile: Use setTimeout to ensure DOM has updated, then focus
      // This is critical for mobile browsers to trigger the keyboard
      if (isMobile) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      } else {
        // Desktop: Use requestAnimationFrame approach
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            searchInputRef.current?.focus();
          });
        });
      }
    }
  }, [isSearchOpen, isMobile]);

  // Handle click outside to close search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isSearchOpen &&
        searchBarRef.current &&
        !searchBarRef.current.contains(event.target as Node) &&
        searchButtonRef.current &&
        !searchButtonRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
        setSearchQuery('');
        if (onSearchToggle) {
          onSearchToggle(false);
        }
      }
    };

    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSearchOpen, onSearchToggle]);

  // Notify parent of search changes with debouncing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(searchQuery);
      }
    }, 300); // 300ms debounce delay

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, onSearchChange]);

  const handleSearchToggle = () => {
    const newState = !isSearchOpen;
    setIsSearchOpen(newState);
    if (onSearchToggle) {
      onSearchToggle(newState);
    }
    if (!newState) {
      // Clear debounce timer when closing search
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      setSearchQuery('');
      // Immediately notify parent that search is cleared
      if (onSearchChange) {
        onSearchChange('');
      }
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    // Clear debounce timer and immediately notify parent
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (onSearchChange) {
      onSearchChange('');
    }
    searchInputRef.current?.focus();
  };

  return (
    <>
      {/* Floating Search Button */}
      <button
        ref={searchButtonRef}
        onClick={handleSearchToggle}
        className={`absolute ${shiftRight ? 'right-[calc(0.25rem+2.5rem+0.5rem)] md:right-[calc(0.5rem+2.5rem+0.5rem)]' : 'right-1 md:right-2'} h-10 w-10 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all z-20 md:top-[calc(50%-0.25rem)] md:-translate-y-1/2 mr-1 md:mr-0 ${
          isSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-label="Search (Press S)"
      >
        <div className="relative w-5 h-5 flex items-center justify-center">
          <Search 
            className={`w-5 h-5 text-white absolute transition-opacity duration-300 ${
              isMounted && showLetterS ? 'opacity-0' : 'opacity-100'
            }`}
            suppressHydrationWarning
          />
          {/* Always render the span to maintain consistent DOM structure - prevents hydration mismatch */}
          <span 
            className={`text-white font-bold text-lg absolute transition-opacity duration-300 ${
              isMounted && showLetterS ? 'opacity-100' : 'opacity-0'
            }`}
            suppressHydrationWarning
          >
            S
          </span>
        </div>
      </button>

      {/* Search Bar - Expands when open */}
      <div
        ref={searchBarRef}
        className={`absolute left-0 right-0 top-0 bottom-0 flex items-center transition-all duration-300 z-30 ${
          isSearchOpen 
            ? 'opacity-100 pointer-events-auto' 
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-full px-2 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={displayPlaceholder}
              className="w-full h-10 pl-10 pr-10 border-2 border-black rounded-lg bg-white focus:outline-none transition-all text-black placeholder-gray-500"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-500 pointer-events-none" size={20} />
            {searchQuery && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={handleSearchToggle}
            className="h-10 w-10 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors"
            aria-label="Close search"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </>
  );
}

