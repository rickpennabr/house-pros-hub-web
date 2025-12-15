'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAddressSearch } from './AddressAutocomplete/hooks/useAddressSearch';
import { formatAddress, parseAddressData, PhotonResult } from './AddressAutocomplete/utils/addressParser';

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
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = 'Enter your Nevada address',
  disabled = false,
  required = false,
  id = 'address',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { suggestions, isLoading, searchAddresses, clearSuggestions } = useAddressSearch();

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

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: PhotonResult) => {
    const addressData = parseAddressData(suggestion);
    onChange(addressData.streetAddress);

    if (onAddressSelect) {
      onAddressSelect(addressData);
    }

    setShowSuggestions(false);
    clearSuggestions();

    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

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

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={() => {
          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
        }}
        required={required}
        className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
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
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors cursor-pointer z-10"
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

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border-2 border-black rounded-lg shadow-lg max-h-60 overflow-y-auto"
          onMouseDown={(e) => {
            e.preventDefault();
          }}
        >
          {suggestions.map((suggestion, index) => {
            const formattedAddress = formatAddress(suggestion);
            return (
              <button
                key={index}
                type="button"
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
                className="w-full text-left px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-200 last:border-b-0 cursor-pointer"
              >
                <div className="text-sm font-medium text-black">{formattedAddress}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
