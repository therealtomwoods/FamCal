import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent, CalendarInfo, WeatherData, StockItem } from '../types';
import { EventCard } from './EventCard';
import { WeatherWidget, renderWeatherIcon } from './WeatherWidget';
import { StockTickerWidget } from './StockTickerWidget';
import { Calendar as CalendarIcon, Filter, CheckCircle2, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';

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
  showWeather?: boolean;
  showStockTicker?: boolean;
  weatherUnits?: 'F' | 'C';
  // 4-Column Horizontal Screen Mode
  isFourColumnMode?: boolean;
  // Auto-scroll calendar upwards over ~6s and reset to top
  autoScroll?: boolean;
  onToggleAutoScroll?: () => void;
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
  showWeather = true,
  showStockTicker = true,
  weatherUnits = 'F',
  isFourColumnMode = false,
  autoScroll = true,
  onToggleAutoScroll,
}) => {
  // Live current time tracker (auto-refreshes every 15s and on wake/focus so past events & days drop off immediately)
  const [currentTime, setCurrentTime] = useState(() => new Date());
  // 4-Column mode pagination offset (0 = today to today+3, 4 = today+4 to today+7, etc.)
  const [pageOffset, setPageOffset] = useState<number>(0);

  // Refs for 6-second continuous upward auto-scroll
  const verticalScrollRef = useRef<HTMLDivElement | null>(null);
  const columnScrollRefs = useRef<Array<HTMLDivElement | null>>([]);
  const userInteractionPauseUntilRef = useRef<number>(0);

  // 6-second upward auto-scroll loop (scrolls from top to bottom in 6000ms, reverts to top, and repeats)
  useEffect(() => {
    if (!autoScroll || isLoading) return;

    const SCROLL_DURATION_MS = 6000; // 6 seconds to complete scroll from top to bottom
    const TOP_PAUSE_MS = 1000; // brief pause at top before starting scroll
    const BOTTOM_PAUSE_MS = 1000; // brief pause at bottom before reverting to top

    let rafId: number;
    let cycleStartTime = performance.now();

    const getScrollTargets = (): HTMLDivElement[] => {
      if (isFourColumnMode) {
        return columnScrollRefs.current.filter(
          (el): el is HTMLDivElement => Boolean(el && el.scrollHeight - el.clientHeight > 4)
        );
      }
      const el = verticalScrollRef.current;
      return el && el.scrollHeight - el.clientHeight > 4 ? [el] : [];
    };

    const step = (now: number) => {
      if (Date.now() < userInteractionPauseUntilRef.current) {
        cycleStartTime = now;
        rafId = requestAnimationFrame(step);
        return;
      }

      const targets = getScrollTargets();
      if (targets.length === 0) {
        cycleStartTime = now;
        rafId = requestAnimationFrame(step);
        return;
      }

      const totalCycleMs = TOP_PAUSE_MS + SCROLL_DURATION_MS + BOTTOM_PAUSE_MS;
      const elapsed = (now - cycleStartTime) % totalCycleMs;

      targets.forEach((el) => {
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll <= 0) return;

        if (elapsed < TOP_PAUSE_MS) {
          // At top waiting to start scroll
          if (el.scrollTop !== 0) {
            el.scrollTop = 0;
          }
        } else if (elapsed < TOP_PAUSE_MS + SCROLL_DURATION_MS) {
          // Scrolling upwards (increasing scrollTop from 0 to maxScroll over 6 seconds)
          const progress = (elapsed - TOP_PAUSE_MS) / SCROLL_DURATION_MS;
          el.scrollTop = progress * maxScroll;
        } else {
          // Hold at bottom briefly before reverting to top on next cycle wrap
          el.scrollTop = maxScroll;
        }
      });

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [autoScroll, isLoading, isFourColumnMode, events.length, pageOffset]);

  const handleUserScrollInteraction = () => {
    // Pause auto-scroll for 4 seconds if user manually touches or wheels the calendar
    userInteractionPauseUntilRef.current = Date.now() + 4000;
  };

  useEffect(() => {
    const updateNow = () => setCurrentTime(new Date());
    const timer = setInterval(updateNow, 15000);
    window.addEventListener('focus', updateNow);
    document.addEventListener('visibilitychange', updateNow);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', updateNow);
      document.removeEventListener('visibilitychange', updateNow);
    };
  }, []);

  const todayKey = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(
    currentTime.getDate()
  ).padStart(2, '0')}`;

  // Automatically reset 4-column pagination to Today (0) whenever the calendar day rolls over at midnight
  useEffect(() => {
    setPageOffset(0);
  }, [todayKey]);

  // Four columns: Day 0, Day 1, Day 2, Day 3 relative to currentTime + pageOffset days
  const fourColumnDays = Array.from({ length: 4 }).map((_, i) => {
    const d = new Date(currentTime);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + pageOffset + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    return { date: d, key };
  });

  // Group events by day key (YYYY-MM-DD), filtering out any events from yesterday or whose start time has already passed
  const groupedEvents: Record<string, CalendarEvent[]> = {};

  const tomorrow = new Date(currentTime);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  events.forEach((event) => {
    // If an event has already ended (all-day) or its start time has passed (timed), do not show it
    const isPast = event.allDay
      ? event.end.getTime() < currentTime.getTime()
      : event.start.getTime() < currentTime.getTime();

    if (isPast) {
      return;
    }

    const rawKey = `${event.start.getFullYear()}-${String(event.start.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(event.start.getDate()).padStart(2, '0')}`;

    // If a multi-day event started before today and is still ongoing today, group it under todayKey (never show yesterday)
    const key = rawKey < todayKey ? todayKey : rawKey;

    if (!groupedEvents[key]) {
      groupedEvents[key] = [];
    }
    groupedEvents[key].push(event);
  });

  // Always ensure the next 7 upcoming days (Today + 6 days) are included so the schedule scrolls through all upcoming days
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentTime);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    if (!groupedEvents[k]) {
      groupedEvents[k] = [];
    }
  }

  const sortedDateKeys = Object.keys(groupedEvents)
    .filter((k) => k >= todayKey)
    .sort();

  const formatHeaderDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);

    const weekday = dateObj.toLocaleDateString(undefined, { weekday: 'long' });
    const weekdayShort = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
    const monthName = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const dayNumber = String(day);

    if (dateKey === todayKey) {
      return {
        dayNumber,
        label: 'Today',
        weekday,
        weekdayShort,
        dateFormatted: monthName,
        isToday: true,
      };
    }
    if (dateKey === tomorrowKey) {
      return {
        dayNumber,
        label: 'Tomorrow',
        weekday,
        weekdayShort,
        dateFormatted: monthName,
        isToday: false,
      };
    }
    return {
      dayNumber,
      label: weekday,
      weekday,
      weekdayShort,
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
          {/* Left: Family Agenda Title & Optional 4-Column Paging */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <CalendarIcon className="w-5 h-5 text-blue-400" />
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-wide whitespace-nowrap">
              {agendaTitle || 'Family Agenda'}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-white/10">
              {events.length}
            </span>

            {/* 4-Column Mode Date Pagination Controls */}
            {isFourColumnMode && (
              <div className="flex items-center gap-1 ml-1 bg-slate-900 border border-white/10 rounded-xl px-1.5 py-0.5">
                <button
                  onClick={() => setPageOffset((prev) => Math.max(0, prev - 4))}
                  disabled={pageOffset === 0}
                  title="Previous 4 Days"
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent transition"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPageOffset(0)}
                  disabled={pageOffset === 0}
                  title="Jump to Today"
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold text-blue-400 hover:bg-blue-500/20 disabled:text-slate-500 disabled:hover:bg-transparent transition"
                >
                  Today
                </button>
                <button
                  onClick={() => setPageOffset((prev) => prev + 4)}
                  title="Next 4 Days"
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-slate-400 font-medium px-1.5 hidden md:inline border-l border-white/10 ml-0.5">
                  {fourColumnDays[0].date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
                  {fourColumnDays[3].date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          {/* Center: In-Line Widgets (Weather, Live Stock) */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {showWeather && (
              <WeatherWidget weather={weather} units={weatherUnits} />
            )}

            {showStockTicker && (
              <StockTickerWidget stock={stock} />
            )}
          </div>

          {/* Right: Auto-Scroll Toggle & Calendars Filter Button */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onToggleAutoScroll && (
              <button
                onClick={onToggleAutoScroll}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition shadow-sm ${
                  autoScroll
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 border-white/15 text-slate-400 hover:text-white'
                }`}
                title={autoScroll ? 'Auto-Scroll Active (6s loop) — Click to Pause' : 'Auto-Scroll Paused — Click to Resume'}
              >
                <ChevronsUpDown className={`w-4 h-4 ${autoScroll ? 'text-blue-400 animate-pulse' : 'text-slate-400'}`} />
                <span className="hidden md:inline">{autoScroll ? 'Auto-Scroll' : 'Scroll Off'}</span>
              </button>
            )}

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

      {/* Agenda Main Content: 4-Column Day Grid (Horizontal Mode) OR Single Column List (Vertical Mode) */}
      {isFourColumnMode ? (
        <div className="flex-1 min-h-0 p-2 sm:p-3 bg-black">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm font-medium">Syncing Google Calendars...</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2.5 sm:gap-3 h-full min-h-0">
              {fourColumnDays.map(({ key }, colIdx) => {
                const dayEvents = groupedEvents[key] || [];
                const { dayNumber, label, weekdayShort, dateFormatted, isToday } =
                  formatHeaderDate(key);
                const dayWeather = isToday
                  ? (weather
                      ? {
                          tempMax: weather.high,
                          tempMin: weather.low,
                          icon: weather.icon,
                          condition: weather.condition,
                        }
                      : null)
                  : (weather?.forecast?.find((f) => f.date === key) || null);

                return (
                  <div
                    key={key}
                    className={`flex flex-col h-full rounded-2xl bg-slate-950/90 border overflow-hidden transition-all ${
                      isToday
                        ? 'border-blue-500/50 ring-1 ring-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.12)]'
                        : 'border-white/10'
                    }`}
                  >
                    {/* Column Header */}
                    <div
                      className={`flex-shrink-0 px-3 py-2.5 border-b select-none flex items-center justify-between ${
                        isToday
                          ? 'bg-blue-950/40 border-blue-500/30'
                          : 'bg-slate-900/60 border-white/10'
                      }`}
                    >
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span
                          className={`text-2xl sm:text-3xl font-black tracking-tight ${
                            isToday ? 'text-blue-400' : 'text-white'
                          }`}
                        >
                          {dayNumber}
                        </span>
                        <div className="min-w-0 truncate">
                          <span
                            className={`text-sm sm:text-base font-bold block truncate leading-tight ${
                              isToday ? 'text-blue-200' : 'text-slate-200'
                            }`}
                          >
                            {label}
                          </span>
                          <span className="text-[11px] sm:text-xs text-slate-400 block truncate">
                            {weekdayShort}, {dateFormatted}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                        {/* Day Weather Outlook Pill */}
                        {dayWeather && (
                          <div
                            className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-xs"
                            title={`${dayWeather.condition}: High ${dayWeather.tempMax}°, Low ${dayWeather.tempMin}°`}
                          >
                            {renderWeatherIcon(dayWeather.icon, 'w-3.5 h-3.5')}
                            <span className="text-[11px] font-bold text-white leading-none">
                              {dayWeather.tempMax}°
                            </span>
                            <span className="text-[10px] text-slate-500 leading-none">/</span>
                            <span className="text-[10px] text-slate-400 leading-none">
                              {dayWeather.tempMin}°
                            </span>
                          </div>
                        )}

                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                            dayEvents.length > 0
                              ? isToday
                                ? 'bg-blue-500/30 text-blue-200 border border-blue-400/30'
                                : 'bg-slate-800 text-slate-300 border border-white/10'
                              : 'text-slate-600 bg-white/5'
                          }`}
                        >
                          {dayEvents.length}
                        </span>
                      </div>
                    </div>

                    {/* Events Scroll Area for this Day Column */}
                    <div
                      ref={(el) => {
                        columnScrollRefs.current[colIdx] = el;
                      }}
                      onWheel={handleUserScrollInteraction}
                      onTouchStart={handleUserScrollInteraction}
                      onTouchMove={handleUserScrollInteraction}
                      className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 no-scrollbar"
                    >
                      {dayEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-center text-slate-600">
                          <p className="text-xs font-medium italic">
                            {isToday ? 'No more events today' : 'No events scheduled'}
                          </p>
                        </div>
                      ) : (
                        dayEvents.map((evt) => (
                          <EventCard
                            key={evt.id}
                            event={evt}
                            militaryTime={militaryTime}
                            compact={true}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Vertical Agenda Scroll Area */
        <div
          ref={verticalScrollRef}
          onWheel={handleUserScrollInteraction}
          onTouchStart={handleUserScrollInteraction}
          onTouchMove={handleUserScrollInteraction}
          className={`flex-1 overflow-y-auto px-3 sm:px-4 py-2 space-y-4 bg-black ${
            autoScroll ? 'pb-[30vh]' : ''
          }`}
        >
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
              const dayWeather = isToday
                ? (weather
                    ? {
                        tempMax: weather.high,
                        tempMin: weather.low,
                        icon: weather.icon,
                        condition: weather.condition,
                      }
                    : null)
                : (weather?.forecast?.find((f) => f.date === dateKey) || null);

              return (
                <div key={dateKey} className="space-y-1">
                  {/* Day Header - Clean White on Black with generous uncrowded spacing */}
                  <div className="sticky top-0 z-10 flex items-baseline justify-between pt-3 pb-2 px-1 bg-black/95 backdrop-blur-md border-b border-white/15">
                    <div className="flex items-baseline">
                      <span
                        className="text-2xl sm:text-3xl font-black text-white tracking-normal inline-block mr-5 sm:mr-6"
                        style={{
                          minWidth: '42px',
                          marginRight: '22px',
                          display: 'inline-block',
                        }}
                      >
                        {dayNumber}
                      </span>
                      <span
                        className={`text-lg sm:text-xl font-bold tracking-tight inline-block mr-4 sm:mr-5 ${
                          isToday ? 'text-white' : 'text-slate-200'
                        }`}
                        style={{
                          marginRight: '18px',
                          display: 'inline-block',
                        }}
                      >
                        {label}
                      </span>
                      <span
                        className="text-xs sm:text-sm font-medium text-slate-400 inline-block"
                        style={{ display: 'inline-block' }}
                      >
                        {isToday ? `${weekday}, ${dateFormatted}` : dateFormatted}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {dayWeather && (
                        <div
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-xs"
                          title={`${dayWeather.condition}: High ${dayWeather.tempMax}°, Low ${dayWeather.tempMin}°`}
                        >
                          {renderWeatherIcon(dayWeather.icon, 'w-3.5 h-3.5')}
                          <span className="text-xs font-bold text-white leading-none">
                            {dayWeather.tempMax}°
                          </span>
                          <span className="text-[10px] text-slate-500 leading-none">/</span>
                          <span className="text-[11px] text-slate-400 leading-none">
                            {dayWeather.tempMin}°
                          </span>
                        </div>
                      )}
                      <span className="text-xs font-semibold text-slate-500">
                        {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                      </span>
                    </div>
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
      )}
    </div>
  );
};
