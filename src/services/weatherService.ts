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

export async function fetchLiveWeather(
  lat: number = 40.7128,
  lon: number = -74.006,
  cityName: string = 'New York',
  units: 'F' | 'C' = 'F'
): Promise<WeatherData> {
  const tempUnitParam = units === 'F' ? '&temperature_unit=fahrenheit' : '';
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto${tempUnitParam}`;

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

    // Extract next 4-day forecast outlook (indices 1 through 4)
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
      const dayMin = Math.round(dailyMins[i] ?? (temp - 8));

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
  } catch (error) {
    console.warn('Using fallback weather data due to network error:', error);
    const fallbackForecast: DailyForecast[] = [1, 2, 3, 4].map((offset) => {
      const d = new Date(Date.now() + offset * 86400000);
      const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      const offsets = [
        { max: 75, min: 58, cond: 'Partly Cloudy', code: 2, icon: 'cloud-sun' },
        { max: 72, min: 55, cond: 'Sunny', code: 0, icon: 'sun' },
        { max: 68, min: 53, cond: 'Rain Showers', code: 61, icon: 'cloud-rain' },
        { max: 74, min: 57, cond: 'Clear Sky', code: 0, icon: 'sun' },
      ];
      const sample = offsets[offset - 1] || offsets[0];
      const tempMax = units === 'F' ? sample.max : Math.round((sample.max - 32) * (5 / 9));
      const tempMin = units === 'F' ? sample.min : Math.round((sample.min - 32) * (5 / 9));

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
      temp: units === 'F' ? 72 : 22,
      condition: 'Partly Cloudy',
      conditionCode: 2,
      high: units === 'F' ? 76 : 24,
      low: units === 'F' ? 62 : 17,
      humidity: 48,
      city: cityName,
      icon: 'cloud-sun',
      forecast: fallbackForecast,
    };
  }
}
