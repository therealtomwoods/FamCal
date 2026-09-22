import { WeatherData } from '../types';

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

export async function fetchLiveWeather(
  lat: number = 40.7128,
  lon: number = -74.006,
  cityName: string = 'New York',
  units: 'F' | 'C' = 'F'
): Promise<WeatherData> {
  const tempUnitParam = units === 'F' ? '&temperature_unit=fahrenheit' : '';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto${tempUnitParam}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch failed');
    const data = await res.json();

    const currentCode = data.current?.weather_code ?? 0;
    const cond = getWmoCondition(currentCode);
    const temp = Math.round(data.current?.temperature_2m ?? (units === 'F' ? 72 : 22));
    const high = Math.round(data.daily?.temperature_2m_max?.[0] ?? temp + 4);
    const low = Math.round(data.daily?.temperature_2m_min?.[0] ?? temp - 6);
    const humidity = Math.round(data.current?.relative_humidity_2m ?? 45);

    return {
      temp,
      condition: cond.text,
      conditionCode: currentCode,
      high,
      low,
      humidity,
      city: cityName,
      icon: cond.icon,
    };
  } catch (error) {
    console.warn('Using fallback weather data due to network error:', error);
    return {
      temp: units === 'F' ? 72 : 22,
      condition: 'Partly Cloudy',
      conditionCode: 2,
      high: units === 'F' ? 76 : 24,
      low: units === 'F' ? 62 : 17,
      humidity: 48,
      city: cityName,
      icon: 'cloud-sun',
    };
  }
}
