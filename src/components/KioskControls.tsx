import React, { useState, useEffect } from 'react';
import { Maximize, Minimize, Sun, Moon, RefreshCw, Settings, ShieldCheck, Sparkles, Layers, Calendar, Columns4, Smartphone } from 'lucide-react';
import {
  isBrowserFullscreen,
  requestBrowserFullscreen,
  exitBrowserFullscreen,
  acquireScreenWakeLock,
  releaseScreenWakeLock,
  isWakeLockActive,
  getKioskFullscreenPreferred,
  setKioskFullscreenPreferred,
  getKioskWakeLockPreferred,
  setKioskWakeLockPreferred,
} from '../services/kioskService';

interface KioskControlsProps {
  isDemoMode: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenCalendarFilter: () => void;
  isFramed: boolean;
  onToggleFraming: () => void;
  isHorizontal: boolean;
  onToggleScreenMode: () => void;
}

export const KioskControls: React.FC<KioskControlsProps> = ({
  isDemoMode,
  onRefresh,
  onOpenSettings,
  onOpenCalendarFilter,
  isFramed,
  onToggleFraming,
  isHorizontal,
  onToggleScreenMode,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(isBrowserFullscreen);
  const [wakeLockActive, setWakeLockActive] = useState(isWakeLockActive);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      const fs = isBrowserFullscreen();
      setIsFullscreen(fs);
      // When in fullscreen, keep wake lock active so display stays on
      if (fs && getKioskWakeLockPreferred()) {
        acquireScreenWakeLock().then(() => setWakeLockActive(isWakeLockActive()));
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);

    // Initial check and auto-restore wake lock if preferred
    setIsFullscreen(isBrowserFullscreen());
    if (getKioskWakeLockPreferred()) {
      acquireScreenWakeLock().then(() => setWakeLockActive(isWakeLockActive()));
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setIsFullscreen(isBrowserFullscreen());
        if (getKioskWakeLockPreferred() || getKioskFullscreenPreferred()) {
          acquireScreenWakeLock().then(() => setWakeLockActive(isWakeLockActive()));
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!isBrowserFullscreen()) {
        setKioskFullscreenPreferred(true);
        setKioskWakeLockPreferred(true);
        await requestBrowserFullscreen();
        await acquireScreenWakeLock();
        setWakeLockActive(isWakeLockActive());
        setIsFullscreen(isBrowserFullscreen());
      } else {
        setKioskFullscreenPreferred(false);
        setKioskWakeLockPreferred(false);
        await exitBrowserFullscreen();
        await releaseScreenWakeLock();
        setWakeLockActive(false);
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  };

  const toggleWakeLock = async () => {
    try {
      if (!wakeLockActive) {
        setKioskWakeLockPreferred(true);
        const ok = await acquireScreenWakeLock();
        setWakeLockActive(ok);
      } else {
        setKioskWakeLockPreferred(false);
        await releaseScreenWakeLock();
        setWakeLockActive(false);
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

        {/* Aspect Framing Toggle (for desktop testing) */}
        <button
          onClick={onToggleFraming}
          title={isFramed ? "Switch to Full Bleed View" : `Switch to ${isHorizontal ? '16:9' : '9:16'} Kiosk Frame Preview`}
          className={`p-1.5 rounded-xl border text-xs font-medium transition flex items-center gap-1 ${
            isFramed
              ? 'bg-blue-600/30 border-blue-500/40 text-blue-300'
              : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isFramed ? (isHorizontal ? 'Framed 16:9' : 'Framed 9:16') : 'Full Bleed'}</span>
        </button>

        {/* Screen Mode Toggle Button (Vertical 9:16 vs Horizontal 4-Column) */}
        <button
          onClick={onToggleScreenMode}
          title={
            isHorizontal
              ? "Switch to Vertical Screen Mode (Single Column Agenda)"
              : "Switch to Horizontal Screen Mode (4-Column Days Across)"
          }
          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
            isHorizontal
              ? 'bg-blue-600/30 border-blue-500/50 text-blue-300 shadow-sm'
              : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          {isHorizontal ? (
            <Columns4 className="w-3.5 h-3.5 text-blue-400" />
          ) : (
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>{isHorizontal ? 'Horizontal (4-Col)' : 'Vertical Mode'}</span>
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
