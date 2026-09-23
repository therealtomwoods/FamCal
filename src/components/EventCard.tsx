import React from 'react';
import { CalendarEvent } from '../types';
import { MapPin, ExternalLink } from 'lucide-react';

interface EventCardProps {
  event: CalendarEvent;
  militaryTime?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({ event, militaryTime = false }) => {
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

  return (
    <div className="flex items-start gap-3 py-2.5 sm:py-3 px-1 border-b border-white/10 hover:bg-white/[0.03] transition-colors group">
      {/* 1. Left Vertical Colored Bar */}
      <div
        className="w-1.5 self-stretch min-h-[28px] rounded-full flex-shrink-0"
        style={{ backgroundColor: event.color || '#3b82f6' }}
      />

      {/* 2. Time Column (Fixed Width, Bold Slate/White) */}
      <div className="w-20 sm:w-24 flex-shrink-0 pt-0.5">
        <div className="flex items-center gap-1.5">
          {isOngoing && (
            <span
              className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0"
              title="Happening now"
            />
          )}
          <span className="text-sm sm:text-base font-bold text-slate-300 tracking-tight whitespace-nowrap">
            {event.allDay ? 'All Day' : formatTime(event.start)}
          </span>
        </div>
        {!event.allDay && (
          <span className="text-[11px] font-medium text-slate-500 block leading-tight mt-0.5">
            to {formatTime(event.end)}
          </span>
        )}
      </div>

      {/* 3. Event Content Column: Prominent White Title & Subtitle/Location */}
      <div className="flex-1 min-w-0 pt-0.5">
        <h4 className="text-base sm:text-lg font-semibold text-white tracking-normal leading-snug break-words">
          {event.title}
        </h4>

        {/* Location subtitle directly underneath title */}
        {event.location && (
          <div
            onClick={handleLocationClick}
            className="flex items-center gap-1 text-xs sm:text-sm text-slate-400 hover:text-sky-300 transition-colors mt-0.5 cursor-pointer max-w-full truncate group/loc"
            title={`Open in Maps: ${event.location}`}
          >
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-500 group-hover/loc:text-sky-400" />
            <span className="truncate">{event.location}</span>
            <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover/loc:opacity-100 transition-opacity ml-0.5 text-sky-400" />
          </div>
        )}

        {/* Optional Calendar Name Pill (Subtle tag if multi-calendar) */}
        {event.calendarName && event.calendarName !== 'Primary' && (
          <span className="inline-block text-[10px] text-slate-500 font-medium mt-1">
            {event.calendarName}
          </span>
        )}
      </div>
    </div>
  );
};
