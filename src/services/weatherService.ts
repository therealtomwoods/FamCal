import { WeatherData, DailyForecast } from '../types';

export function getWmoCondition(code: number): { text: string; icon: string } {
  if (code === 0) return { text: 'Clear Sky', icon: 'sun' };
  if (code === 1) return { text: 'Mainly Clear', icon: 'sun' };
  if (code === 2) return { text: 'Partly Cloudy', icon: 'cloud-sun' };
  if (code === 3) return { text: 'Overcast', icon: 'cloud' };
  if (code >= 45 && code <= 48) return { text: 'Foggy', icon: 'cloud-fog' };
  if (code >= 51 && code <= 55) return { text: 'Drizzle', icon: 'cloud-drizzle' };
  if (code >= 61 && code <= 65) return { text: 'Rain Showers', icon: 'cloud-rain' };
  if (code >= 71 && code <= 77) return { text: 'Snow', icon: 'snowflake' };
  if (code >= 80 && code <= 82) return { text: 'Heavy Showers', icon: 'cloud-rain' };
  if (code >= 95) return { text: 'Thunderstorm', icon: 'cloud-lightning' };
  return { text: 'Mild & Pleasant', icon: 'sun' };
}

export function getWeatherConditionInfo(code?: number, text?: string): { text: string; icon: string } {
  const desc = (text || '').toLowerCase();
  if (desc.includes('thunder') || desc.includes('lightning') || (code && code >= 95) || code === 200 || code === 386 || code === 389 || code === 392) {
    return { text: text || 'Thunderstorm', icon: 'cloud-lightning' };
  }
  if (desc.includes('snow') || desc.includes('blizzard') || desc.includes('flurr') || desc.includes('ice') || desc.includes('sleet') || (code && ((code >= 71 && code <= 77) || (code >= 323 && code <= 371)))) {
    return { text: text || 'Snow', icon: 'snowflake' };
  }
  if (desc.includes('rain') || desc.includes('drizzle') || desc.includes('shower') || (code && ((code >= 51 && code <= 65) || (code >= 80 && code <= 82) || (code >= 263 && code <= 308) || (code >= 353 && code <= 359)))) {
    return { text: text || 'Rain', icon: 'cloud-rain' };
  }
  if (desc.includes('fog') || desc.includes('mist') || desc.includes('haze') || (code && ((code >= 45 && code <= 48) || code === 143 || code === 248))) {
    return { text: text || 'Foggy', icon: 'cloud-fog' };
  }
  if (desc.includes('partly') || desc.includes('scattered') || code === 2 || code === 116) {
    return { text: text || 'Partly Cloudy', icon: 'cloud-sun' };
  }
  if (desc.includes('cloud') || desc.includes('overcast') || code === 3 || code === 119 || code === 122) {
    return { text: text || 'Cloudy', icon: 'cloud' };
  }
  if (desc.includes('sun') || desc.includes('clear') || code === 0 || code === 1 || code === 113) {
    return { text: text || 'Clear', icon: 'sun' };
  }
  if (code !== undefined) {
    return getWmoCondition(code);
  }
  return { text: text || 'Clear', icon: 'sun' };
}

export interface GeocodeResult {
  name: string;
  lat: number;
  lon: number;
}

// Built-in offline coordinates dictionary for immediate, reliable lookups
const BUILTIN_CITIES: Record<string, { name: string; lat: number; lon: number }> = {
  // Top US Metro Areas
  'new york': { name: 'New York, NY', lat: 40.7128, lon: -74.006 },
  'nyc': { name: 'New York, NY', lat: 40.7128, lon: -74.006 },
  'los angeles': { name: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437 },
  'la': { name: 'Los Angeles, CA', lat: 34.0522, lon: -118.2437 },
  'chicago': { name: 'Chicago, IL', lat: 41.8781, lon: -87.6298 },
  'houston': { name: 'Houston, TX', lat: 29.7604, lon: -95.3698 },
  'phoenix': { name: 'Phoenix, AZ', lat: 33.4484, lon: -112.074 },
  'philadelphia': { name: 'Philadelphia, PA', lat: 39.9526, lon: -75.1652 },
  'san antonio': { name: 'San Antonio, TX', lat: 29.4241, lon: -98.4936 },
  'san diego': { name: 'San Diego, CA', lat: 32.7157, lon: -117.1611 },
  'dallas': { name: 'Dallas, TX', lat: 32.7767, lon: -96.797 },
  'austin': { name: 'Austin, TX', lat: 30.2672, lon: -97.7431 },
  'san jose': { name: 'San Jose, CA', lat: 37.3382, lon: -121.8863 },
  'fort worth': { name: 'Fort Worth, TX', lat: 32.7555, lon: -97.3308 },
  'jacksonville': { name: 'Jacksonville, FL', lat: 30.3322, lon: -81.6557 },
  'columbus': { name: 'Columbus, OH', lat: 39.9612, lon: -82.9988 },
  'charlotte': { name: 'Charlotte, NC', lat: 35.2271, lon: -80.8431 },
  'indianapolis': { name: 'Indianapolis, IN', lat: 39.7684, lon: -86.1581 },
  'san francisco': { name: 'San Francisco, CA', lat: 37.7749, lon: -122.4194 },
  'seattle': { name: 'Seattle, WA', lat: 47.6062, lon: -122.3321 },
  'denver': { name: 'Denver, CO', lat: 39.7392, lon: -104.9903 },
  'washington': { name: 'Washington, DC', lat: 38.9072, lon: -77.0369 },
  'washington dc': { name: 'Washington, DC', lat: 38.9072, lon: -77.0369 },
  'dc': { name: 'Washington, DC', lat: 38.9072, lon: -77.0369 },
  'boston': { name: 'Boston, MA', lat: 42.3601, lon: -71.0589 },
  'el paso': { name: 'El Paso, TX', lat: 31.7619, lon: -106.485 },
  'nashville': { name: 'Nashville, TN', lat: 36.1627, lon: -86.7816 },
  'detroit': { name: 'Detroit, MI', lat: 42.3314, lon: -83.0458 },
  'oklahoma city': { name: 'Oklahoma City, OK', lat: 35.4676, lon: -97.5164 },
  'portland': { name: 'Portland, OR', lat: 45.5152, lon: -122.6784 },
  'las vegas': { name: 'Las Vegas, NV', lat: 36.1699, lon: -115.1398 },
  'memphis': { name: 'Memphis, TN', lat: 35.1495, lon: -90.049 },
  'louisville': { name: 'Louisville, KY', lat: 38.2527, lon: -85.7585 },
  'baltimore': { name: 'Baltimore, MD', lat: 39.2904, lon: -76.6122 },
  'milwaukee': { name: 'Milwaukee, WI', lat: 43.0389, lon: -87.9065 },
  'albuquerque': { name: 'Albuquerque, NM', lat: 35.0844, lon: -106.6504 },
  'tucson': { name: 'Tucson, AZ', lat: 32.2226, lon: -110.9747 },
  'fresno': { name: 'Fresno, CA', lat: 36.7468, lon: -119.7726 },
  'sacramento': { name: 'Sacramento, CA', lat: 38.5816, lon: -121.4944 },
  'mesa': { name: 'Mesa, AZ', lat: 33.4152, lon: -111.8315 },
  'kansas city': { name: 'Kansas City, MO', lat: 39.0997, lon: -94.5786 },
  'atlanta': { name: 'Atlanta, GA', lat: 33.749, lon: -84.388 },
  'omaha': { name: 'Omaha, NE', lat: 41.2565, lon: -95.9345 },
  'colorado springs': { name: 'Colorado Springs, CO', lat: 38.8339, lon: -104.8214 },
  'raleigh': { name: 'Raleigh, NC', lat: 35.7796, lon: -78.6382 },
  'miami': { name: 'Miami, FL', lat: 25.7617, lon: -80.1918 },
  'virginia beach': { name: 'Virginia Beach, VA', lat: 36.8529, lon: -75.978 },
  'oakland': { name: 'Oakland, CA', lat: 37.8044, lon: -122.2712 },
  'minneapolis': { name: 'Minneapolis, MN', lat: 44.9778, lon: -93.265 },
  'tulsa': { name: 'Tulsa, OK', lat: 36.154, lon: -95.9928 },
  'tampa': { name: 'Tampa, FL', lat: 27.9506, lon: -82.4572 },
  'orlando': { name: 'Orlando, FL', lat: 28.5383, lon: -81.3792 },
  'cleveland': { name: 'Cleveland, OH', lat: 41.4993, lon: -81.6944 },
  'honolulu': { name: 'Honolulu, HI', lat: 21.3069, lon: -157.8583 },
  'cincinnati': { name: 'Cincinnati, OH', lat: 39.1031, lon: -84.512 },
  'pittsburgh': { name: 'Pittsburgh, PA', lat: 40.4406, lon: -79.9959 },
  'st. louis': { name: 'St. Louis, MO', lat: 38.627, lon: -90.1994 },
  'salt lake city': { name: 'Salt Lake City, UT', lat: 40.7608, lon: -111.891 },
  'boise': { name: 'Boise, ID', lat: 43.615, lon: -116.2023 },
  'richmond': { name: 'Richmond, VA', lat: 37.5407, lon: -77.436 },
  'des moines': { name: 'Des Moines, IA', lat: 41.5868, lon: -93.625 },
  'anchorage': { name: 'Anchorage, AK', lat: 61.2181, lon: -149.9003 },
  'madison': { name: 'Madison, WI', lat: 43.0731, lon: -89.4012 },
  'providence': { name: 'Providence, RI', lat: 41.824, lon: -71.4128 },
  'hartford': { name: 'Hartford, CT', lat: 41.7658, lon: -72.6734 },
  'buffalo': { name: 'Buffalo, NY', lat: 42.8864, lon: -78.8784 },
  'rochester': { name: 'Rochester, NY', lat: 43.1566, lon: -77.6088 },
  'scottsdale': { name: 'Scottsdale, AZ', lat: 33.4942, lon: -111.9261 },
  'plano': { name: 'Plano, TX', lat: 33.0198, lon: -96.6989 },
  'irvine': { name: 'Irvine, CA', lat: 33.6846, lon: -117.8265 },

  // Canada & Ontario Regional Centres
  'elora': { name: 'Elora, Ontario', lat: 43.6834, lon: -80.4329 },
  'elora, ontario': { name: 'Elora, Ontario', lat: 43.6834, lon: -80.4329 },
  'elora, on': { name: 'Elora, Ontario', lat: 43.6834, lon: -80.4329 },
  'fergus': { name: 'Fergus, Ontario', lat: 43.7042, lon: -80.3774 },
  'fergus, ontario': { name: 'Fergus, Ontario', lat: 43.7042, lon: -80.3774 },
  'fergus, on': { name: 'Fergus, Ontario', lat: 43.7042, lon: -80.3774 },
  'centre wellington': { name: 'Centre Wellington, Ontario', lat: 43.7001, lon: -80.4000 },
  'centre wellington, ontario': { name: 'Centre Wellington, Ontario', lat: 43.7001, lon: -80.4000 },
  'guelph': { name: 'Guelph, Ontario', lat: 43.5448, lon: -80.2482 },
  'guelph, ontario': { name: 'Guelph, Ontario', lat: 43.5448, lon: -80.2482 },
  'guelph, on': { name: 'Guelph, Ontario', lat: 43.5448, lon: -80.2482 },
  'kitchener': { name: 'Kitchener, Ontario', lat: 43.4516, lon: -80.4925 },
  'kitchener, ontario': { name: 'Kitchener, Ontario', lat: 43.4516, lon: -80.4925 },
  'waterloo': { name: 'Waterloo, Ontario', lat: 43.4643, lon: -80.5204 },
  'waterloo, ontario': { name: 'Waterloo, Ontario', lat: 43.4643, lon: -80.5204 },
  'cambridge': { name: 'Cambridge, Ontario', lat: 43.3616, lon: -80.3144 },
  'cambridge, ontario': { name: 'Cambridge, Ontario', lat: 43.3616, lon: -80.3144 },
  'hamilton': { name: 'Hamilton, Ontario', lat: 43.2557, lon: -79.8711 },
  'hamilton, ontario': { name: 'Hamilton, Ontario', lat: 43.2557, lon: -79.8711 },
  'london, on': { name: 'London, Ontario', lat: 42.9849, lon: -81.2453 },
  'london, ontario': { name: 'London, Ontario', lat: 42.9849, lon: -81.2453 },
  'mississauga': { name: 'Mississauga, Ontario', lat: 43.5890, lon: -79.6441 },
  'brampton': { name: 'Brampton, Ontario', lat: 43.7315, lon: -79.7624 },
  'markham': { name: 'Markham, Ontario', lat: 43.8561, lon: -79.3370 },
  'vaughan': { name: 'Vaughan, Ontario', lat: 43.8563, lon: -79.5085 },
  'barrie': { name: 'Barrie, Ontario', lat: 44.3894, lon: -79.6903 },
  'ottawa': { name: 'Ottawa, Ontario', lat: 45.4215, lon: -75.6972 },
  'ottawa, ontario': { name: 'Ottawa, Ontario', lat: 45.4215, lon: -75.6972 },
  'toronto': { name: 'Toronto, Ontario', lat: 43.6532, lon: -79.3832 },
  'toronto, ontario': { name: 'Toronto, Ontario', lat: 43.6532, lon: -79.3832 },
  'toronto, on': { name: 'Toronto, Ontario', lat: 43.6532, lon: -79.3832 },
  'vancouver': { name: 'Vancouver, BC', lat: 49.2827, lon: -123.1207 },
  'montreal': { name: 'Montreal, QC', lat: 45.5017, lon: -73.5673 },
  'calgary': { name: 'Calgary, AB', lat: 51.0447, lon: -114.0719 },
  'edmonton': { name: 'Edmonton, AB', lat: 53.5461, lon: -113.4938 },

  // International Cities
  'london': { name: 'London, UK', lat: 51.5074, lon: -0.1278 },
  'paris': { name: 'Paris, FR', lat: 48.8566, lon: 2.3522 },
  'sydney': { name: 'Sydney, AU', lat: -33.8688, lon: 151.2093 },
  'melbourne': { name: 'Melbourne, AU', lat: -37.8136, lon: 144.9631 },
  'brisbane': { name: 'Brisbane, AU', lat: -27.4698, lon: 153.0251 },
  'auckland': { name: 'Auckland, NZ', lat: -36.8485, lon: 174.7633 },
  'tokyo': { name: 'Tokyo, JP', lat: 35.6762, lon: 139.6503 },
  'berlin': { name: 'Berlin, DE', lat: 52.52, lon: 13.405 },
  'madrid': { name: 'Madrid, ES', lat: 40.4168, lon: -3.7038 },
  'rome': { name: 'Rome, IT', lat: 41.9028, lon: 12.4964 },
  'amsterdam': { name: 'Amsterdam, NL', lat: 52.3676, lon: 4.9041 },
  'dublin': { name: 'Dublin, IE', lat: 53.3498, lon: -6.2603 },
  'singapore': { name: 'Singapore', lat: 1.3521, lon: 103.8198 },
  'seoul': { name: 'Seoul, KR', lat: 37.5665, lon: 126.978 },
  'hong kong': { name: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
  'dubai': { name: 'Dubai, UAE', lat: 25.2048, lon: 55.2708 },
  'mexico city': { name: 'Mexico City, MX', lat: 19.4326, lon: -99.1332 },
};

/**
 * Checks if the string matches coordinate format: "37.77, -122.41" or "37.77N, 122.41W"
 */
function parseDirectCoordinates(query: string): GeocodeResult | null {
  const coordRegex = /^\s*(-?\d+(?:\.\d+)?)\s*(?:°|[NSEW])?[\s,]+(-?\d+(?:\.\d+)?)\s*(?:°|[NSEW])?\s*$/i;
  const match = query.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      return {
        name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
        lat,
        lon,
      };
    }
  }
  return null;
}

/**
 * Geocodes a city name, zip code, or address into coordinates using Open-Meteo,
 * OpenStreetMap Nominatim, and a comprehensive local dictionary.
 */
export async function geocodeLocation(query: string): Promise<GeocodeResult | null> {
  const clean = query.trim();
  if (!clean) return null;

  // 1. Check if user entered direct coordinates
  const directCoord = parseDirectCoordinates(clean);
  if (directCoord) return directCoord;

  // 2. Check local offline dictionary first (instant, infallible & zero latency)
  const cleanLower = clean.toLowerCase();
  const normalized = cleanLower
    .replace(/,\s*[a-z]{2,}(\s+usa|\s+us|\s+ca|\s+canada)?$/i, '')
    .trim();

  if (BUILTIN_CITIES[cleanLower]) {
    return BUILTIN_CITIES[cleanLower];
  }
  if (BUILTIN_CITIES[normalized]) {
    return BUILTIN_CITIES[normalized];
  }

  // Check dictionary keys for partial match
  for (const [key, cityInfo] of Object.entries(BUILTIN_CITIES)) {
    if (key === cleanLower || key === normalized) {
      return cityInfo;
    }
  }

  // 3. Online Geocoding via Open-Meteo Geocoding API
  // Open-Meteo search fails if the query contains commas/state like "Elora, Ontario".
  // Extract place name (before comma) and optional region/state qualifier
  const parts = clean.split(',').map((p) => p.trim());
  const placeName = parts[0];
  const regionFilter = parts.length > 1 ? parts.slice(1).join(' ').toLowerCase() : '';

  try {
    const searchTerms = [placeName];
    if (placeName !== clean) searchTerms.push(clean);

    for (const term of searchTerms) {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        term
      )}&count=10&language=en&format=json`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          let matched = data.results[0];

          // If a region/province filter was provided (e.g. "Ontario", "ON", "Canada")
          if (regionFilter) {
            const found = data.results.find((r: any) => {
              const admin = (r.admin1 || '').toLowerCase();
              const country = (r.country || '').toLowerCase();
              const cc = (r.country_code || '').toLowerCase();
              return (
                admin.includes(regionFilter) ||
                country.includes(regionFilter) ||
                cc === regionFilter ||
                (regionFilter === 'on' && admin === 'ontario') ||
                (regionFilter === 'ontario' && admin === 'ontario') ||
                (regionFilter === 'ca' && country === 'canada')
              );
            });
            if (found) matched = found;
          }

          const stateOrCountry = matched.admin1 || matched.country || '';
          const displayName = stateOrCountry ? `${matched.name}, ${stateOrCountry}` : matched.name;
          return {
            name: displayName,
            lat: matched.latitude,
            lon: matched.longitude,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Open-Meteo geocoding request error:', err);
  }

  // 4. Fallback to OpenStreetMap Nominatim (supports zip codes, specific neighborhoods)
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      clean
    )}&format=json&limit=1`;
    const res = await fetch(nominatimUrl, {
      headers: { 'Accept-Language': 'en' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const top = data[0];
        const partsName = (top.display_name || '').split(', ');
        const shortName = partsName.length > 2 ? `${partsName[0]}, ${partsName[partsName.length - 1]}` : top.display_name;
        return {
          name: shortName || clean,
          lat: parseFloat(top.lat),
          lon: parseFloat(top.lon),
        };
      }
    }
  } catch (err) {
    console.warn('Nominatim geocoding error:', err);
  }

  // 5. Substring fuzzy match in dictionary
  for (const [key, cityInfo] of Object.entries(BUILTIN_CITIES)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return cityInfo;
    }
  }

  return null;
}

/**
 * Detects the user's real geographic location via browser HTML5 Geolocation API,
 * and performs reverse-geocoding to determine their city name.
 */
export async function detectBrowserLocation(): Promise<{
  lat: number;
  lon: number;
  city: string;
} | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    console.warn('Browser geolocation is unavailable');
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let city = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;

        // Attempt reverse geocoding via BigDataCloud (free, client-side, CORS allowed)
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          );
          if (res.ok) {
            const data = await res.json();
            const cityName = data.city || data.locality || data.principalSubdivision;
            const region = data.principalSubdivisionCode?.replace('US-', '') || data.countryCode;
            if (cityName) {
              city = region ? `${cityName}, ${region}` : cityName;
            }
          }
        } catch {
          // If BigDataCloud is unreachable, try Nominatim
          try {
            const nomRes = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
            );
            if (nomRes.ok) {
              const data = await nomRes.json();
              const addr = data.address;
              const cityName = addr?.city || addr?.town || addr?.village || addr?.county;
              const state = addr?.state;
              if (cityName) {
                city = state ? `${cityName}, ${state}` : cityName;
              }
            }
          } catch {
            // Keep coordinates representation
          }
        }

        resolve({ lat, lon, city });
      },
      (err) => {
        console.warn('Geolocation failed or permission denied:', err.message);
        resolve(null);
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  });
}

const WEATHER_CACHE_PREFIX = 'famcal_live_weather_v4';

function getStoredWeatherCache(lat: number, lon: number, units: 'F' | 'C'): WeatherData | null {
  try {
    // Purge old unversioned/unisolated caches
    localStorage.removeItem('famcal_live_weather_cache');
    localStorage.removeItem('famcal_live_weather_v2');
    localStorage.removeItem('famcal_live_weather_v3');
    const key = `${WEATHER_CACHE_PREFIX}_${lat.toFixed(2)}_${lon.toFixed(2)}_${units}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Cache valid for up to 30 minutes and must have at least 4 forecast days
    if (
      parsed &&
      parsed.timestamp &&
      Date.now() - parsed.timestamp < 30 * 60 * 1000 &&
      parsed.data &&
      Array.isArray(parsed.data.forecast) &&
      parsed.data.forecast.length >= 4
    ) {
      return parsed.data as WeatherData;
    }
    return null;
  } catch {
    return null;
  }
}

function setStoredWeatherCache(lat: number, lon: number, units: 'F' | 'C', data: WeatherData) {
  try {
    const key = `${WEATHER_CACHE_PREFIX}_${lat.toFixed(2)}_${lon.toFixed(2)}_${units}`;
    localStorage.setItem(
      key,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch {
    // ignore
  }
}

/**
 * Fetches real station observation data from wttr.in (WorldWeatherOnline/METAR engine).
 * Completely free, no API key required, with native CORS enabled.
 * Takes direct municipality names (e.g. "Elora, Ontario") without requiring coordinates.
 */
export async function fetchWttrWeather(
  locationQuery: string,
  units: 'F' | 'C' = 'C'
): Promise<WeatherData | null> {
  const clean = locationQuery.trim();
  if (!clean) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://wttr.in/${encodeURIComponent(clean)}?format=j1`, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'en' },
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`wttr.in returned HTTP ${res.status}`);
    const data = await res.json();
    const current = data.current_condition?.[0];
    if (!current) throw new Error('wttr.in returned no current condition');

    const rawTemp = units === 'F' ? parseInt(current.temp_F, 10) : parseInt(current.temp_C, 10);
    const temp = isNaN(rawTemp) ? (units === 'F' ? 70 : 20) : rawTemp;
    const desc = current.weatherDesc?.[0]?.value?.trim() || 'Clear';
    const code = parseInt(current.weatherCode, 10) || 113;
    const condInfo = getWeatherConditionInfo(code, desc);
    const humidity = parseInt(current.humidity, 10) || 50;

    // Daily Forecasts
    const weatherDays = data.weather || [];
    const today = weatherDays[0];
    const high = today
      ? Math.round(units === 'F' ? parseFloat(today.maxtempF) : parseFloat(today.maxtempC))
      : temp + 4;
    const low = today
      ? Math.round(units === 'F' ? parseFloat(today.mintempF) : parseFloat(today.mintempC))
      : temp - 5;

    const forecast: DailyForecast[] = [];
    const maxDays = Math.min(5, weatherDays.length);
    for (let i = 1; i < maxDays; i++) {
      const day = weatherDays[i];
      const dayDate = day.date;
      let dayName = 'Day';
      try {
        const d = new Date(`${dayDate}T12:00:00`);
        dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      } catch {
        const d = new Date(Date.now() + i * 86400000);
        dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      }

      // Midday hour index (approx index 4 is noon)
      const noonHour = day.hourly?.[4] || day.hourly?.[0];
      const dayDesc = noonHour?.weatherDesc?.[0]?.value?.trim() || 'Clear';
      const dayCode = parseInt(noonHour?.weatherCode || '113', 10);
      const dayCond = getWeatherConditionInfo(dayCode, dayDesc);
      const dayMax = Math.round(units === 'F' ? parseFloat(day.maxtempF) : parseFloat(day.maxtempC));
      const dayMin = Math.round(units === 'F' ? parseFloat(day.mintempF) : parseFloat(day.mintempC));

      forecast.push({
        date: dayDate,
        dayName,
        tempMax: dayMax,
        tempMin: dayMin,
        condition: dayCond.text,
        conditionCode: dayCode,
        icon: dayCond.icon,
      });
    }

    return {
      temp,
      condition: condInfo.text,
      conditionCode: code,
      high,
      low,
      humidity,
      city: clean,
      icon: condInfo.icon,
      forecast,
    };
  } catch (err) {
    console.warn('wttr.in request failed:', err);
    return null;
  }
}

/**
 * Fetches hyper-local station weather data from WeatherAPI.com (if user provided an API key).
 * Free tier offers 1,000,000 calls/month with no credit card required.
 */
export async function fetchWeatherApiCom(
  apiKey: string,
  locationQuery: string,
  units: 'F' | 'C' = 'C'
): Promise<WeatherData | null> {
  const cleanKey = apiKey.trim();
  const cleanLoc = locationQuery.trim();
  if (!cleanKey || !cleanLoc) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(
      cleanKey
    )}&q=${encodeURIComponent(cleanLoc)}&days=5&aqi=no&alerts=no`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`WeatherAPI.com returned HTTP ${res.status}`);
    const data = await res.json();
    if (!data.current || !data.forecast?.forecastday) throw new Error('Invalid WeatherAPI payload');

    const temp = Math.round(units === 'F' ? data.current.temp_f : data.current.temp_c);
    const condText = data.current.condition?.text?.trim() || 'Clear';
    const condCode = data.current.condition?.code || 1000;
    const condInfo = getWeatherConditionInfo(condCode, condText);
    const today = data.forecast.forecastday[0]?.day;
    const high = Math.round(units === 'F' ? today?.maxtemp_f ?? temp + 4 : today?.maxtemp_c ?? temp + 4);
    const low = Math.round(units === 'F' ? today?.mintemp_f ?? temp - 5 : today?.mintemp_c ?? temp - 5);
    const humidity = data.current.humidity || 50;

    const forecast: DailyForecast[] = [];
    const days = data.forecast.forecastday.slice(1, 5);
    for (const dayItem of days) {
      let dayName = 'Day';
      try {
        const d = new Date(`${dayItem.date}T12:00:00`);
        dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      } catch {
        dayName = 'Day';
      }
      const dayCondText = dayItem.day?.condition?.text?.trim() || 'Clear';
      const dayCondCode = dayItem.day?.condition?.code || 1000;
      const dayCond = getWeatherConditionInfo(dayCondCode, dayCondText);
      forecast.push({
        date: dayItem.date,
        dayName,
        tempMax: Math.round(units === 'F' ? dayItem.day?.maxtemp_f : dayItem.day?.maxtemp_c),
        tempMin: Math.round(units === 'F' ? dayItem.day?.mintemp_f : dayItem.day?.mintemp_c),
        condition: dayCond.text,
        conditionCode: dayCondCode,
        icon: dayCond.icon,
      });
    }

    const locDisplayName = data.location?.name
      ? `${data.location.name}, ${data.location.region || data.location.country}`
      : cleanLoc;

    return {
      temp,
      condition: condInfo.text,
      conditionCode: condCode,
      high,
      low,
      humidity,
      city: locDisplayName,
      icon: condInfo.icon,
      forecast,
    };
  } catch (err) {
    console.warn('WeatherAPI.com request error:', err);
    return null;
  }
}

/**
 * Fetches high-resolution meteorological weather from Open-Meteo using Environment Canada (GEM)
 * and ECMWF forecast models with automatic coordinate resolution.
 */
export async function fetchOpenMeteoWeather(
  lat: number,
  lon: number,
  cityName: string,
  units: 'F' | 'C' = 'C'
): Promise<WeatherData | null> {
  const tempUnitParam = units === 'F' ? '&temperature_unit=fahrenheit' : '';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(
    4
  )}&longitude=${lon.toFixed(
    4
  )}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto${tempUnitParam}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Open-Meteo returned HTTP ${res.status}`);
    const data = await res.json();

    const currentCode = data.current?.weather_code ?? 0;
    const cond = getWmoCondition(currentCode);
    const temp = Math.round(data.current?.temperature_2m ?? (units === 'F' ? 70 : 21));
    const high = Math.round(data.daily?.temperature_2m_max?.[0] ?? temp + 4);
    const low = Math.round(data.daily?.temperature_2m_min?.[0] ?? temp - 6);
    const humidity = Math.round(data.current?.relative_humidity_2m ?? 45);

    // Extract next 4-day forecast outlook
    const forecast: DailyForecast[] = [];
    const dailyTimes = data.daily?.time || [];
    const dailyCodes = data.daily?.weather_code || [];
    const dailyMaxs = data.daily?.temperature_2m_max || [];
    const dailyMins = data.daily?.temperature_2m_min || [];

    for (let i = 1; i <= 4; i++) {
      const timeStr = dailyTimes[i];
      let dayName = 'Day';
      if (timeStr) {
        try {
          const d = new Date(`${timeStr}T12:00:00`);
          dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
        } catch {
          // ignore
        }
      } else {
        const d = new Date(Date.now() + i * 86400000);
        dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      }

      const code = dailyCodes[i] ?? 0;
      const dayCond = getWmoCondition(code);
      const dayMax = Math.round(dailyMaxs[i] ?? temp);
      const dayMin = Math.round(dailyMins[i] ?? temp - 8);

      forecast.push({
        date: timeStr || new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
        dayName,
        tempMax: dayMax,
        tempMin: dayMin,
        condition: dayCond.text,
        conditionCode: code,
        icon: dayCond.icon,
      });
    }

    return {
      temp,
      condition: cond.text,
      conditionCode: currentCode,
      high,
      low,
      humidity,
      city: cityName,
      icon: cond.icon,
      forecast,
    };
  } catch (err) {
    console.warn('Open-Meteo request error:', err);
    return null;
  }
}

/**
 * Universal Multi-Provider Weather Fetcher:
 * 1. WeatherAPI.com (if API key is supplied by user).
 * 2. wttr.in (live station observations, queried directly by municipality name, keyless, CORS enabled).
 * 3. Open-Meteo (high-resolution meteorological models with intelligent coordinate resolution).
 * 4. Coordinate & unit-keyed localStorage cache.
 * 5. Realistic baseline fallback.
 */
export async function fetchLiveWeather(
  lat: number = 43.6834,
  lon: number = -80.4329,
  cityName: string = 'Elora, Ontario',
  units: 'F' | 'C' = 'C',
  apiKey?: string,
  preferredProvider: 'auto' | 'wttr' | 'openmeteo' | 'weatherapi' = 'auto'
): Promise<WeatherData> {
  const cleanCity = cityName.trim() || 'Elora, Ontario';

  // Resolve target coordinates
  let targetLat = lat;
  let targetLon = lon;

  const cleanLower = cleanCity.toLowerCase();
  const normalized = cleanLower
    .replace(/,\s*[a-z]{2,}(\s+usa|\s+us|\s+ca|\s+canada)?$/i, '')
    .trim();
  const known = BUILTIN_CITIES[cleanLower] || BUILTIN_CITIES[normalized];
  if (known) {
    targetLat = known.lat;
    targetLon = known.lon;
  } else {
    const isDefaultSf = Math.abs(lat - 37.7749) < 0.01 && Math.abs(lon - (-122.4194)) < 0.01;
    const isDefaultNy = Math.abs(lat - 40.7128) < 0.01 && Math.abs(lon - (-74.006)) < 0.01;
    const isSfName = cleanCity.toLowerCase().includes('san francisco');
    if ((isDefaultSf && !isSfName) || isDefaultNy) {
      try {
        const resolved = await geocodeLocation(cleanCity);
        if (resolved) {
          targetLat = resolved.lat;
          targetLon = resolved.lon;
        }
      } catch {
        // retain
      }
    }
  }

  // 1. WeatherAPI.com (if key provided or chosen)
  if ((apiKey || preferredProvider === 'weatherapi') && apiKey?.trim()) {
    const wApiRes = await fetchWeatherApiCom(apiKey, cleanCity, units);
    if (wApiRes && wApiRes.forecast.length >= 4) {
      setStoredWeatherCache(targetLat, targetLon, units, wApiRes);
      return wApiRes;
    }
  }

  // 2. Open-Meteo (Primary for 'auto' and 'openmeteo': high-resolution official meteorological models with exact coordinates and guaranteed 4-day outlook)
  if (preferredProvider === 'auto' || preferredProvider === 'openmeteo') {
    const omRes = await fetchOpenMeteoWeather(targetLat, targetLon, cleanCity, units);
    if (omRes && omRes.forecast.length >= 4) {
      setStoredWeatherCache(targetLat, targetLon, units, omRes);
      return omRes;
    }
  }

  // 3. wttr.in (live station observations by municipality name)
  if (preferredProvider === 'auto' || preferredProvider === 'wttr') {
    const wttrRes = await fetchWttrWeather(cleanCity, units);
    if (wttrRes) {
      if (wttrRes.forecast.length < 4) {
        // Guarantee full 4-day outlook by fetching forecast days from Open-Meteo
        const omRes = await fetchOpenMeteoWeather(targetLat, targetLon, cleanCity, units);
        if (omRes?.forecast && omRes.forecast.length >= 4) {
          wttrRes.forecast = omRes.forecast;
        }
      }
      setStoredWeatherCache(targetLat, targetLon, units, wttrRes);
      return wttrRes;
    }
  }

  // 4. Stored Cache Fallback
  const cached = getStoredWeatherCache(targetLat, targetLon, units);
  if (cached && cached.forecast.length >= 4) {
    return {
      ...cached,
      city: cleanCity || cached.city,
    };
  }

  // 5. Seasonal fallback with guaranteed 4-day outlook
  const fallbackForecast: DailyForecast[] = [1, 2, 3, 4].map((offset) => {
    const d = new Date(Date.now() + offset * 86400000);
    const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
    const offsets = [
      { max: 70, min: 52, cond: 'Partly Cloudy', code: 2, icon: 'cloud-sun' },
      { max: 68, min: 50, cond: 'Clear Sky', code: 0, icon: 'sun' },
      { max: 65, min: 48, cond: 'Rain Showers', code: 61, icon: 'cloud-rain' },
      { max: 66, min: 49, cond: 'Mainly Clear', code: 1, icon: 'sun' },
    ];
    const sample = offsets[offset - 1] || offsets[0];
    const tempMax = units === 'F' ? sample.max : Math.round(((sample.max - 32) * 5) / 9);
    const tempMin = units === 'F' ? sample.min : Math.round(((sample.min - 32) * 5) / 9);

    return {
      date: d.toISOString().split('T')[0],
      dayName,
      tempMax,
      tempMin,
      condition: sample.cond,
      conditionCode: sample.code,
      icon: sample.icon,
    };
  });

  return {
    temp: units === 'F' ? 64 : 18,
    condition: 'Partly Cloudy',
    conditionCode: 2,
    high: units === 'F' ? 68 : 20,
    low: units === 'F' ? 50 : 10,
    humidity: 60,
    city: cleanCity,
    icon: 'cloud-sun',
    forecast: fallbackForecast,
  };
}
