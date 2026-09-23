import React, { useState, useEffect } from 'react';
import { CalendarEvent, CalendarInfo, WeatherData, StockItem, NestThermostatState } from '../types';
import { EventCard } from './EventCard';
import { WeatherWidget } from './WeatherWidget';
import { StockTickerWidget } from './StockTickerWidget';
import { NestThermostatWidget } from './NestThermostatWidget';
import { Calendar as CalendarIcon, Filter, CheckCircle2 } from 'lucide-react';

interface AgendaCalendarProps {
  events: CalendarEvent[];
  calendars: CalendarInfo[];
  selectedCalendarIds: string[];
  militaryTime?: boolean;
  onOpenCalendarFilter: () => void;
  isLoading?: boolean;
  agendaTitle?: string;
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
  agendaTitle = 'Family Agenda',
  weather = null,
  stock = null,
  thermostat = null,
  showWeather = true,
  showStockTicker = true,
  showNestThermostat = true,
  weatherUnits = 'F',
  onAdjustNestTemp,
}) => {
  // Live current time tracker (auto-refreshes every 30s so past events drop off in real time)
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Group events by day key (YYYY-MM-DD), filtering out any events whose start time has already passed
  const groupedEvents: Record<string, CalendarEvent[]> = {};

  const todayKey = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(
    currentTime.getDate()
  ).padStart(2, '0')}`;

  const tomorrow = new Date(currentTime);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  events.forEach((event) => {
    // If an event start time is before the current time of day, do not show it (it has passed, only show future events)
    const isPast = event.allDay
      ? event.end.getTime() < currentTime.getTime()
      : event.start.getTime() < currentTime.getTime();

    if (isPast) {
      return;
    }

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
    const dayNumber = String(day);

    if (dateKey === todayKey) {
      return {
        dayNumber,
        label: 'Today',
        weekday,
        dateFormatted: monthName,
        isToday: true,
      };
    }
    if (dateKey === tomorrowKey) {
      return {
        dayNumber,
        label: 'Tomorrow',
        weekday,
        dateFormatted: monthName,
        isToday: false,
      };
    }
    return {
      dayNumber,
      label: weekday,
      weekday,
      dateFormatted: monthName,
      isToday: false,
    };
  };

  const activeCalendars = calendars.filter((c) => selectedCalendarIds.includes(c.id));

  return (
    <div className="flex flex-col h-full bg-black overflow-hidden">
      {/* ========================================================================= */}
      {/* IN-LINE FAMILY AGENDA HEADER & STATUS RIBBON */}
      {/* ========================================================================= */}
      <div className="flex-shrink-0 px-3 sm:px-4 py-3 sm:py-3.5 bg-black border-b border-white/15 backdrop-blur-md z-10 select-none">
        <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar">
          {/* Left: Family Agenda Title */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <CalendarIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-wide whitespace-nowrap">
              {agendaTitle || 'Family Agenda'}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-white/10">
              {events.length}
            </span>
          </div>

          {/* Center: In-Line Widgets (Weather, Live Stock, Nest) */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
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
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-xs sm:text-sm font-semibold text-white transition shadow-sm flex-shrink-0"
            title="Filter Active Calendars"
          >
            <Filter className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Calendars</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold">
              {activeCalendars.length}
            </span>
          </button>
        </div>
      </div>

      {/* Active Calendars Quick Color Pills */}
      <div className="flex-shrink-0 px-4 py-1.5 bg-black border-b border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {activeCalendars.map((cal) => (
          <span
            key={cal.id}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/5 border border-white/10 text-slate-300 flex-shrink-0"
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
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-2 space-y-4 bg-black">
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
            const { dayNumber, label, weekday, dateFormatted, isToday } = formatHeaderDate(dateKey);

            return (
              <div key={dateKey} className="space-y-1">
                {/* Day Header - Clean White on Black */}
                <div className="sticky top-0 z-10 flex items-baseline justify-between pt-3 pb-2 px-1 bg-black/95 backdrop-blur-md border-b border-white/15">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {dayNumber}
                    </span>
                    <span
                      className={`text-lg sm:text-xl font-bold tracking-tight ${
                        isToday ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {label}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-slate-500 ml-1">
                      {isToday ? `${weekday}, ${dateFormatted}` : dateFormatted}
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-slate-500">
                    {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                  </span>
                </div>

                {/* Day Events or Empty State */}
                {dayEvents.length === 0 ? (
                  <div className="py-3 px-2 text-slate-500 text-xs sm:text-sm font-medium italic">
                    {isToday ? 'No more events today' : 'No events scheduled'}
                  </div>
                ) : (
                  <div className="space-y-0.5">
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
