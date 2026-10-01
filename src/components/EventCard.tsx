import React from 'react';
import { CalendarEvent } from '../types';
import { MapPin, ExternalLink } from 'lucide-react';

interface EventCardProps {
  event: CalendarEvent;
  militaryTime?: boolean;
  compact?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({ event, militaryTime = false, compact = false }) => {
  const now = new Date();
  const isOngoing = now >= event.start && now <= event.end && !event.allDay;

  // Format time string
  const formatTime = (d: Date) => {
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: !militaryTime,
    });
  };

  const handleLocationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.location) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        event.location
      )}`;
      window.open(mapsUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (compact) {
    return (
      <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-slate-900/90 border border-white/10 hover:border-white/25 hover:bg-slate-800/80 transition-all shadow-sm group">
        {/* Top: Source Color Bar & Time */}
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: event.color || '#3b82f6' }}
            />
            <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
              {event.allDay ? 'All Day' : formatTime(event.start)}
              {!event.allDay && (
                <span className="text-slate-400 font-normal text-[11px] ml-1">
                  – {formatTime(event.end)}
                </span>
              )}
            </span>
          </div>

          {isOngoing && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"
              title="Happening now"
            />
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm sm:text-base font-bold text-white leading-snug break-words line-clamp-2 group-hover:text-blue-200 transition-colors">
          {event.title}
        </h4>

        {/* Location */}
        {event.location && (
          <div
            onClick={handleLocationClick}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-sky-300 transition-colors mt-1 cursor-pointer truncate"
            title={`Open in Maps: ${event.location}`}
          >
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {/* Calendar Name */}
        {event.calendarName && event.calendarName !== 'Primary' && (
          <span className="inline-block text-[10px] text-slate-500 font-medium mt-1 truncate">
            {event.calendarName}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start py-3 sm:py-3.5 px-1.5 sm:px-2 border-b border-white/10 hover:bg-white/[0.03] transition-colors group">
      {/* 1. Left Vertical Colored Bar */}
      <div
        className="w-2 sm:w-2.5 self-stretch min-h-[36px] rounded-full flex-shrink-0 shadow-sm mr-6"
        style={{
          backgroundColor: event.color || '#3b82f6',
          width: '8px',
          minWidth: '8px',
          marginRight: '24px',
        }}
      />

      {/* 2. Time Column (Fixed Width, Bold White/Slate) */}
      <div
        className="flex-shrink-0 pt-0.5 mr-5"
        style={{
          width: '124px',
          minWidth: '124px',
          marginRight: '22px',
        }}
      >
        <div className="flex items-center">
          {isOngoing && (
            <span
              className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-400 animate-pulse flex-shrink-0 mr-2"
              title="Happening now"
            />
          )}
          <span className="text-lg sm:text-xl font-bold text-white tracking-normal whitespace-nowrap">
            {event.allDay ? 'All Day' : formatTime(event.start)}
          </span>
        </div>
        {!event.allDay && (
          <span className="text-sm sm:text-base font-semibold text-slate-400 block leading-tight mt-0.5 tracking-normal">
            to {formatTime(event.end)}
          </span>
        )}
      </div>

      {/* 3. Event Content Column: Extra Large White Title & Subtitle/Location */}
      <div className="flex-1 min-w-0 pt-0.5">
        <h4 className="text-2xl sm:text-3xl font-bold text-white tracking-normal leading-snug break-words">
          {event.title}
        </h4>

        {/* Location subtitle directly underneath title */}
        {event.location && (
          <div
            onClick={handleLocationClick}
            className="flex items-center gap-1 text-sm sm:text-base text-slate-400 hover:text-sky-300 transition-colors mt-1 cursor-pointer max-w-full truncate group/loc"
            title={`Open in Maps: ${event.location}`}
          >
            <MapPin className="w-4 h-4 flex-shrink-0 text-slate-500 group-hover/loc:text-sky-400" />
            <span className="truncate font-normal">{event.location}</span>
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 opacity-0 group-hover/loc:opacity-100 transition-opacity ml-0.5 text-sky-400" />
          </div>
        )}

        {/* Optional Calendar Name Pill (Subtle tag if multi-calendar) */}
        {event.calendarName && event.calendarName !== 'Primary' && (
          <span className="inline-block text-[11px] text-slate-500 font-medium mt-1">
            {event.calendarName}
          </span>
        )}
      </div>
    </div>
  );
};
