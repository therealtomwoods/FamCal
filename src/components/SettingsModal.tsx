import React, { useState } from 'react';
import { AppSettings, PhotoAlbum } from '../types';
import { UserProfile } from '../services/googleAuth';
import { X, LogIn, LogOut, Sliders, Shield, Cloud, TrendingUp, Thermometer, Clock, HelpCircle, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  userProfile: UserProfile | null;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  albums: PhotoAlbum[];
  onSelectAlbum: (album: PhotoAlbum) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  userProfile,
  onConnectGoogle,
  onDisconnectGoogle,
  albums,
  onSelectAlbum,
}) => {
  const [clientIdInput, setClientIdInput] = useState(settings.googleClientId || '');
  const [activeTab, setActiveTab] = useState<'general' | 'widgets' | 'google' | 'guide'>('general');
  const [showSavedToast, setShowSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleSaveClientId = () => {
    onUpdateSettings({ googleClientId: clientIdInput.trim() });
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">FamCal Settings</h3>
              <p className="text-xs text-slate-400">
                Configure Google account, display preferences & widgets
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

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-slate-950/60 px-3 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-2.5 px-3 border-b-2 transition ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            General & Display
          </button>
          <button
            onClick={() => setActiveTab('widgets')}
            className={`py-2.5 px-3 border-b-2 transition ${
              activeTab === 'widgets'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Floating Widgets
          </button>
          <button
            onClick={() => setActiveTab('google')}
            className={`py-2.5 px-3 border-b-2 transition ${
              activeTab === 'google'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Google Account
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`py-2.5 px-3 border-b-2 transition ${
              activeTab === 'guide'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Setup Guide
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-sm">
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Demo Mode Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">Interactive Demo Mode</p>
                  <p className="text-xs text-slate-400">
                    Use rich mockup family data with sample calendars and photos
                  </p>
                </div>
                <button
                  onClick={() => onUpdateSettings({ isDemoMode: !settings.isDemoMode })}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    settings.isDemoMode ? 'bg-amber-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.isDemoMode ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Slideshow Interval */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Slideshow Photo Duration: <span className="text-blue-400">{settings.slideshowInterval}s</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={settings.slideshowInterval}
                  onChange={(e) =>
                    onUpdateSettings({ slideshowInterval: parseInt(e.target.value, 10) })
                  }
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>5 sec (Fast)</span>
                  <span>30 sec</span>
                  <span>60 sec (Slow)</span>
                </div>
              </div>

              {/* Time Format */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">24-Hour Time Format</p>
                  <p className="text-xs text-slate-400">Display 14:00 instead of 2:00 PM</p>
                </div>
                <button
                  onClick={() => onUpdateSettings({ militaryTime: !settings.militaryTime })}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    settings.militaryTime ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.militaryTime ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 9:16 Kiosk Frame Preview */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">Frame in 9:16 Aspect Box</p>
                  <p className="text-xs text-slate-400">
                    Preview portrait wall display format on widescreen desktop monitors
                  </p>
                </div>
                <button
                  onClick={() => onUpdateSettings({ isKioskFramed: !settings.isKioskFramed })}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    settings.isKioskFramed ? 'bg-blue-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.isKioskFramed ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'widgets' && (
            <div className="space-y-4">
              {/* Weather Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-sky-400" />
                    <div>
                      <p className="font-bold text-white">Live Weather Widget</p>
                      <p className="text-xs text-slate-400">Open-Meteo live forecast (Zero API key needed)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ showWeather: !settings.showWeather })}
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                      settings.showWeather ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.showWeather ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {settings.showWeather && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                    <div>
                      <label className="text-[11px] text-slate-400 font-semibold">City Name</label>
                      <input
                        type="text"
                        value={settings.weatherLocation}
                        onChange={(e) => onUpdateSettings({ weatherLocation: e.target.value })}
                        className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 font-semibold">Units</label>
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => onUpdateSettings({ weatherUnits: 'F' })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                            settings.weatherUnits === 'F'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          °F
                        </button>
                        <button
                          onClick={() => onUpdateSettings({ weatherUnits: 'C' })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                            settings.weatherUnits === 'C'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-900 text-slate-400'
                          }`}
                        >
                          °C
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stock Ticker Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-bold text-white">Stock Ticker Marquee</p>
                      <p className="text-xs text-slate-400">Market overview and stock quotes</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ showStockTicker: !settings.showStockTicker })}
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                      settings.showStockTicker ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.showStockTicker ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Nest Thermostat Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="font-bold text-white">Nest Smart Thermostat</p>
                      <p className="text-xs text-slate-400">Living room climate and temperature status</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ showNestThermostat: !settings.showNestThermostat })}
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                      settings.showNestThermostat ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.showNestThermostat ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Clock Widget Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="font-bold text-white">Digital Clock Overlay</p>
                      <p className="text-xs text-slate-400">Current time and day glanceable chip</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onUpdateSettings({ showDigitalClock: !settings.showDigitalClock })}
                    className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                      settings.showDigitalClock ? 'bg-blue-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        settings.showDigitalClock ? 'translate-x-6' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'google' && (
            <div className="space-y-4">
              {/* Google Client ID Config */}
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-800/60 border border-white/5">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Google OAuth Client ID
                </label>
                <p className="text-xs text-slate-400">
                  Enter your Web Client ID from Google Cloud Console.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <button
                    onClick={handleSaveClientId}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save
                  </button>
                </div>
                {showSavedToast && (
                  <p className="text-xs text-emerald-400 font-semibold animate-pulse">
                    ✓ Client ID saved!
                  </p>
                )}
              </div>

              {/* User Account Card */}
              {userProfile ? (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {userProfile.picture ? (
                      <img
                        src={userProfile.picture}
                        alt={userProfile.name}
                        className="w-10 h-10 rounded-full border border-emerald-400/40"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-emerald-600/30 flex items-center justify-center text-emerald-300 font-bold">
                        {userProfile.name[0]}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-white">{userProfile.name}</p>
                      <p className="text-xs text-emerald-300">{userProfile.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={onDisconnectGoogle}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/30 text-rose-200 text-xs font-semibold transition flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-800/60 border border-white/5 text-center space-y-3">
                  <p className="text-xs text-slate-300">
                    Connect your Google Account to synchronize your Google Calendars and Google Photos albums.
                  </p>
                  <button
                    onClick={onConnectGoogle}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign in with Google
                  </button>
                </div>
              )}

              {/* Photos Album Selector */}
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-800/60 border border-white/5">
                <label className="text-xs font-bold text-white">Google Photos Album</label>
                <div className="space-y-1.5">
                  {albums.map((alb) => (
                    <div
                      key={alb.id}
                      onClick={() => onSelectAlbum(alb)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between ${
                        alb.id === settings.selectedAlbumId
                          ? 'bg-blue-950/50 border-blue-500/50 text-white'
                          : 'bg-slate-900/50 border-white/5 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-semibold">{alb.title}</span>
                      {alb.id === settings.selectedAlbumId && (
                        <span className="text-[10px] text-blue-400 font-bold">Selected</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-500/30">
                <h4 className="font-bold text-white mb-1 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-blue-400" />
                  Free GitHub Pages + Google OAuth Setup
                </h4>
                <p className="text-slate-300">
                  FamCal is a 100% client-side PWA with zero server costs.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-white">Step 1: Create Google Cloud Project</p>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
                  <li>Go to <strong className="text-slate-200">console.cloud.google.com</strong>.</li>
                  <li>Enable <strong className="text-slate-200">Google Calendar API</strong> and <strong className="text-slate-200">Photos Library API</strong>.</li>
                  <li>Go to <strong className="text-slate-200">Credentials</strong> → <strong className="text-slate-200">Create Credentials</strong> → <strong className="text-slate-200">OAuth Client ID</strong>.</li>
                  <li>Select Application type: <strong className="text-slate-200">Web application</strong>.</li>
                </ol>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-white">Step 2: Add Authorized Origins</p>
                <p className="text-slate-400">Under Authorized JavaScript origins, add:</p>
                <div className="p-2 rounded bg-slate-950 border border-white/10 font-mono text-[11px] text-blue-300">
                  https://&lt;your-github-username&gt;.github.io<br/>
                  http://localhost:5173
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-white">Step 3: Paste Client ID</p>
                <p className="text-slate-400">
                  Copy the Client ID into the "Google Account" tab of this settings menu.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
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
