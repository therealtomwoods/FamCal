import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarInfo,
  CalendarEvent,
  PhotoAlbum,
  PhotoItem,
  WeatherData,
  StockItem,
  AppSettings,
} from './types';
import {
  DEMO_CALENDARS,
  getDemoEvents,
  DEMO_ALBUMS,
  DEMO_PHOTOS,
  DEMO_STOCKS,
  DEMO_NEST,
} from './mock/demoData';
import {
  getStoredAccessToken,
  getStoredUserProfile,
  clearStoredSession,
  triggerGoogleSignIn,
  UserProfile,
} from './services/googleAuth';
import {
  fetchUserCalendars,
  fetchAllSelectedCalendarEvents,
} from './services/googleCalendar';
import {
  fetchUserPhotoAlbums,
  fetchAlbumPhotos,
} from './services/googlePhotos';
import { fetchLiveWeather } from './services/weatherService';
import { fetchStockQuotes } from './services/stockService';

import { Slideshow } from './components/Slideshow';
import { AgendaCalendar } from './components/AgendaCalendar';
import { CalendarFilterModal } from './components/CalendarFilterModal';
import { AlbumSelectModal } from './components/AlbumSelectModal';
import { SettingsModal } from './components/SettingsModal';
import { KioskControls } from './components/KioskControls';
import { WeatherWidget } from './components/WeatherWidget';
import { ClockWidget } from './components/ClockWidget';
import { NestThermostatWidget } from './components/NestThermostatWidget';
import { StockTickerWidget } from './components/StockTickerWidget';

const SETTINGS_KEY = 'famcal_user_settings';

const DEFAULT_SETTINGS: AppSettings = {
  googleClientId: '',
  selectedCalendarIds: ['primary', 'cal-kids-sports', 'cal-school', 'cal-mom', 'cal-dad'],
  selectedAlbumId: 'album-family-vacation',
  selectedAlbumName: 'Summer Family Vacation 2026',
  slideshowInterval: 10,
  slideshowTransition: 'fade',
  showWeather: true,
  showStockTicker: true,
  showNestThermostat: true,
  showDigitalClock: true,
  weatherLocation: 'San Francisco, CA',
  weatherLat: 37.7749,
  weatherLon: -122.4194,
  weatherUnits: 'F',
  stockSymbols: ['S&P 500', 'AAPL', 'GOOGL', 'MSFT', 'NVDA'],
  isKioskFramed: true,
  isDemoMode: true,
  militaryTime: false,
};

export const App: React.FC = () => {
  // Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Auth & Profile
  const [userToken, setUserToken] = useState<string | null>(getStoredAccessToken());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(getStoredUserProfile());

  // Calendars & Events
  const [calendars, setCalendars] = useState<CalendarInfo[]>(DEMO_CALENDARS);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(settings.selectedCalendarIds);
  const [events, setEvents] = useState<CalendarEvent[]>(getDemoEvents());
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);

  // Photos & Albums
  const [albums, setAlbums] = useState<PhotoAlbum[]>(DEMO_ALBUMS);
  const [photos, setPhotos] = useState<PhotoItem[]>(DEMO_PHOTOS['album-family-vacation'] || []);

  // Floating Widgets Data
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [stocks, setStocks] = useState<StockItem[]>(DEMO_STOCKS);

  // Modals
  const [isCalendarFilterOpen, setIsCalendarFilterOpen] = useState(false);
  const [isAlbumSelectOpen, setIsAlbumSelectOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Save settings on update
  const updateSettings = (newPartial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newPartial };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Weather fetcher
  useEffect(() => {
    if (!settings.showWeather) return;

    fetchLiveWeather(
      settings.weatherLat,
      settings.weatherLon,
      settings.weatherLocation,
      settings.weatherUnits
    ).then((res) => setWeather(res));

    const interval = setInterval(() => {
      fetchLiveWeather(
        settings.weatherLat,
        settings.weatherLon,
        settings.weatherLocation,
        settings.weatherUnits
      ).then((res) => setWeather(res));
    }, 15 * 60 * 1000); // every 15 mins

    return () => clearInterval(interval);
  }, [settings.showWeather, settings.weatherLat, settings.weatherLon, settings.weatherLocation, settings.weatherUnits]);

  // Stocks fetcher
  useEffect(() => {
    if (!settings.showStockTicker) return;
    fetchStockQuotes(settings.stockSymbols).then((res) => setStocks(res));
  }, [settings.showStockTicker, settings.stockSymbols]);

  // Load calendar & photo data based on mode (Demo vs Live Google)
  const refreshData = useCallback(async () => {
    if (settings.isDemoMode || !userToken) {
      // Demo Mode Data
      setCalendars(DEMO_CALENDARS);
      const allDemo = getDemoEvents();
      const filtered = allDemo.filter((e) => selectedCalendarIds.includes(e.calendarId));
      setEvents(filtered);

      setAlbums(DEMO_ALBUMS);
      const currentAlbumKey = settings.selectedAlbumId || 'album-family-vacation';
      setPhotos(DEMO_PHOTOS[currentAlbumKey] || DEMO_PHOTOS['album-family-vacation'] || []);
      return;
    }

    // Google Live Data
    setIsLoadingEvents(true);
    try {
      // 1. Fetch Calendars
      const fetchedCalendars = await fetchUserCalendars(userToken);
      setCalendars(fetchedCalendars);

      // Default to select all calendars if first time
      const activeIds =
        selectedCalendarIds.length > 0
          ? selectedCalendarIds
          : fetchedCalendars.map((c) => c.id);

      // 2. Fetch Events for active calendars
      const fetchedEvents = await fetchAllSelectedCalendarEvents(
        userToken,
        fetchedCalendars,
        activeIds
      );
      setEvents(fetchedEvents);

      // 3. Fetch Photos Albums
      const fetchedAlbums = await fetchUserPhotoAlbums(userToken);
      setAlbums(fetchedAlbums);

      // 4. Fetch Media Items for selected album
      const albumToLoad = settings.selectedAlbumId || (fetchedAlbums[0] ? fetchedAlbums[0].id : '');
      if (albumToLoad) {
        const fetchedPhotos = await fetchAlbumPhotos(userToken, albumToLoad);
        setPhotos(fetchedPhotos);
      }
    } catch (err) {
      console.error('Failed to sync live Google data:', err);
    } finally {
      setIsLoadingEvents(false);
    }
  }, [settings.isDemoMode, userToken, selectedCalendarIds, settings.selectedAlbumId]);

  // Initial load and periodic refresh
  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 5 * 60 * 1000); // refresh every 5 mins
    return () => clearInterval(interval);
  }, [refreshData]);

  // Handle Google Auth Connect
  const handleConnectGoogle = () => {
    if (!settings.googleClientId) {
      alert('Please enter your Google OAuth Client ID first in the Settings "Google Account" tab.');
      return;
    }
    triggerGoogleSignIn(settings.googleClientId, (token) => {
      setUserToken(token);
      setUserProfile(getStoredUserProfile());
      updateSettings({ isDemoMode: false });
    });
  };

  const handleDisconnectGoogle = () => {
    clearStoredSession();
    setUserToken(null);
    setUserProfile(null);
    updateSettings({ isDemoMode: true });
    refreshData();
  };

  // Calendar Selection Handlers
  const handleToggleCalendar = (id: string) => {
    const updated = selectedCalendarIds.includes(id)
      ? selectedCalendarIds.filter((item) => item !== id)
      : [...selectedCalendarIds, id];

    setSelectedCalendarIds(updated);
    updateSettings({ selectedCalendarIds: updated });
  };

  const handleSelectAllCalendars = () => {
    const allIds = calendars.map((c) => c.id);
    setSelectedCalendarIds(allIds);
    updateSettings({ selectedCalendarIds: allIds });
  };

  const handleDeselectAllCalendars = () => {
    setSelectedCalendarIds([]);
    updateSettings({ selectedCalendarIds: [] });
  };

  // Album Selection Handler
  const handleSelectAlbum = async (album: PhotoAlbum) => {
    updateSettings({
      selectedAlbumId: album.id,
      selectedAlbumName: album.title,
    });

    if (settings.isDemoMode || !userToken) {
      setPhotos(DEMO_PHOTOS[album.id] || DEMO_PHOTOS['album-family-vacation'] || []);
    } else {
      const albumPhotos = await fetchAlbumPhotos(userToken, album.id);
      setPhotos(albumPhotos);
    }
  };

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans overflow-hidden">
      {/* 9:16 Aspect Display Container */}
      <div
        className={`w-full h-full flex flex-col transition-all duration-300 ${
          settings.isKioskFramed
            ? 'max-w-[480px] h-[98vh] max-h-[1050px] aspect-[9/16] rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9)] border-4 border-slate-800/80 ring-1 ring-white/10'
            : 'max-w-none'
        }`}
      >
        {/* ========================================================= */}
        {/* TOP 1/3: PHOTO SLIDESHOW & FLOATING WIDGETS */}
        {/* ========================================================= */}
        <div className="relative w-full h-[35%] flex-shrink-0 overflow-hidden bg-black">
          <Slideshow
            photos={photos}
            albumTitle={settings.selectedAlbumName || 'Google Photos'}
            intervalSeconds={settings.slideshowInterval}
            onOpenAlbumPicker={() => setIsAlbumSelectOpen(true)}
          />

          {/* Floating Top Widgets Overlay (Weather, Clock, Nest) */}
          <div className="absolute top-12 left-3 right-3 flex items-start justify-between gap-2 z-10 pointer-events-none">
            {/* Left: Weather or Nest */}
            <div className="flex flex-col gap-2 pointer-events-auto">
              {settings.showWeather && (
                <WeatherWidget weather={weather} units={settings.weatherUnits} />
              )}
              {settings.showNestThermostat && (
                <NestThermostatWidget initialState={DEMO_NEST} />
              )}
            </div>

            {/* Right: Digital Clock & Date */}
            <div className="pointer-events-auto">
              {settings.showDigitalClock && (
                <ClockWidget militaryTime={settings.militaryTime} />
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* OPTIONAL FLOATING ADD-ON: HORIZONTAL STOCK TICKER */}
        {/* ========================================================= */}
        {settings.showStockTicker && (
          <div className="flex-shrink-0 z-10 shadow-sm">
            <StockTickerWidget stocks={stocks} />
          </div>
        )}

        {/* ========================================================= */}
        {/* BOTTOM 2/3: AGENDA CALENDAR DISPLAY */}
        {/* ========================================================= */}
        <div className="flex-1 w-full overflow-hidden flex flex-col bg-slate-950">
          <AgendaCalendar
            events={events}
            calendars={calendars}
            selectedCalendarIds={selectedCalendarIds}
            militaryTime={settings.militaryTime}
            onOpenCalendarFilter={() => setIsCalendarFilterOpen(true)}
            isLoading={isLoadingEvents}
          />
        </div>

        {/* ========================================================= */}
        {/* BOTTOM KIOSK CONTROLS & STATUS BAR */}
        {/* ========================================================= */}
        <KioskControls
          isDemoMode={settings.isDemoMode}
          onRefresh={refreshData}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenCalendarFilter={() => setIsCalendarFilterOpen(true)}
          isFramed={settings.isKioskFramed}
          onToggleFraming={() => updateSettings({ isKioskFramed: !settings.isKioskFramed })}
        />
      </div>

      {/* ========================================================= */}
      {/* MODALS */}
      {/* ========================================================= */}
      <CalendarFilterModal
        isOpen={isCalendarFilterOpen}
        onClose={() => setIsCalendarFilterOpen(false)}
        calendars={calendars}
        selectedIds={selectedCalendarIds}
        onToggleCalendar={handleToggleCalendar}
        onSelectAll={handleSelectAllCalendars}
        onDeselectAll={handleDeselectAllCalendars}
      />

      <AlbumSelectModal
        isOpen={isAlbumSelectOpen}
        onClose={() => setIsAlbumSelectOpen(false)}
        albums={albums}
        selectedAlbumId={settings.selectedAlbumId}
        onSelectAlbum={handleSelectAlbum}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        userProfile={userProfile}
        onConnectGoogle={handleConnectGoogle}
        onDisconnectGoogle={handleDisconnectGoogle}
        albums={albums}
        onSelectAlbum={handleSelectAlbum}
      />
    </div>
  );
};
