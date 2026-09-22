import React, { useState } from 'react';
import { AppSettings, PhotoAlbum } from '../types';
import { UserProfile } from '../services/googleAuth';
import {
  X,
  LogIn,
  LogOut,
  Sliders,
  Shield,
  Cloud,
  TrendingUp,
  Thermometer,
  Clock,
  Check,
  FolderOpen,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

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
  onRefreshAlbums: () => void;
  onOpenAlbumModal: () => void;
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
  onRefreshAlbums,
  onOpenAlbumModal,
}) => {
  const [clientIdInput, setClientIdInput] = useState(settings.googleClientId || '');
  const [nestProjectIdInput, setNestProjectIdInput] = useState(settings.nestProjectId || '');
  const [stockSymbolInput, setStockSymbolInput] = useState(settings.monitoredStock || 'SPY');
  const [activeTab, setActiveTab] = useState<'google' | 'widgets' | 'general'>('google');
  const [showSavedToast, setShowSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleSaveAll = () => {
    onUpdateSettings({
      googleClientId: clientIdInput.trim(),
      nestProjectId: nestProjectIdInput.trim(),
      monitoredStock: stockSymbolInput.trim().toUpperCase() || 'SPY',
    });
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2000);
  };

  const handleQuickStockSelect = (symbol: string) => {
    setStockSymbolInput(symbol);
    onUpdateSettings({ monitoredStock: symbol });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">FamCal Settings</h3>
              <p className="text-xs text-slate-400">
                Google account integration, widgets, and display preferences
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

        {/* Tab Navigation (Only 3 tabs now, OAuth instructions integrated into Google tab) */}
        <div className="flex border-b border-white/10 bg-slate-950/60 px-3 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('google')}
            className={`py-2.5 px-4 border-b-2 transition ${
              activeTab === 'google'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Google Account & Setup
          </button>
          <button
            onClick={() => setActiveTab('widgets')}
            className={`py-2.5 px-4 border-b-2 transition ${
              activeTab === 'widgets'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Widgets (Weather, Stock, Nest)
          </button>
          <button
            onClick={() => setActiveTab('general')}
            className={`py-2.5 px-4 border-b-2 transition ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            General & Display
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto space-y-5 flex-1 text-sm">
          {/* ========================================================================= */}
          {/* TAB 1: GOOGLE ACCOUNT & CLOUD CONSOLE SETUP INSTRUCTIONS */}
          {/* ========================================================================= */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              {/* Google Client ID Config */}
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-800/60 border border-white/5">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Google OAuth Client ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <button
                    onClick={handleSaveAll}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save
                  </button>
                </div>
                {showSavedToast && (
                  <p className="text-xs text-emerald-400 font-semibold animate-pulse">
                    ✓ Settings saved!
                  </p>
                )}
              </div>

              {/* User Account Status */}
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

              {/* Google Photos Album Selector Section */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-pink-400" />
                    Google Photos Album for Slideshow
                  </label>
                  <button
                    onClick={onRefreshAlbums}
                    title="Refresh albums list from Google Photos"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-white/10">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {settings.selectedAlbumName || 'None Selected'}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      ID: {settings.selectedAlbumId || 'Default'}
                    </p>
                  </div>
                  <button
                    onClick={onOpenAlbumModal}
                    className="ml-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex-shrink-0"
                  >
                    Choose Album
                  </button>
                </div>

                {albums.length > 0 && (
                  <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                    {albums.map((alb) => (
                      <div
                        key={alb.id}
                        onClick={() => onSelectAlbum(alb)}
                        className={`p-2 rounded text-xs cursor-pointer flex items-center justify-between ${
                          alb.id === settings.selectedAlbumId
                            ? 'bg-pink-950/50 border border-pink-500/40 text-white font-bold'
                            : 'bg-slate-900/40 border border-white/5 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{alb.title}</span>
                        {alb.id === settings.selectedAlbumId && (
                          <span className="text-[10px] text-pink-400 font-bold ml-2">Active</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Real Nest Thermostat (Google Smart Device Management) Config */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-amber-400" />
                  Real Nest Thermostat (SDM Project ID)
                </label>
                <p className="text-[11px] text-slate-400">
                  To connect your real Google Nest, enter your Google Device Access Enterprise ID.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nestProjectIdInput}
                    onChange={(e) => setNestProjectIdInput(e.target.value)}
                    placeholder="e.g. 52458897-b673-4556-91b3-xxxxxxxxxxxx"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-mono"
                  />
                  <button
                    onClick={handleSaveAll}
                    className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save
                  </button>
                </div>
              </div>

              {/* Comprehensive Google Cloud Console Setup Instructions */}
              <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-3 text-xs leading-relaxed">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                  <ExternalLink className="w-4 h-4" />
                  <span>How to Configure Google Cloud Console</span>
                </div>

                <div className="space-y-1 text-slate-300">
                  <p className="font-semibold text-white">1. Create a Project & Enable APIs</p>
                  <p className="text-slate-400 pl-2">
                    Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">console.cloud.google.com</a>, create a project, then in <strong>APIs & Services → Library</strong> enable:
                  </p>
                  <ul className="list-disc list-inside pl-4 text-slate-300">
                    <li><strong>Google Calendar API</strong> (for reading primary, secondary & subscribed calendars)</li>
                    <li><strong>Photos Library API</strong> (for loading Google Photos albums)</li>
                    <li><strong>Smart Device Management API</strong> (for connecting your real Google Nest Thermostat)</li>
                  </ul>
                </div>

                <div className="space-y-1 text-slate-300">
                  <p className="font-semibold text-white">2. Create OAuth 2.0 Client ID</p>
                  <p className="text-slate-400 pl-2">
                    Go to <strong>APIs & Services → Credentials → Create Credentials → OAuth Client ID</strong>.
                  </p>
                  <ul className="list-disc list-inside pl-4 text-slate-300">
                    <li>Application type: <strong>Web application</strong></li>
                    <li>
                      Under <strong>Authorized JavaScript origins</strong>, add your exact GitHub Pages URL:
                      <code className="block my-1 p-1.5 rounded bg-slate-900 text-emerald-400 font-mono text-[11px]">
                        https://therealtomwoods.github.io
                      </code>
                      <em>(Also add <code>http://localhost:5173</code> if testing on local dev servers. Do not include a trailing slash <code>/</code>).</em>
                    </li>
                    <li>Authorized redirect URIs: <em>Leave empty (not needed for client-side popup auth).</em></li>
                  </ul>
                </div>

                <div className="space-y-1 text-slate-300">
                  <p className="font-semibold text-white">3. Add Test Users</p>
                  <p className="text-slate-400 pl-2">
                    In <strong>OAuth consent screen</strong>, if Publishing status is <strong>Testing</strong>, add your Google account email under <strong>Test users</strong> and click <strong>Save</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: FLOATING WIDGETS (WEATHER, SINGLE STOCK TICKER, NEST) */}
          {/* ========================================================================= */}
          {activeTab === 'widgets' && (
            <div className="space-y-4">
              {/* Weather Widget */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-sky-400" />
                    <div>
                      <p className="font-bold text-white">Weather Widget</p>
                      <p className="text-xs text-slate-400">Open-Meteo live forecast in the separator ribbon</p>
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

              {/* Single Stock Ticker Widget */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <div>
                      <p className="font-bold text-white">Stock Ticker Widget</p>
                      <p className="text-xs text-slate-400">Monitor a single stock or index in the ribbon</p>
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

                {settings.showStockTicker && (
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <div>
                      <label className="text-[11px] text-slate-400 font-semibold">
                        Monitored Stock Ticker Symbol
                      </label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={stockSymbolInput}
                          onChange={(e) => setStockSymbolInput(e.target.value.toUpperCase())}
                          placeholder="e.g. SPY, AAPL, NVDA, TSLA"
                          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-bold uppercase"
                        />
                        <button
                          onClick={handleSaveAll}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    {/* Quick Suggestions */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-slate-400">Popular:</span>
                      {['SPY', 'VOO', 'AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA'].map((sym) => (
                        <button
                          key={sym}
                          onClick={() => handleQuickStockSelect(sym)}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                            stockSymbolInput === sym
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-slate-900 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Nest Thermostat Widget */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-amber-400" />
                    <div>
                      <p className="font-bold text-white">Nest Thermostat Widget</p>
                      <p className="text-xs text-slate-400">Climate status tile in the separator ribbon</p>
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

              {/* Clock Widget */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <div>
                      <p className="font-bold text-white">Digital Clock Widget</p>
                      <p className="text-xs text-slate-400">Large clock in top-right corner</p>
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

          {/* ========================================================================= */}
          {/* TAB 3: GENERAL & DISPLAY */}
          {/* ========================================================================= */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Demo Mode Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">Interactive Demo Mode</p>
                  <p className="text-xs text-slate-400">
                    Use sample family calendars, photos, and widgets
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
                  Photo Slideshow Duration: <span className="text-blue-400">{settings.slideshowInterval}s</span>
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
