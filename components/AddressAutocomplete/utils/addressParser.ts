import { AddressData } from '../../AddressAutocomplete';

// Address component type (compatible with both legacy and new API formats)
export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

// Google Places API result type
export interface GooglePlacesResult {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
  // Full place details after getDetails call
  address_components?: AddressComponent[];
  formatted_address?: string;
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
}

// Helper to extract address component value by type
function getAddressComponent(
  components: AddressComponent[] | undefined,
  type: string,
  useShortName = false
): string {
  if (!components) return '';
  const component = components.find((comp) => comp.types.includes(type));
  if (!component) return '';
  return useShortName ? component.short_name : component.long_name;
}

export function formatAddress(result: GooglePlacesResult): string {
  // Use formatted_address if available (from getDetails)
  if (result.formatted_address) {
    return result.formatted_address;
  }
  
  // Otherwise use description from autocomplete prediction
  if (result.description) {
    return result.description;
  }
  
  // Fallback to structured formatting
  if (result.structured_formatting) {
    return `${result.structured_formatting.main_text}, ${result.structured_formatting.secondary_text}`;
  }
  
  return '';
}

export function parseAddressData(result: GooglePlacesResult): AddressData {
  // If we have address_components (from getDetails), use them
  if (result.address_components && result.address_components.length > 0) {
    const streetNumber = getAddressComponent(result.address_components, 'street_number');
    const route = getAddressComponent(result.address_components, 'route');
    
    let streetAddress = '';
    if (streetNumber && route) {
      streetAddress = `${streetNumber} ${route}`.trim();
    } else if (route) {
      streetAddress = route;
    } else {
      // Fallback to formatted address first line
      const formatted = result.formatted_address || '';
      const firstLine = formatted.split(',')[0] || '';
      streetAddress = firstLine.trim();
    }
    
    const city = getAddressComponent(result.address_components, 'locality') ||
                 getAddressComponent(result.address_components, 'sublocality') ||
                 getAddressComponent(result.address_components, 'sublocality_level_1') ||
                 '';
    
    const state = getAddressComponent(result.address_components, 'administrative_area_level_1', true) || 'NV';
    const zipCode = getAddressComponent(result.address_components, 'postal_code') || '';
    
    return {
      streetAddress,
      city,
      state,
      zipCode,
      apartment: '',
      fullAddress: result.formatted_address || formatAddress(result),
    };
  }
  
  // If we only have prediction data (no address_components), parse from description
  // This is a fallback - ideally we should call getDetails first
  const description = result.description || '';
  const parts = description.split(',').map(p => p.trim());
  
  // Try to extract street address (first part)
  let streetAddress = parts[0] || '';
  
  // Extract city (usually second to last part)
  let city = '';
  if (parts.length > 1) {
    city = parts[parts.length - 3] || parts[parts.length - 2] || '';
  }
  
  // Extract state (usually second to last part)
  let state = 'NV';
  const statePart = parts.find(p => /^[A-Z]{2}$/.test(p));
  if (statePart) {
    state = statePart;
  }
  
  // Extract zip code (usually last part or second to last)
  let zipCode = '';
  const zipPart = parts.find(p => /^\d{5}(-\d{4})?$/.test(p));
  if (zipPart) {
    zipCode = zipPart;
  }
  
  return {
    streetAddress,
    city,
    state,
    zipCode,
    apartment: '',
    fullAddress: description,
  };
}

const ZIP_REGEX = /\b(\d{5}(-\d{4})?)\b/;

/**
 * Parse a free-form address line (e.g. "123 Main St, Las Vegas, NV 89101") into AddressData.
 * Used when the user confirms an address that wasn't in autocomplete suggestions.
 */
export function parseFreeformAddress(line: string): AddressData {
  const trimmed = line.trim();
  if (!trimmed) {
    return {
      streetAddress: '',
      city: '',
      state: 'NV',
      zipCode: '',
      apartment: '',
      fullAddress: '',
    };
  }
  const parts = trimmed.split(',').map((p) => p.trim()).filter(Boolean);
  const zipMatch = trimmed.match(ZIP_REGEX);
  const zipCode = zipMatch ? zipMatch[1] : '';
  const statePart = parts.find((p) => /^(NV|Nevada)$/i.test(p));
  const state = statePart ? (statePart.toUpperCase() === 'NEVADA' ? 'NV' : statePart) : 'NV';
  let city = '';
  const nvIndex = parts.findIndex((p) => /^(NV|Nevada)$/i.test(p));
  if (nvIndex > 0) {
    city = parts[nvIndex - 1];
  } else if (parts.length >= 2) {
    city = parts[parts.length - 2];
  }
  const streetAddress = parts[0] ?? trimmed;
  return {
    streetAddress,
    city,
    state,
    zipCode,
    apartment: '',
    fullAddress: trimmed,
  };
}
