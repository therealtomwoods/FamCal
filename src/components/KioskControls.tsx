import React, { useState, useEffect } from 'react';
import { Maximize, Minimize, Sun, Moon, RefreshCw, Settings, ShieldCheck, Sparkles, Layers, Calendar } from 'lucide-react';

interface KioskControlsProps {
  isDemoMode: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenCalendarFilter: () => void;
  isFramed: boolean;
  onToggleFraming: () => void;
}

export const KioskControls: React.FC<KioskControlsProps> = ({
  isDemoMode,
  onRefresh,
  onOpenSettings,
  onOpenCalendarFilter,
  isFramed,
  onToggleFraming,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  const toggleWakeLock = async () => {
    try {
      if (!wakeLockActive && 'wakeLock' in navigator) {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        setWakeLockSentinel(sentinel);
        setWakeLockActive(true);
        sentinel.addEventListener('release', () => {
          setWakeLockActive(false);
          setWakeLockSentinel(null);
        });
      } else if (wakeLockSentinel) {
        await wakeLockSentinel.release();
        setWakeLockActive(false);
        setWakeLockSentinel(null);
      }
    } catch (err) {
      console.warn('Screen Wake Lock error:', err);
    }
  };

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="flex-shrink-0 px-3 py-2 bg-slate-950/95 border-t border-white/10 flex items-center justify-between gap-2 backdrop-blur-md select-none z-20">
      {/* Mode Status Pill */}
      <div className="flex items-center gap-2">
        {isDemoMode ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            Demo Mode
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Google Live
          </span>
        )}

        {/* 9:16 Aspect Framing Toggle (for desktop testing) */}
        <button
          onClick={onToggleFraming}
          title={isFramed ? "Switch to Full Bleed View" : "Switch to 9:16 Kiosk Frame Preview"}
          className={`p-1.5 rounded-xl border text-xs font-medium transition flex items-center gap-1 ${
            isFramed
              ? 'bg-blue-600/30 border-blue-500/40 text-blue-300'
              : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isFramed ? 'Framed 9:16' : 'Full Bleed'}</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5">
        {/* Calendars Filter Shortcut */}
        <button
          onClick={onOpenCalendarFilter}
          title="Filter Active Calendars"
          className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <Calendar className="w-4 h-4 text-blue-400" />
        </button>

        {/* Screen Wake Lock Button (for wall tablets) */}
        <button
          onClick={toggleWakeLock}
          title={wakeLockActive ? 'Screen Wake Lock Active (Stays On)' : 'Enable Screen Wake Lock (Keep Display On)'}
          className={`p-2 rounded-xl border transition ${
            wakeLockActive
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
              : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
          }`}
        >
          {wakeLockActive ? <Sun className="w-4 h-4 animate-pulse" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Refresh */}
        <button
          onClick={handleRefreshClick}
          title="Refresh Events and Photos"
          className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Kiosk'}
          className="p-2 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          title="App Settings"
          className="p-2 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:bg-blue-600/50 hover:text-white transition"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
