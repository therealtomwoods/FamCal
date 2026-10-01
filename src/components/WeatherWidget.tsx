import React, { useState } from 'react';
import { WeatherData } from '../types';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  Snowflake,
  Zap,
  CloudFog,
  X,
  Calendar,
  Droplets,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface WeatherWidgetProps {
  weather: WeatherData | null;
  units?: 'F' | 'C';
}

export const renderWeatherIcon = (iconName: string, className = 'w-4 h-4') => {
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
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  if (!weather) return null;

  const forecastDays = weather.forecast?.slice(0, 4) || [];

  return (
    <>
      <div
        onClick={() => setIsDetailOpen(true)}
        className="flex items-center gap-2.5 sm:gap-3 px-3 py-2 sm:py-2.5 rounded-xl bg-slate-900/90 border border-white/15 hover:border-blue-500/40 hover:bg-slate-900 text-white select-none flex-shrink-0 shadow-md backdrop-blur-md cursor-pointer transition-all group"
        title="Click to open detailed 4-day weather outlook"
      >
        {/* Today's Current Weather */}
        <div className="flex items-center gap-2 sm:gap-2.5">
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
              <span className="truncate max-w-[90px] sm:max-w-[120px] font-semibold text-slate-200" title={weather.city}>
                {weather.city}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300 font-medium">H:{weather.high}° L:{weather.low}°</span>
            </div>
          </div>
        </div>

        {/* Next 4-Day Outlook */}
        {forecastDays.length > 0 && (
          <div className="flex items-center gap-1.5 pl-2.5 sm:pl-3 border-l border-white/15">
            <div className="flex flex-col justify-center items-center mr-0.5 select-none text-center">
              <span className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase tracking-tight leading-none">
                4-Day
              </span>
              <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tight leading-none mt-0.5">
                Outlook
              </span>
            </div>

            {forecastDays.map((day, idx) => (
              <div
                key={day.date || idx}
                title={`${day.dayName}: ${day.condition}, High ${day.tempMax}°, Low ${day.tempMin}°`}
                className="flex flex-col items-center justify-center px-1.5 sm:px-2 py-1 rounded-lg bg-slate-800/70 group-hover:bg-slate-800/90 border border-white/5 transition"
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

      {/* Expanded 4-Day Outlook Modal */}
      {isDetailOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setIsDetailOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-slate-900 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  {renderWeatherIcon(weather.icon, 'w-6 h-6')}
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white">{weather.city}</h3>
                  <p className="text-xs text-slate-400 font-medium">4-Day Weather Outlook &amp; Forecast</p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Conditions Card */}
            <div className="my-4 p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-850 border border-blue-500/20 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">Today&apos;s Conditions</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">{weather.temp}°{units}</span>
                  <span className="text-sm font-semibold text-slate-300">{weather.condition}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 flex-wrap">
                  <span className="flex items-center gap-1 font-medium text-emerald-300">
                    <ArrowUp className="w-3.5 h-3.5" /> High: {weather.high}°{units}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-sky-300">
                    <ArrowDown className="w-3.5 h-3.5" /> Low: {weather.low}°{units}
                  </span>
                  {weather.humidity !== undefined && (
                    <span className="flex items-center gap-1 font-medium text-slate-300">
                      <Droplets className="w-3.5 h-3.5 text-blue-400" /> {weather.humidity}%
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center">
                {renderWeatherIcon(weather.icon, 'w-10 h-10 sm:w-12 sm:h-12')}
              </div>
            </div>

            {/* 4-Day Outlook Grid */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  Upcoming 4-Day Outlook
                </span>
                <span className="text-[11px] text-slate-500">Live Forecast</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {forecastDays.map((day, idx) => (
                  <div
                    key={day.date || idx}
                    className="p-3 rounded-2xl bg-slate-800/80 border border-white/10 flex flex-col items-center text-center hover:border-white/20 transition"
                  >
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      {day.dayName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium mb-1.5">
                      {day.date ? new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                    </span>

                    <div className="my-1.5 p-2 rounded-xl bg-slate-900/60 border border-white/5">
                      {renderWeatherIcon(day.icon, 'w-7 h-7')}
                    </div>

                    <span className="text-xs font-semibold text-slate-200 mt-1 truncate max-w-full leading-tight">
                      {day.condition}
                    </span>

                    <div className="flex items-baseline gap-1 mt-2">
                      <span className="text-sm font-black text-white">{day.tempMax}°</span>
                      <span className="text-[11px] text-slate-500">/</span>
                      <span className="text-xs font-semibold text-slate-400">{day.tempMin}°</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Live meteorological model forecast
              </span>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
