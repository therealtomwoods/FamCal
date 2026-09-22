import React, { useState } from 'react';
import { NestThermostatState } from '../types';
import { Flame, Snowflake, Leaf, ChevronUp, ChevronDown } from 'lucide-react';

interface NestThermostatWidgetProps {
  initialState?: NestThermostatState;
}

export const NestThermostatWidget: React.FC<NestThermostatWidgetProps> = ({ initialState }) => {
  const [state, setState] = useState<NestThermostatState>(
    initialState || {
      currentTemp: 71,
      targetTemp: 70,
      mode: 'cool',
      status: 'cooling',
      humidity: 44,
      deviceName: 'Nest Thermostat',
      eco: false,
    }
  );

  const handleTempAdjust = (delta: number) => {
    setState((prev) => ({
      ...prev,
      targetTemp: prev.targetTemp + delta,
    }));
  };

  const isCooling = state.mode === 'cool' || state.status === 'cooling';
  const isHeating = state.mode === 'heat' || state.status === 'heating';

  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 text-white shadow-lg select-none">
      {/* Icon Indicator */}
      <div
        className={`p-2 rounded-xl flex items-center justify-center ${
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

      {/* Thermostat Info */}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-black tracking-tight leading-none">
            {state.currentTemp}°
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            Set {state.targetTemp}°
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
          <span className="capitalize font-semibold text-sky-300">
            {state.status === 'idle' ? 'Eco Idle' : `${state.mode}ing`}
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">{state.humidity}% RH</span>
        </div>
      </div>

      {/* Quick Temp Bump Controls */}
      <div className="flex flex-col gap-0.5 ml-1">
        <button
          onClick={() => handleTempAdjust(1)}
          className="p-0.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
          title="Increase Target Temp"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => handleTempAdjust(-1)}
          className="p-0.5 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
          title="Decrease Target Temp"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
