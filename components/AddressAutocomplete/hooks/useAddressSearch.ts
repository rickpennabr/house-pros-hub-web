'use client';

import { useState, useRef, useEffect } from 'react';
import { PhotonResult } from '../utils/addressParser';

export function useAddressSearch() {
  const [suggestions, setSuggestions] = useState<PhotonResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const searchAddresses = async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const searchQuery = query.trim();
      // Las Vegas coordinates for location bias
      const lasVegasLat = 36.1699;
      const lasVegasLon = -115.1398;

      const performSearch = async (queryToSearch: string): Promise<PhotonResult[]> => {
        const response = await fetch(
          `https://photon.komoot.io/api/?` +
            `q=${encodeURIComponent(queryToSearch)}` +
            `&limit=30` +
            `&lang=en` +
            `&lat=${lasVegasLat}` +
            `&lon=${lasVegasLon}`,
          {
            headers: {
              Accept: 'application/json',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          return data.features || [];
        }
        return [];
      };

      // Helper to extract address parts from pasted full addresses
      const extractAddressParts = (fullQuery: string) => {
        // Try to extract house number
        const houseNumberMatch = fullQuery.match(/^(\d+)/);
        const houseNumber = houseNumberMatch ? houseNumberMatch[1] : null;
        
        // Try to extract street name with number (e.g., "6323 Silverfield Dr")
        // Pattern: number + street name + street suffix
        const fullStreetMatch = fullQuery.match(/(\d+)\s+([A-Za-z\s]+?)(?:\s+)?(?:Dr|St|Ave|Blvd|Rd|Ln|Ct|Way|Pl|Cir|Pkwy|Drive|Street|Avenue|Boulevard|Road|Lane|Court|Place|Circle|Parkway)/i);
        let streetName = null;
        if (fullStreetMatch) {
          streetName = fullStreetMatch[2].trim();
        } else {
          // Try without suffix - just number + name
          const simpleMatch = fullQuery.match(/(\d+)\s+([A-Za-z]+)/);
          if (simpleMatch) {
            streetName = simpleMatch[2].trim();
          }
        }
        
        // Extract city (Las Vegas, etc.)
        const cityMatch = fullQuery.match(/(Las Vegas|North Las Vegas|Henderson|Reno|Carson City)/i);
        const city = cityMatch ? cityMatch[1] : null;
        
        return { houseNumber, streetName, city };
      };

      // Try multiple search strategies
      const searchStrategies: string[] = [];
      
      // Strategy 1: Original query as-is
      searchStrategies.push(searchQuery);
      
      // Strategy 2: If query contains full address, try extracting parts
      const addressParts = extractAddressParts(searchQuery);
      if (addressParts.houseNumber && addressParts.streetName) {
        searchStrategies.push(`${addressParts.houseNumber} ${addressParts.streetName}`);
      }
      if (addressParts.streetName) {
        searchStrategies.push(addressParts.streetName);
      }
      
      // Strategy 3: Try with Nevada if not already present
      if (!searchQuery.toLowerCase().includes('nevada') && !searchQuery.toLowerCase().includes('nv')) {
        searchStrategies.push(`${searchQuery}, Nevada`);
        if (addressParts.houseNumber && addressParts.streetName) {
          searchStrategies.push(`${addressParts.houseNumber} ${addressParts.streetName}, Nevada`);
        }
      }
      
      // Strategy 4: Try with Las Vegas if city not present
      if (!searchQuery.toLowerCase().includes('las vegas')) {
        searchStrategies.push(`${searchQuery}, Las Vegas, NV`);
      }

      // Perform all searches and merge results
      const allFeatures: PhotonResult[] = [];
      const seenAddresses = new Set<string>();

      for (const strategy of searchStrategies) {
        const features = await performSearch(strategy);
        
        for (const feature of features) {
          // Create unique key for deduplication
          const street = feature.properties.street || '';
          const housenumber = feature.properties.housenumber || '';
          const city = feature.properties.city || '';
          const postcode = feature.properties.postcode || feature.properties.zipcode || '';
          const addressKey = `${housenumber}|${street}|${city}|${postcode}`.trim().toLowerCase();
          
          if (!seenAddresses.has(addressKey)) {
            seenAddresses.add(addressKey);
            allFeatures.push(feature);
          }
        }
        
        // If we have enough good results, we can stop early
        if (allFeatures.length >= 15) break;
      }

      // Filter for Nevada results with more flexible matching
      const nevadaResults = allFeatures
        .filter((result) => {
          const state = result.properties.state;
          const country = result.properties.country;
          const city = result.properties.city;
          const name = result.properties.name || '';
          
          // Check if it's in Nevada or Las Vegas area - be more permissive
          const isNevada = 
            state === 'Nevada' || 
            state === 'NV' || 
            city === 'Las Vegas' ||
            city === 'North Las Vegas' ||
            city === 'Henderson' ||
            city === 'Reno' ||
            city === 'Carson City' ||
            name.toLowerCase().includes('las vegas') ||
            name.toLowerCase().includes('nevada') ||
            !state; // Include results without state if location bias suggests Nevada
          
          const isUS = 
            country === 'United States' || 
            country === 'US' || 
            !country ||
            country === ''; // Empty string also counts as US
          
          return isNevada && isUS;
        })
        // Sort by relevance: addresses with house numbers first, then by how well they match
        .sort((a, b) => {
          const aHasAddress = a.properties.housenumber && a.properties.street;
          const bHasAddress = b.properties.housenumber && b.properties.street;
          if (aHasAddress && !bHasAddress) return -1;
          if (!aHasAddress && bHasAddress) return 1;
          
          // Prefer results with Las Vegas city
          const aIsLasVegas = a.properties.city === 'Las Vegas';
          const bIsLasVegas = b.properties.city === 'Las Vegas';
          if (aIsLasVegas && !bIsLasVegas) return -1;
          if (!aIsLasVegas && bIsLasVegas) return 1;
          
          return 0;
        })
        .slice(0, 10);

      setSuggestions(nevadaResults);
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
  };
}

