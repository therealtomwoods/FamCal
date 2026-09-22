import React from 'react';
import { CalendarInfo } from '../types';
import { X, Check, Calendar, CheckSquare, Square } from 'lucide-react';

interface CalendarFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendars: CalendarInfo[];
  selectedIds: string[];
  onToggleCalendar: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export const CalendarFilterModal: React.FC<CalendarFilterModalProps> = ({
  isOpen,
  onClose,
  calendars,
  selectedIds,
  onToggleCalendar,
  onSelectAll,
  onDeselectAll,
}) => {
  if (!isOpen) return null;

  // Group calendars by type: Primary, Secondary, Subscribed
  const primaryCals = calendars.filter((c) => c.type === 'primary');
  const secondaryCals = calendars.filter((c) => c.type === 'secondary');
  const subscribedCals = calendars.filter((c) => c.type === 'subscribed');

  const renderSection = (title: string, list: CalendarInfo[], badgeColor: string) => {
    if (list.length === 0) return null;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeColor}`}>
            {title}
          </span>
          <span className="text-xs text-slate-400">({list.length})</span>
        </div>

        <div className="space-y-1.5">
          {list.map((cal) => {
            const isChecked = selectedIds.includes(cal.id);
            return (
              <div
                key={cal.id}
                onClick={() => onToggleCalendar(cal.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer select-none ${
                  isChecked
                    ? 'bg-slate-800/90 border-blue-500/40 text-white shadow-sm'
                    : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: cal.backgroundColor }}
                  />
                  <div className="truncate">
                    <p className="text-sm font-semibold truncate leading-snug">{cal.summary}</p>
                    {cal.description && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{cal.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 ml-2">
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                      isChecked ? 'bg-blue-600 text-white' : 'border border-slate-600'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Select Calendars</h3>
              <p className="text-xs text-slate-400">
                Choose which Google calendars appear on your family agenda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Select Bar */}
        <div className="px-4 py-2 bg-slate-950/60 border-b border-white/5 flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">
            {selectedIds.length} of {calendars.length} active
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onSelectAll}
              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold"
            >
              <CheckSquare className="w-3.5 h-3.5" /> Select All
            </button>
            <span className="text-slate-600">•</span>
            <button
              onClick={onDeselectAll}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 font-semibold"
            >
              <Square className="w-3.5 h-3.5" /> Clear All
            </button>
          </div>
        </div>

        {/* Calendar Lists */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {renderSection('Primary Calendar', primaryCals, 'bg-blue-600/20 text-blue-300')}
          {renderSection('Secondary Calendars', secondaryCals, 'bg-emerald-600/20 text-emerald-300')}
          {renderSection('Subscribed & Shared', subscribedCals, 'bg-purple-600/20 text-purple-300')}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/30"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
