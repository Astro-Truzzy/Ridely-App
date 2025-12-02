import { useState, useEffect, useRef } from 'react';

export interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
  };
}

const DEBOUNCE_DELAY = 300; // milliseconds

export function useAddressAutocomplete() {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const searchAddresses = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
    
    if (!mapboxToken) {
      console.warn('Mapbox access token not found. Please add EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN to your .env file');
      setSuggestions([]);
      return;
    }

    setLoading(true);

    try {
      // Using Mapbox Geocoding API for accurate address autocomplete
      // Filtered to Nigeria (country code: ng) for better results
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=ng&limit=5&access_token=${mapboxToken}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch address suggestions');
      }

      const data = await response.json();
      
      // Map Mapbox response format to our AddressSuggestion interface
      const formattedData: AddressSuggestion[] = data.features.map((feature: any, index: number) => {
        const [longitude, latitude] = feature.center;
        const context = feature.context || [];
        
        // Extract address components from context
        const address: any = {};
        context.forEach((item: any) => {
          if (item.id.startsWith('place.')) {
            address.city = item.text;
          } else if (item.id.startsWith('region.')) {
            address.state = item.text;
          } else if (item.id.startsWith('postcode.')) {
            address.postcode = item.text;
          } else if (item.id.startsWith('neighborhood.')) {
            address.suburb = item.text;
          }
        });

        // Build formatted display name
        let displayName = feature.place_name;
        
        // Clean up the display name (remove country if already in it)
        if (displayName.includes(', Nigeria')) {
          displayName = displayName.replace(', Nigeria', '');
        }

        return {
          display_name: displayName,
          lat: latitude.toString(),
          lon: longitude.toString(),
          place_id: index,
          address: {
            road: feature.properties.address || feature.text,
            city: address.city,
            state: address.state,
            suburb: address.suburb,
            postcode: address.postcode,
          },
        };
      });
      
      setSuggestions(formattedData);
    } catch (error) {
      console.error('Error fetching address suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = (query: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      searchAddresses(query);
    }, DEBOUNCE_DELAY);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const clearSuggestions = () => {
    setSuggestions([]);
  };

  return {
    suggestions,
    loading,
    searchAddresses: debouncedSearch,
    clearSuggestions,
  };
}

