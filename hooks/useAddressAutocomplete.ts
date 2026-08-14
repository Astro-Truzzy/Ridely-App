import { useState, useEffect, useRef } from 'react';
import { googleMapsRequest } from '@/lib/googleMapsClient';

export interface AddressSuggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: string | number;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
  };
}

const DEBOUNCE_DELAY = 250;
const MIN_QUERY_LENGTH = 2;

export function useAddressAutocomplete() {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueryRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const searchAddresses = async (query: string) => {
    const trimmed = (query || '').trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      lastQueryRef.current = '';
      setSuggestions([]);
      return;
    }

    // Cancel any in-flight request so it can't overwrite newer results
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    lastQueryRef.current = trimmed;

    setLoading(true);
    try {
      // No 'types' restriction so we get both addresses and establishments (malls, shops, landmarks e.g. Shoprite, Market Square, Hypercity in Port Harcourt)
      const data = await googleMapsRequest(
        'place/autocomplete/json',
        { input: trimmed, components: 'country:ng' },
        signal
      );

      if (lastQueryRef.current !== trimmed) {
        return;
      }

      let formatted: AddressSuggestion[] = [];
      if (data && (data.status === 'OK' || data.status === 'ZERO_RESULTS')) {
        formatted = (data.predictions || []).map((p: { place_id: string; description: string }) => ({
          display_name: p.description.replace(/, Nigeria$/, '').trim(),
          lat: '',
          lon: '',
          place_id: p.place_id,
          address: {},
        }));
      }

      // Geocoding still works when Places Autocomplete is denied or empty.
      if (formatted.length === 0) {
        const geo = await googleMapsRequest(
          'geocode/json',
          { address: trimmed, components: 'country:NG' },
          signal
        );
        if (lastQueryRef.current !== trimmed) {
          return;
        }
        formatted = (geo?.results || []).slice(0, 6).map((r: {
          place_id?: string;
          formatted_address?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
        }) => ({
          display_name: (r.formatted_address || trimmed).replace(/, Nigeria$/, '').trim(),
          lat: r.geometry?.location?.lat != null ? String(r.geometry.location.lat) : '',
          lon: r.geometry?.location?.lng != null ? String(r.geometry.location.lng) : '',
          place_id: r.place_id || `${r.geometry?.location?.lat},${r.geometry?.location?.lng}`,
          address: {},
        }));
      }

      setSuggestions(formatted);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('Error fetching address suggestions:', error);
      if (lastQueryRef.current === trimmed) {
        setSuggestions([]);
      }
    } finally {
      if (lastQueryRef.current === trimmed) {
        setLoading(false);
      }
      if (abortControllerRef.current?.signal === signal) {
        abortControllerRef.current = null;
      }
    }
  };

  /** Fetch full address with coordinates for a Google place_id. Call this when user selects a suggestion. */
  const getPlaceDetails = async (placeId: string): Promise<AddressSuggestion | null> => {
    try {
      const data = await googleMapsRequest('place/details/json', {
        place_id: placeId,
        fields: 'geometry,formatted_address,address_components',
      });
      if (!data || data.status !== 'OK' || !data.result) return null;
      const r = data.result;
      const lat = r.geometry?.location?.lat;
      const lng = r.geometry?.location?.lng;
      const display_name = r.formatted_address || '';
      const address: AddressSuggestion['address'] = {};
      (r.address_components || []).forEach((c: { types: string[]; long_name: string }) => {
        if (c.types.includes('street_number')) address!.house_number = c.long_name;
        if (c.types.includes('route')) address!.road = c.long_name;
        if (c.types.includes('sublocality') || c.types.includes('neighborhood')) address!.suburb = c.long_name;
        if (c.types.includes('locality')) address!.city = c.long_name;
        if (c.types.includes('administrative_area_level_1')) address!.state = c.long_name;
        if (c.types.includes('postal_code')) address!.postcode = c.long_name;
      });
      return {
        display_name: display_name.replace(/, Nigeria$/, '').trim(),
        lat: lat != null ? String(lat) : '',
        lon: lng != null ? String(lng) : '',
        place_id: placeId,
        address,
      };
    } catch (error) {
      console.error('Error fetching place details:', error);
      return null;
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
    getPlaceDetails,
  };
}
