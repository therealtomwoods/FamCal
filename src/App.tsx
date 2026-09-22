import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarInfo,
  CalendarEvent,
  PhotoAlbum,
  PhotoItem,
  WeatherData,
  StockItem,
  NestThermostatState,
  AppSettings,
} from './types';
import {
  DEMO_CALENDARS,
  getDemoEvents,
  DEMO_ALBUMS,
  DEMO_PHOTOS,
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
import { fetchSingleStockQuote } from './services/stockService';
import {
  fetchRealNestThermostat,
  setNestTargetTemperature,
} from './services/nestService';

import { Slideshow } from './components/Slideshow';
import { AgendaCalendar } from './components/AgendaCalendar';
import { CalendarFilterModal } from './components/CalendarFilterModal';
import { AlbumSelectModal } from './components/AlbumSelectModal';
import { SettingsModal } from './components/SettingsModal';
import { KioskControls } from './components/KioskControls';
import { ClockWidget } from './components/ClockWidget';

const SETTINGS_KEY = 'famcal_user_settings';

const DEFAULT_SETTINGS: AppSettings = {
  googleClientId: '',
  nestProjectId: '',
  selectedCalendarIds: ['primary', 'cal-kids-sports', 'cal-school', 'cal-mom', 'cal-dad'],
  selectedAlbumId: 'ALL_LIBRARY_PHOTOS',
  selectedAlbumName: '📸 All Recent Google Photos',
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
  monitoredStock: 'SPY',
  isKioskFramed: true,
  isDemoMode: false,
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
  const [photosStatus, setPhotosStatus] = useState<{ success: boolean; message: string } | undefined>();

  // Widgets Data
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [monitoredStockItem, setMonitoredStockItem] = useState<StockItem | null>(null);
  const [nestState, setNestState] = useState<NestThermostatState>(DEMO_NEST);
  const [nestStatus, setNestStatus] = useState<{ success: boolean; message: string } | undefined>();

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
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [settings.showWeather, settings.weatherLat, settings.weatherLon, settings.weatherLocation, settings.weatherUnits]);

  // Real Live Stock Quote fetcher
  useEffect(() => {
    if (!settings.showStockTicker) return;

    const fetchQuote = () => {
      fetchSingleStockQuote(settings.monitoredStock).then((res) => setMonitoredStockItem(res));
    };

    fetchQuote();
    const interval = setInterval(fetchQuote, 25 * 1000); // refresh every 25s
    return () => clearInterval(interval);
  }, [settings.showStockTicker, settings.monitoredStock]);

  // Real Nest Thermostat fetcher
  useEffect(() => {
    if (!settings.showNestThermostat) return;

    const syncNest = async () => {
      if (userToken && settings.nestProjectId) {
        const nestRes = await fetchRealNestThermostat(
          userToken,
          settings.nestProjectId,
          settings.weatherUnits
        );
        if (nestRes.success && nestRes.thermostat) {
          setNestState(nestRes.thermostat);
          setNestStatus({ success: true, message: `Connected: ${nestRes.thermostat.deviceName}` });
        } else {
          setNestStatus({
            success: false,
            message: nestRes.error || 'Nest connection failed. Check SDM Project ID and Permissions.',
          });
        }
      } else if (!settings.nestProjectId && userToken) {
        setNestStatus({
          success: false,
          message: 'Nest Project ID not set. Enter your Device Access ID in Settings.',
        });
      }
    };

    syncNest();
    const interval = setInterval(syncNest, 60 * 1000);
    return () => clearInterval(interval);
  }, [settings.showNestThermostat, userToken, settings.nestProjectId, settings.weatherUnits]);

  // Nest setpoint adjustment handler
  const handleNestTempAdjust = async (delta: number) => {
    const newTarget = nestState.targetTemp + delta;
    setNestState((prev) => ({ ...prev, targetTemp: newTarget }));

    if (userToken && nestState.deviceId && nestState.isRealDevice) {
      await setNestTargetTemperature(
        userToken,
        nestState.deviceId,
        newTarget,
        nestState.mode,
        settings.weatherUnits
      );
    }
  };

  // Google Photos Albums Fetcher
  const handleRefreshAlbums = useCallback(async () => {
    if (userToken && !settings.isDemoMode) {
      const result = await fetchUserPhotoAlbums(userToken);
      setAlbums(result.albums);
      if (result.success) {
        setPhotosStatus({
          success: true,
          message: `Connected: ${result.albums.length} albums found in Google Photos library`,
        });
      } else {
        setPhotosStatus({
          success: false,
          message: result.error || 'Google Photos library could not be fetched.',
        });
      }
    } else {
      setAlbums(DEMO_ALBUMS);
    }
  }, [userToken, settings.isDemoMode]);

  // Load calendar & photo data
  const refreshData = useCallback(async () => {
    // If user has not signed in with Google, or explicitly toggled demo mode
    if (settings.isDemoMode || !userToken) {
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
      const albumResult = await fetchUserPhotoAlbums(userToken);
      setAlbums(albumResult.albums);
      if (albumResult.success) {
        setPhotosStatus({
          success: true,
          message: `Connected: ${albumResult.albums.length} albums found`,
        });
      } else {
        setPhotosStatus({
          success: false,
          message: albumResult.error || 'Could not load Google Photos library.',
        });
      }

      // 4. Fetch Media Items for selected album (or ALL_LIBRARY_PHOTOS by default)
      const albumToLoad =
        settings.selectedAlbumId && settings.selectedAlbumId !== 'album-family-vacation'
          ? settings.selectedAlbumId
          : albumResult.albums[0]?.id || 'ALL_LIBRARY_PHOTOS';

      const fetchedPhotos = await fetchAlbumPhotos(userToken, albumToLoad);
      if (fetchedPhotos.length > 0) {
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
    const interval = setInterval(refreshData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Handle Google Auth Connect
  const handleConnectGoogle = () => {
    if (!settings.googleClientId) {
      alert('Please enter your Google OAuth Client ID first in Settings.');
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

    if (userToken && !settings.isDemoMode) {
      const albumPhotos = await fetchAlbumPhotos(userToken, album.id);
      if (albumPhotos.length > 0) {
        setPhotos(albumPhotos);
      }
    } else {
      setPhotos(DEMO_PHOTOS[album.id] || DEMO_PHOTOS['album-family-vacation'] || []);
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
        {/* TOP 1/3: PHOTO SLIDESHOW (with LARGE CLOCK in top-right) */}
        {/* ========================================================= */}
        <div className="relative w-full h-[33%] flex-shrink-0 overflow-hidden bg-black">
          <Slideshow
            photos={photos}
            albumTitle={settings.selectedAlbumName || 'Google Photos'}
            intervalSeconds={settings.slideshowInterval}
            onOpenAlbumPicker={() => setIsAlbumSelectOpen(true)}
          />

          {/* Top-Right Large Clock */}
          {settings.showDigitalClock && (
            <div className="absolute top-3 right-3 z-20 pointer-events-none">
              <ClockWidget militaryTime={settings.militaryTime} />
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* BOTTOM 2/3: AGENDA CALENDAR DISPLAY WITH IN-LINE RIBBON   */}
        {/* ========================================================= */}
        <div className="flex-1 w-full overflow-hidden flex flex-col bg-slate-950">
          <AgendaCalendar
            events={events}
            calendars={calendars}
            selectedCalendarIds={selectedCalendarIds}
            militaryTime={settings.militaryTime}
            onOpenCalendarFilter={() => setIsCalendarFilterOpen(true)}
            isLoading={isLoadingEvents}
            // IN-LINE WIDGETS IN THE FAMILY AGENDA RIBBON
            weather={weather}
            stock={monitoredStockItem}
            thermostat={nestState}
            showWeather={settings.showWeather}
            showStockTicker={settings.showStockTicker}
            showNestThermostat={settings.showNestThermostat}
            weatherUnits={settings.weatherUnits}
            onAdjustNestTemp={handleNestTempAdjust}
          />
        </div>

        {/* ========================================================= */}
        {/* BOTTOM KIOSK CONTROLS & STATUS BAR */}
        {/* ========================================================= */}
        <KioskControls
          isDemoMode={settings.isDemoMode || !userToken}
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
        onRefreshAlbums={handleRefreshAlbums}
        photosError={photosStatus && !photosStatus.success ? photosStatus.message : undefined}
        isGoogleConnected={!!userToken}
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
        onRefreshAlbums={handleRefreshAlbums}
        onOpenAlbumModal={() => setIsAlbumSelectOpen(true)}
        nestStatus={nestStatus}
        photosStatus={photosStatus}
      />
    </div>
  );
};
