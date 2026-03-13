'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAddressSearch } from './AddressAutocomplete/hooks/useAddressSearch';
import { formatAddress, parseAddressData, parseFreeformAddress, GooglePlacesResult } from './AddressAutocomplete/utils/addressParser';

export interface AddressData {
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  apartment?: string;
  fullAddress: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (addressData: AddressData) => void;
  /** Called when user presses Enter and no suggestion list is open (e.g. to go to next step after picking an address). */
  onConfirmWithEnter?: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  onConfirmWithEnter,
  placeholder = 'Enter your Nevada address',
  disabled = false,
  required = false,
  id = 'address',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  /** Position for portal-rendered dropdown so it's not clipped by overflow (e.g. mobile chat scroll). */
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const { suggestions, isLoading, searchError, searchAddresses, clearSuggestions, getPlaceDetails } = useAddressSearch();

  const canUseTypedAddress = value.trim().length >= 3 && !isLoading && suggestions.length === 0 && !!onAddressSelect;
  const showUseThisAddress = showSuggestions && canUseTypedAddress;

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    searchAddresses(newValue);
    
    if (newValue.length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      clearSuggestions();
    }
  };

  // Keyboard navigation
  const highlightedButtonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        onConfirmWithEnter?.();
        e.preventDefault();
      }
      return;
    }
    if (showUseThisAddress && e.key === 'Enter') {
      e.preventDefault();
      handleUseTypedAddress();
      return;
    }
    if (suggestions.length === 0) {
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          e.preventDefault();
          handleSelectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Scroll highlighted suggestion into view when navigating with keyboard
  useEffect(() => {
    if (highlightedIndex >= 0) {
      highlightedButtonRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  // Handle suggestion selection
  const handleSelectSuggestion = async (suggestion: GooglePlacesResult) => {
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    
    // Fetch full place details to get address components
    let fullPlaceDetails: GooglePlacesResult | null = null;
    if (suggestion.place_id && getPlaceDetails) {
      fullPlaceDetails = await getPlaceDetails(suggestion.place_id);
    }
    
    // Use full details if available, otherwise use the suggestion
    const resultToParse = fullPlaceDetails || suggestion;
    const addressData = parseAddressData(resultToParse);
    
    onChange(addressData.streetAddress);

    if (onAddressSelect) {
      onAddressSelect(addressData);
    }

    clearSuggestions();

    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleUseTypedAddress = () => {
    const trimmed = value.trim();
    if (!trimmed || !onAddressSelect) return;
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    clearSuggestions();
    const addressData = parseFreeformAddress(trimmed);
    onChange(addressData.streetAddress);
    onAddressSelect(addressData);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  // Auto-scroll so the suggestions list is visible when it opens
  useEffect(() => {
    if (!showSuggestions || (suggestions.length === 0 && !showUseThisAddress)) return;
    const timer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        suggestionsRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      });
    });
    return () => cancelAnimationFrame(timer);
  }, [showSuggestions, suggestions.length]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickInsideInput = inputRef.current?.contains(target);
      const isClickInsideSuggestions = suggestionsRef.current?.contains(target);

      if (!isClickInsideInput && !isClickInsideSuggestions) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const showDropdown = (showSuggestions && suggestions.length > 0) || showUseThisAddress;

  // Position dropdown for portal: measure input so dropdown isn't clipped by parent overflow (e.g. mobile chat)
  useLayoutEffect(() => {
    if (!showDropdown || typeof document === 'undefined') {
      setDropdownPosition(null);
      return;
    }
    const input = inputRef.current;
    if (!input) return;
    const update = () => {
      const rect = input.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    const win = window;
    win.addEventListener('scroll', update, true);
    win.addEventListener('resize', update);
    return () => {
      win.removeEventListener('scroll', update, true);
      win.removeEventListener('resize', update);
    };
  }, [showDropdown, suggestions.length, showUseThisAddress]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        required={required}
        className="w-full px-2 py-3 pr-8 border-2 border-black dark:border-gray-600 rounded-lg bg-white dark:bg-[#1a1a1a] text-black dark:text-gray-100 placeholder:dark:placeholder-gray-400 focus:outline-none transition-all"
        placeholder={placeholder}
        disabled={disabled}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            clearSuggestions();
            setShowSuggestions(false);
            if (inputRef.current) {
              inputRef.current.value = '';
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-gray-100 transition-colors cursor-pointer z-10"
          disabled={disabled}
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {isLoading && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-black"></div>
        </div>
      )}

      {showDropdown && dropdownPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={suggestionsRef}
              className="fixed z-[9999] bg-white dark:bg-[#1a1a1a] border-2 border-black dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
              }}
            >
              {suggestions.map((suggestion, index) => {
                const formattedAddress = formatAddress(suggestion);
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={suggestion.place_id || index}
                    ref={isHighlighted ? highlightedButtonRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={isHighlighted}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectSuggestion(suggestion);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectSuggestion(suggestion);
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors border-b border-gray-200 dark:border-gray-600 last:border-b-0 cursor-pointer ${isHighlighted ? 'bg-gray-100 dark:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700'}`}
                  >
                    <div className="text-sm font-medium text-black dark:text-gray-100">{formattedAddress}</div>
                  </button>
                );
              })}
              {searchError && value.trim().length >= 2 && (
                <p className="px-4 py-2 text-xs text-amber-700 dark:text-amber-400 border-b border-gray-200 dark:border-gray-600" role="status">
                  {searchError}
                </p>
              )}
              {showUseThisAddress && (
                <button
                  type="button"
                  role="option"
                  className="w-full text-left px-4 py-3 transition-colors cursor-pointer border-t border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 text-sm text-gray-600 dark:text-gray-400"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleUseTypedAddress();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleUseTypedAddress();
                  }}
                >
                  Address not in list? <span className="font-medium text-black dark:text-gray-100">Use this address</span>
                </button>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
