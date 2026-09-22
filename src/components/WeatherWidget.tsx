import React from 'react';
import { WeatherData } from '../types';
import { Sun, CloudSun, Cloud, CloudRain, Snowflake, Zap, CloudFog } from 'lucide-react';

interface WeatherWidgetProps {
  weather: WeatherData | null;
  units?: 'F' | 'C';
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather, units = 'F' }) => {
  if (!weather) return null;

  const renderIcon = () => {
    switch (weather.icon) {
      case 'sun':
        return <Sun className="w-5 h-5 text-amber-400 animate-[spin_12s_linear_infinite]" />;
      case 'cloud-sun':
        return <CloudSun className="w-5 h-5 text-amber-300" />;
      case 'cloud':
        return <Cloud className="w-5 h-5 text-slate-300" />;
      case 'cloud-rain':
      case 'cloud-drizzle':
        return <CloudRain className="w-5 h-5 text-sky-400" />;
      case 'snowflake':
        return <Snowflake className="w-5 h-5 text-blue-200" />;
      case 'cloud-lightning':
        return <Zap className="w-5 h-5 text-yellow-400" />;
      case 'cloud-fog':
        return <CloudFog className="w-5 h-5 text-slate-400" />;
      default:
        return <Sun className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 text-white shadow-lg shadow-black/40 select-none">
      <div className="flex-shrink-0">{renderIcon()}</div>
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-black tracking-tight leading-none">
            {weather.temp}°
          </span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase">
            {units}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
          <span>{weather.condition}</span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">
            H:{weather.high}° L:{weather.low}°
          </span>
        </div>
      </div>
    </div>
  );
};
