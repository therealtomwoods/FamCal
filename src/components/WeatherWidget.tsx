import React from 'react';
import { WeatherData } from '../types';
import { Sun, CloudSun, Cloud, CloudRain, Snowflake, Zap, CloudFog } from 'lucide-react';

interface WeatherWidgetProps {
  weather: WeatherData | null;
  units?: 'F' | 'C';
}

const renderWeatherIcon = (iconName: string, className = 'w-4 h-4') => {
  switch (iconName) {
    case 'sun':
      return <Sun className={`${className} text-amber-400 animate-[spin_12s_linear_infinite]`} />;
    case 'cloud-sun':
      return <CloudSun className={`${className} text-amber-300`} />;
    case 'cloud':
      return <Cloud className={`${className} text-slate-300`} />;
    case 'cloud-rain':
    case 'cloud-drizzle':
      return <CloudRain className={`${className} text-sky-400`} />;
    case 'snowflake':
      return <Snowflake className={`${className} text-blue-200`} />;
    case 'cloud-lightning':
      return <Zap className={`${className} text-yellow-400`} />;
    case 'cloud-fog':
      return <CloudFog className={`${className} text-slate-400`} />;
    default:
      return <Sun className={`${className} text-amber-400`} />;
  }
};

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, units = 'F' }) => {
  if (!weather) return null;

  const forecastDays = weather.forecast?.slice(0, 4) || [];

  return (
    <div className="flex items-center gap-3 px-3.5 py-2 sm:py-2.5 rounded-xl bg-slate-900/90 border border-white/15 text-white select-none flex-shrink-0 shadow-md backdrop-blur-md">
      {/* Today's Current Weather */}
      <div className="flex items-center gap-2.5">
        <div className="flex-shrink-0">
          {renderWeatherIcon(weather.icon, 'w-7 h-7 sm:w-8 sm:h-8')}
        </div>
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-black tracking-tight leading-none text-white">
              {weather.temp}°
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {units}
            </span>
            <span className="text-xs font-medium text-slate-400 ml-1">
              Today
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-300 leading-tight mt-1">
            <span className="truncate max-w-[100px] font-semibold text-slate-200">{weather.city}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300 font-medium">H:{weather.high}° L:{weather.low}°</span>
          </div>
        </div>
      </div>

      {/* Next 4-Day Outlook */}
      {forecastDays.length > 0 && (
        <div className="flex items-center gap-2 pl-3 border-l border-white/15">
          {forecastDays.map((day, idx) => (
            <div
              key={day.date || idx}
              title={`${day.dayName}: ${day.condition}, High ${day.tempMax}°, Low ${day.tempMin}°`}
              className="flex flex-col items-center justify-center px-2 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800/90 transition"
            >
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                {day.dayName}
              </span>
              <div className="my-1">
                {renderWeatherIcon(day.icon, 'w-4 h-4 sm:w-4.5 sm:h-4.5')}
              </div>
              <div className="flex items-center gap-0.5 text-xs leading-none">
                <span className="font-bold text-white">{day.tempMax}°</span>
                <span className="text-slate-500 text-[10px]">/</span>
                <span className="text-slate-300 font-medium">{day.tempMin}°</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
