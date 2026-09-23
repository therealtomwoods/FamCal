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
  Clock,
  Check,
  FolderOpen,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  userToken?: string | null;
  userProfile: UserProfile | null;
  onConnectGoogle: () => void;
  onDisconnectGoogle: () => void;
  albums: PhotoAlbum[];
  onSelectAlbum: (album: PhotoAlbum) => void;
  onRefreshAlbums: () => void;
  onOpenAlbumModal: () => void;
  onLaunchPhotosPicker?: () => void;
  onCheckPickerNow?: () => void;
  onCancelPicker?: () => void;
  isLaunchingPicker?: boolean;
  pickedPhotosCount?: number;
  photosStatus?: { success: boolean; message: string };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  userToken,
  userProfile,
  onConnectGoogle,
  onDisconnectGoogle,
  albums,
  onSelectAlbum,
  onRefreshAlbums,
  onOpenAlbumModal,
  onLaunchPhotosPicker,
  onCheckPickerNow,
  onCancelPicker,
  isLaunchingPicker = false,
  pickedPhotosCount = 0,
  photosStatus,
}) => {
  const [clientIdInput, setClientIdInput] = useState(settings.googleClientId || '');
  const [stockSymbolInput, setStockSymbolInput] = useState(settings.monitoredStock || 'SPY');
  const [agendaTitleInput, setAgendaTitleInput] = useState(settings.familyAgendaTitle || 'Family Agenda');
  const [activeTab, setActiveTab] = useState<'google' | 'widgets' | 'general'>('google');
  const [showSavedToast, setShowSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleSaveAll = () => {
    onUpdateSettings({
      googleClientId: clientIdInput.trim(),
      monitoredStock: stockSymbolInput.trim().toUpperCase() || 'SPY',
      familyAgendaTitle: agendaTitleInput.trim() || 'Family Agenda',
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

        {/* Tab Navigation */}
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
            Widgets (Weather, Stocks)
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
          {/* TAB 1: GOOGLE ACCOUNT & SETUP INSTRUCTIONS */}
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

              {/* User Account Status & Re-auth */}
              {Boolean(userToken || userProfile) ? (
                <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {userProfile?.picture ? (
                        <img
                          src={userProfile.picture}
                          alt={userProfile.name}
                          className="w-10 h-10 rounded-full border border-emerald-400/40"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-emerald-600/30 flex items-center justify-center text-emerald-300 font-bold">
                          {userProfile?.name?.[0] || 'G'}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-white">{userProfile?.name || 'Google Account'}</p>
                        <p className="text-xs text-emerald-300">{userProfile?.email || 'Connected'}</p>
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

                  {/* Re-authenticate button to refresh token with newly enabled scopes */}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-slate-300">Need to update permissions?</span>
                    <button
                      onClick={onConnectGoogle}
                      className="px-3 py-1 rounded-lg bg-blue-600/40 hover:bg-blue-600 border border-blue-400/40 text-blue-200 text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Re-Authorize Google Permissions
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-800/60 border border-white/5 text-center space-y-3">
                  <p className="text-xs text-slate-300">
                    Connect your Google Account to synchronize Google Calendars and Google Photos.
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

              {/* Google Photos Album & Picker Section */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-pink-400" />
                    Google Photos for Slideshow
                  </label>
                  <button
                    onClick={onRefreshAlbums}
                    title="Refresh albums list from Google Photos"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>

                {/* Primary Picker Action Button */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-slate-900 border border-pink-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-pink-300">
                      Google Photos Picker API
                    </span>
                    {pickedPhotosCount > 0 && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                        {pickedPhotosCount} photos loaded
                      </span>
                    )}
                  </div>

                  {isLaunchingPicker ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2 text-xs text-amber-200 bg-amber-950/50 p-2 rounded-lg border border-amber-500/30">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 flex-shrink-0" />
                        <span>Google Photos is open. Choose photos and click <strong>"Done"</strong> in Google.</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={onCheckPickerNow}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Check for Photos Now</span>
                        </button>
                        <button
                          onClick={onCancelPicker}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-white/10"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={onLaunchPhotosPicker}
                      disabled={!Boolean(userToken || userProfile)}
                      className={`w-full py-2 px-3 rounded-lg font-bold text-xs transition flex items-center justify-center gap-2 ${
                        Boolean(userToken || userProfile)
                          ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-md shadow-pink-600/20'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                      }`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Select Photos from Google Photos</span>
                    </button>
                  )}
                </div>

                {photosStatus && (
                  <div
                    className={`p-2 rounded-lg text-xs flex items-center gap-2 ${
                      photosStatus.success
                        ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-950/40 text-amber-200 border border-amber-500/30'
                    }`}
                  >
                    {photosStatus.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{photosStatus.message}</span>
                  </div>
                )}

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
                    className="ml-2 px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition flex-shrink-0"
                  >
                    Select Album
                  </button>
                </div>

                {albums.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1 pt-1 border-t border-white/5">
                    {albums.map((alb) => (
                      <div
                        key={alb.id}
                        onClick={() => onSelectAlbum(alb)}
                        className={`p-1.5 rounded text-xs cursor-pointer flex items-center justify-between ${
                          alb.id === settings.selectedAlbumId
                            ? 'bg-pink-950/60 text-white font-bold border border-pink-500/40'
                            : 'bg-slate-900/40 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{alb.title}</span>
                        {alb.id === settings.selectedAlbumId && (
                          <span className="text-[10px] text-pink-400 font-bold ml-1">Selected</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Step-by-Step Google Cloud Console Guide */}
              <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-3 text-xs leading-relaxed">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                  <ExternalLink className="w-4 h-4" />
                  <span>Google Cloud Console Configuration Guide</span>
                </div>

                <div className="space-y-1 text-slate-300">
                  <p className="font-semibold text-white">1. Create Project & Enable APIs</p>
                  <p className="text-slate-400 pl-2">
                    In <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-blue-400 underline">console.cloud.google.com</a>, enable these two APIs under <strong>APIs & Services → Library</strong>:
                  </p>
                  <ul className="list-disc list-inside pl-4 text-slate-300 space-y-0.5">
                    <li><strong>Google Photos Picker API</strong> (Google's official API for family photo slideshows)</li>
                    <li><strong>Google Calendar API</strong> (for agenda schedule)</li>
                  </ul>
                </div>

                <div className="space-y-1 text-slate-300">
                  <p className="font-semibold text-white">2. Create OAuth 2.0 Client ID</p>
                  <p className="text-slate-400 pl-2">
                    Under <strong>Credentials → Create Credentials → OAuth Client ID</strong>:
                  </p>
                  <ul className="list-disc list-inside pl-4 text-slate-300 space-y-0.5">
                    <li>Application type: <strong>Web application</strong></li>
                    <li>
                      Under <strong>Authorized JavaScript origins</strong>, add:
                      <code className="block my-1 p-1.5 rounded bg-slate-900 text-emerald-400 font-mono text-[11px]">
                        https://therealtomwoods.github.io
                      </code>
                      <em>(Also include <code>http://localhost:5173</code> for local testing).</em>
                    </li>
                  </ul>
                </div>

                <div className="space-y-1 text-slate-300">
                  <p className="font-semibold text-white">3. Configure OAuth Consent Screen & Scopes</p>
                  <p className="text-slate-400 pl-2">
                    Under <strong>OAuth consent screen → Scopes for Google APIs</strong>, ensure these scopes are added:
                  </p>
                  <ul className="list-disc list-inside pl-4 text-slate-300 space-y-0.5 font-mono text-[11px]">
                    <li>.../auth/photospicker.mediaitems.readonly</li>
                    <li>.../auth/calendar.readonly</li>
                    <li>.../auth/sdm.service</li>
                  </ul>
                </div>

                <div className="space-y-1 text-slate-300">
                  <p className="font-semibold text-white">4. Add Test Users</p>
                  <p className="text-slate-400 pl-2">
                    In <strong>OAuth consent screen → Test users</strong>, add your personal Google email address so your login has full access while the app is in testing mode.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: WIDGETS */}
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
                      <p className="text-xs text-slate-400">Live forecast in Family Agenda ribbon</p>
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
                      <p className="font-bold text-white">Live Stock Ticker Widget</p>
                      <p className="text-xs text-slate-400">Stream real live market price for one ticker</p>
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

                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-slate-400">Presets:</span>
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
          {/* TAB 3: GENERAL */}
          {/* ========================================================================= */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Family Agenda Title / Family Name Customization */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 space-y-2">
                <div>
                  <p className="font-bold text-white">Family Calendar Ribbon Title</p>
                  <p className="text-xs text-slate-400">
                    Personalize the title banner on your calendar ribbon (e.g. &ldquo;Woods Family Agenda&rdquo;, &ldquo;Home Command Center&rdquo;)
                  </p>
                </div>
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={agendaTitleInput}
                    onChange={(e) => setAgendaTitleInput(e.target.value)}
                    onBlur={() => {
                      const val = agendaTitleInput.trim() || 'Family Agenda';
                      onUpdateSettings({ familyAgendaTitle: val });
                    }}
                    placeholder="Family Agenda"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => {
                      const val = agendaTitleInput.trim() || 'Family Agenda';
                      setAgendaTitleInput(val);
                      onUpdateSettings({ familyAgendaTitle: val });
                      setShowSavedToast(true);
                      setTimeout(() => setShowSavedToast(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow"
                  >
                    Save
                  </button>
                </div>
              </div>

              {/* Demo Mode Toggle */}
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">Interactive Demo Mode</p>
                  <p className="text-xs text-slate-400">
                    Use sample family calendars and photos instead of Google
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
