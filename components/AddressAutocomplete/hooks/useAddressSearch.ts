'use client';

import { useState, useRef, useEffect } from 'react';
import { GooglePlacesResult } from '../utils/addressParser';

interface AutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text: string;
  };
}

interface AutocompleteResponse {
  suggestions?: Array<{
    placePrediction?: {
      placeId: string;
      text: {
        text: string;
        matches: Array<{
          endOffset: number;
          startOffset: number;
        }>;
      };
      structuredFormat?: {
        mainText: {
          text: string;
          matches: Array<{
            endOffset: number;
            startOffset: number;
          }>;
        };
        secondaryText?: {
          text: string;
        };
      };
    };
  }>;
}

export function useAddressSearch() {
  const [suggestions, setSuggestions] = useState<GooglePlacesResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const searchAddresses = async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set');
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const searchQuery = query.trim();

      // Las Vegas coordinates for location bias
      const lasVegasLat = 36.1699;
      const lasVegasLon = -115.1398;

      // Call the new Places API (New) autocomplete endpoint
      const response = await fetch(
        `https://places.googleapis.com/v1/places:autocomplete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
          },
          body: JSON.stringify({
            input: searchQuery,
            locationBias: {
              circle: {
                center: {
                  latitude: lasVegasLat,
                  longitude: lasVegasLon,
                },
                radius: 50000.0, // 50km radius in meters
              },
            },
            includedRegionCodes: ['US'], // Restrict to US
            languageCode: 'en',
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Places API error:', response.status, errorText);
        setSuggestions([]);
        return;
      }

      const data: AutocompleteResponse = await response.json();

      // Convert API response to GooglePlacesResult format
      const results: GooglePlacesResult[] = (data.suggestions || [])
        .filter((suggestion) => suggestion.placePrediction)
        .map((suggestion) => {
          const prediction = suggestion.placePrediction!;
          return {
            place_id: prediction.placeId,
            description: prediction.text.text,
            structured_formatting: prediction.structuredFormat
              ? {
                  main_text: prediction.structuredFormat.mainText.text,
                  secondary_text: prediction.structuredFormat.secondaryText?.text || '',
                }
              : undefined,
          };
        });

      // Filter for Nevada addresses based on description
      const nevadaResults = results.filter((result) => {
        const description = result.description.toLowerCase();
        const secondaryText = result.structured_formatting?.secondary_text?.toLowerCase() || '';
        
        // Check if it's in Nevada
        return (
          description.includes(', nv') ||
          description.includes(', nevada') ||
          secondaryText.includes(', nv') ||
          secondaryText.includes(', nevada') ||
          description.includes('las vegas') ||
          description.includes('north las vegas') ||
          description.includes('henderson') ||
          description.includes('reno') ||
          description.includes('carson city')
        );
      });

      // Limit to 10 results
      setSuggestions(nevadaResults.slice(0, 10));
    } catch (error) {
      console.error('Address search error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = (query: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      searchAddresses(query);
    }, 300);
  };

  // Function to get full place details by place_id
  const getPlaceDetails = async (placeId: string): Promise<GooglePlacesResult | null> => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set');
      return null;
    }

    try {
      // Call the new Places API (New) place details endpoint
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,formattedAddress,addressComponents',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Places API details error:', response.status, errorText);
        return null;
      }

      const place = await response.json();

      // The new API response structure
      // Verify it's in Nevada
      const addressComponents = place.addressComponents || [];
      const stateComponent = addressComponents.find((comp: { types?: string[] }) =>
        comp.types?.includes('administrative_area_level_1')
      );
      
      // The new API uses shortText and longText fields
      const state = stateComponent?.shortText || stateComponent?.longText || '';
      if (state !== 'NV' && state !== 'Nevada') {
        return null;
      }

      // Convert address components to the format expected by addressParser
      // The new API uses shortText/longText, so we need to map them to short_name/long_name
      const mappedAddressComponents = addressComponents.map((comp: any) => ({
        long_name: comp.longText || comp.text || '',
        short_name: comp.shortText || comp.text || '',
        types: comp.types || [],
      }));

      return {
        place_id: place.id || placeId,
        description: place.formattedAddress || '',
        formatted_address: place.formattedAddress,
        address_components: mappedAddressComponents,
      };
    } catch (error) {
      console.error('Error fetching place details:', error);
      return null;
    }
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    suggestions,
    isLoading,
    searchAddresses: debouncedSearch,
    clearSuggestions: () => setSuggestions([]),
    getPlaceDetails,
  };
}
