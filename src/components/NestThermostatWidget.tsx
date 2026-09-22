import React from 'react';
import { NestThermostatState } from '../types';
import { Flame, Snowflake, Leaf, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';

interface NestThermostatWidgetProps {
  thermostat: NestThermostatState | null;
  onAdjustTemp?: (delta: number) => void;
}

export const NestThermostatWidget: React.FC<NestThermostatWidgetProps> = ({
  thermostat,
  onAdjustTemp,
}) => {
  if (!thermostat) return null;

  const isCooling = thermostat.mode === 'cool' || thermostat.status === 'cooling';
  const isHeating = thermostat.mode === 'heat' || thermostat.status === 'heating';

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-white select-none flex-shrink-0">
      {/* Mode Icon */}
      <div
        className={`p-1.5 rounded-lg flex items-center justify-center ${
          isCooling
            ? 'bg-sky-500/20 text-sky-400'
            : isHeating
            ? 'bg-amber-500/20 text-amber-400'
            : 'bg-emerald-500/20 text-emerald-400'
        }`}
      >
        {isCooling ? (
          <Snowflake className="w-4 h-4 animate-spin-slow" />
        ) : isHeating ? (
          <Flame className="w-4 h-4" />
        ) : (
          <Leaf className="w-4 h-4" />
        )}
      </div>

      {/* Temp Display */}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-base sm:text-lg font-black tracking-tight leading-none text-white">
            {thermostat.currentTemp}°
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Set {thermostat.targetTemp}°
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-300 leading-tight mt-0.5">
          <span className="capitalize font-semibold text-sky-300">
            {thermostat.status === 'idle' ? 'Idle' : thermostat.status}
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">{thermostat.humidity}% RH</span>
          {thermostat.isRealDevice && (
            <span title="Connected to Google Nest"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 ml-0.5" /></span>
          )}
        </div>
      </div>

      {/* Target Setpoint Controls */}
      {onAdjustTemp && (
        <div className="flex flex-col gap-0.5 ml-0.5">
          <button
            onClick={() => onAdjustTemp(1)}
            className="p-0.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
            title="Increase Target Temperature"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onAdjustTemp(-1)}
            className="p-0.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
            title="Decrease Target Temperature"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
