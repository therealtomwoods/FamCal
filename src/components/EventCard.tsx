import React from 'react';
import { CalendarEvent } from '../types';
import { MapPin, Clock, ExternalLink } from 'lucide-react';

interface EventCardProps {
  event: CalendarEvent;
  militaryTime?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({ event, militaryTime = false }) => {
  const now = new Date();
  const isOngoing = now >= event.start && now <= event.end && !event.allDay;

  // Format time strings
  const formatTime = (d: Date) => {
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: !militaryTime,
    });
  };

  const timeDisplay = event.allDay
    ? 'All Day'
    : `${formatTime(event.start)} – ${formatTime(event.end)}`;

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
    <div
      className={`relative group rounded-xl p-3 sm:p-3.5 transition-all duration-200 border border-white/10 backdrop-blur-sm overflow-hidden ${
        isOngoing
          ? 'ring-2 ring-emerald-500/60 bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-slate-900/95 shadow-lg shadow-emerald-950/30'
          : 'bg-slate-900/80 hover:bg-slate-800/90'
      }`}
      style={{
        borderLeftWidth: '5px',
        borderLeftColor: event.color,
      }}
    >
      {/* Subtle color glow accent */}
      <div
        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl opacity-10 pointer-events-none -mr-10 -mt-10"
        style={{ backgroundColor: event.color }}
      />

      {/* Top Meta Line: Time & Calendar Source */}
      <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Ongoing Live Pulse Indicator */}
          {isOngoing && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Now
            </span>
          )}

          {/* Time Badge */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{timeDisplay}</span>
          </div>
        </div>

        {/* Calendar Tag with native color indicator */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-[11px] font-medium text-slate-300">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: event.color }}
          />
          <span className="truncate max-w-[120px]">{event.calendarName}</span>
        </div>
      </div>

      {/* Main Content: TITLE & PROMINENT LOCATION BESIDE IT */}
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-3 justify-between">
        {/* Event Title */}
        <h4 className="text-base sm:text-lg font-bold text-white tracking-tight leading-snug flex-1">
          {event.title}
        </h4>

        {/* PROMINENT LOCATION FIELD BESIDE TITLE */}
        {event.location ? (
          <button
            onClick={handleLocationClick}
            title={`View on Google Maps: ${event.location}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950/70 hover:bg-sky-900/90 border border-sky-400/40 text-sky-200 text-xs sm:text-sm font-medium transition shadow-sm flex-shrink-0 max-w-full sm:max-w-[55%] text-left"
          >
            <MapPin className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
            <span className="truncate font-semibold text-sky-100">{event.location}</span>
            <ExternalLink className="w-3 h-3 text-sky-400/70 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
          </button>
        ) : (
          <span className="text-[11px] text-slate-500 italic hidden sm:inline">No location</span>
        )}
      </div>

      {/* Description preview if present */}
      {event.description && (
        <p className="mt-1 text-xs text-slate-400 line-clamp-1">
          {event.description}
        </p>
      )}
    </div>
  );
};
