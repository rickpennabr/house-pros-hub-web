'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface ExpandableSearchbarProps {
  onSearchChange?: (query: string) => void;
  onSearchToggle?: (isOpen: boolean) => void;
  placeholder?: string;
}

export default function ExpandableSearchbar({ 
  onSearchChange,
  onSearchToggle,
  placeholder = 'Search categories...'
}: ExpandableSearchbarProps) {
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
    setIsMounted(true);
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
      setShowLetterS(false); // Always show icon on mobile
      return;
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

    if (isSearchOpen) {
      // Focus input when search opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen, onSearchToggle]);

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
        className={`absolute right-2 md:right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all z-20 ${
          isSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-label="Search (Press S)"
      >
        <div className="relative w-5 h-5 flex items-center justify-center">
          <Search 
            className={`w-5 h-5 text-white absolute transition-opacity duration-300 ${
              isMounted && showLetterS ? 'opacity-0' : 'opacity-100'
            }`} 
          />
          {isMounted && (
            <span 
              className={`text-white font-bold text-lg absolute transition-opacity duration-300 ${
                showLetterS ? 'opacity-100' : 'opacity-0'
              }`}
            >
              S
            </span>
          )}
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
              placeholder={placeholder}
              className="w-full h-10 px-4 pr-10 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all text-black placeholder-gray-500"
            />
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
            className="h-10 w-10 rounded-lg bg-white border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
            aria-label="Close search"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>
      </div>
    </>
  );
}

