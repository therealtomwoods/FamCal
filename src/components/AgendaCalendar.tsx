import React from 'react';
import { CalendarEvent, CalendarInfo, WeatherData, StockItem, NestThermostatState } from '../types';
import { EventCard } from './EventCard';
import { WeatherWidget } from './WeatherWidget';
import { StockTickerWidget } from './StockTickerWidget';
import { NestThermostatWidget } from './NestThermostatWidget';
import { Calendar as CalendarIcon, Filter, CheckCircle2, Sparkles } from 'lucide-react';

interface AgendaCalendarProps {
  events: CalendarEvent[];
  calendars: CalendarInfo[];
  selectedCalendarIds: string[];
  militaryTime?: boolean;
  onOpenCalendarFilter: () => void;
  isLoading?: boolean;
  // In-line Ribbon Widgets
  weather?: WeatherData | null;
  stock?: StockItem | null;
  thermostat?: NestThermostatState | null;
  showWeather?: boolean;
  showStockTicker?: boolean;
  showNestThermostat?: boolean;
  weatherUnits?: 'F' | 'C';
  onAdjustNestTemp?: (delta: number) => void;
}

export const AgendaCalendar: React.FC<AgendaCalendarProps> = ({
  events,
  calendars,
  selectedCalendarIds,
  militaryTime = false,
  onOpenCalendarFilter,
  isLoading = false,
  weather = null,
  stock = null,
  thermostat = null,
  showWeather = true,
  showStockTicker = true,
  showNestThermostat = true,
  weatherUnits = 'F',
  onAdjustNestTemp,
}) => {
  // Group events by day key (YYYY-MM-DD)
  const groupedEvents: Record<string, CalendarEvent[]> = {};

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  events.forEach((event) => {
    const key = `${event.start.getFullYear()}-${String(event.start.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(event.start.getDate()).padStart(2, '0')}`;

    if (!groupedEvents[key]) {
      groupedEvents[key] = [];
    }
    groupedEvents[key].push(event);
  });

  if (!groupedEvents[todayKey]) groupedEvents[todayKey] = [];
  if (!groupedEvents[tomorrowKey]) groupedEvents[tomorrowKey] = [];

  const sortedDateKeys = Object.keys(groupedEvents).sort();

  const formatHeaderDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);

    const weekday = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
    const monthName = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    if (dateKey === todayKey) {
      return {
        badge: 'TODAY',
        weekday,
        dateFormatted: monthName,
        isToday: true,
      };
    }
    if (dateKey === tomorrowKey) {
      return {
        badge: 'TOMORROW',
        weekday,
        dateFormatted: monthName,
        isToday: false,
      };
    }
    return {
      badge: weekday.toUpperCase(),
      weekday,
      dateFormatted: monthName,
      isToday: false,
    };
  };

  const activeCalendars = calendars.filter((c) => selectedCalendarIds.includes(c.id));

  return (
    <div className="flex flex-col h-full bg-slate-950/95 overflow-hidden">
      {/* ========================================================================= */}
      {/* IN-LINE FAMILY AGENDA HEADER & STATUS RIBBON */}
      {/* ========================================================================= */}
      <div className="flex-shrink-0 px-3 py-2 bg-gradient-to-r from-slate-900/95 via-slate-900/90 to-slate-950/95 border-b border-white/10 backdrop-blur-md z-10 select-none shadow-md">
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          {/* Left: Family Agenda Title */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <CalendarIcon className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide whitespace-nowrap">
              Family Agenda
            </h2>
            <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-semibold border border-white/5">
              {events.length}
            </span>
          </div>

          {/* Center: In-Line Widgets (Weather, Live Stock, Nest) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {showWeather && (
              <WeatherWidget weather={weather} units={weatherUnits} />
            )}

            {showStockTicker && (
              <StockTickerWidget stock={stock} />
            )}

            {showNestThermostat && (
              <NestThermostatWidget
                thermostat={thermostat}
                onAdjustTemp={onAdjustNestTemp}
              />
            )}
          </div>

          {/* Right: Calendars Filter Button */}
          <button
            onClick={onOpenCalendarFilter}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-semibold text-white transition shadow-sm flex-shrink-0"
            title="Filter Active Calendars"
          >
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Calendars</span>
            <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
              {activeCalendars.length}
            </span>
          </button>
        </div>
      </div>

      {/* Active Calendars Quick Color Pills */}
      <div className="flex-shrink-0 px-4 py-1.5 bg-slate-950 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {activeCalendars.map((cal) => (
          <span
            key={cal.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-900 border border-white/5 text-slate-300 flex-shrink-0"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: cal.backgroundColor }}
            />
            <span className="truncate max-w-[100px]">{cal.summary}</span>
          </span>
        ))}
      </div>

      {/* Agenda Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium">Syncing Google Calendars...</p>
          </div>
        ) : sortedDateKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 opacity-80" />
            <h3 className="text-base font-semibold text-white">All Clear!</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              No upcoming events scheduled across your active calendars.
            </p>
          </div>
        ) : (
          sortedDateKeys.map((dateKey) => {
            const dayEvents = groupedEvents[dateKey] || [];
            const { badge, weekday, dateFormatted, isToday } = formatHeaderDate(dateKey);

            return (
              <div key={dateKey} className="space-y-2">
                {/* Day Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between py-1 px-2 rounded-lg bg-slate-950/90 backdrop-blur-md border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-md tracking-wider uppercase ${
                        isToday
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {badge}
                    </span>
                    <span className="text-sm font-bold text-white">{weekday},</span>
                    <span className="text-sm font-medium text-slate-400">{dateFormatted}</span>
                  </div>

                  <span className="text-xs font-semibold text-slate-400">
                    {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                  </span>
                </div>

                {/* Day Events or Empty State */}
                {dayEvents.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-900/40 border border-white/5 flex items-center gap-2 text-slate-400 text-xs">
                    <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span>Nothing scheduled yet for this day. Free time for the family!</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayEvents.map((evt) => (
                      <EventCard key={evt.id} event={evt} militaryTime={militaryTime} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
