import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  launchGooglePhotosPicker,
  checkActivePickerNow,
  cancelActivePickerSession,
  getStoredPickedPhotos,
  loadStoredPhotos,
  savePhotosToIndexedDB,
  saveStoredPickedPhotos,
  hydratePhotosWithImages,
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
  familyAgendaTitle: 'Family Agenda',
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
  const initialPicked = getStoredPickedPhotos();
  const [albums, setAlbums] = useState<PhotoAlbum[]>(DEMO_ALBUMS);
  const [photos, setPhotos] = useState<PhotoItem[]>(
    initialPicked.length > 0 ? initialPicked : DEMO_PHOTOS['album-family-vacation'] || []
  );
  const [photosStatus, setPhotosStatus] = useState<{ success: boolean; message: string } | undefined>(
    initialPicked.length > 0
      ? { success: true, message: `Loaded ${initialPicked.length} photos from Google Photos` }
      : undefined
  );
  const [isLaunchingPicker, setIsLaunchingPicker] = useState<boolean>(false);

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

  // 1. Load high-resolution cached photos from IndexedDB on startup
  useEffect(() => {
    loadStoredPhotos().then((stored) => {
      if (stored && stored.length > 0) {
        setPhotos(stored);
      }
    });
  }, []);

  const hydratedBatchRef = useRef<string>('');

  // 2. Automatically hydrate unhydrated Google Photos whenever userToken is available
  useEffect(() => {
    if (!userToken || settings.isDemoMode) return;

    const unhydrated = photos.filter(
      (p) =>
        p.baseUrl &&
        !p.url.startsWith('data:') &&
        !p.url.startsWith('blob:') &&
        !p.url.includes('unsplash.com') &&
        !(p as any)._hydrationAttempted
    );

    if (unhydrated.length === 0) return;

    const batchSig = photos.map((p) => p.id).join(',');
    if (hydratedBatchRef.current === batchSig) return;
    hydratedBatchRef.current = batchSig;

    let isMounted = true;
    hydratePhotosWithImages(photos, userToken, (progress) => {
      if (isMounted) {
        setPhotosStatus({ success: true, message: progress });
      }
    })
      .then((hydrated) => {
        if (!isMounted) return;
        setPhotos(hydrated);
        savePhotosToIndexedDB(hydrated);
        saveStoredPickedPhotos(hydrated);
        const readyCount = hydrated.filter((p) => p.url.startsWith('data:') || p.url.startsWith('blob:')).length;
        setPhotosStatus({
          success: true,
          message: `✓ ${readyCount} Google Photos loaded for slideshow`,
        });
      })
      .catch((err) => {
        console.warn('Auto-hydration failed:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [userToken, photos, settings.isDemoMode]);

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

      // 4. Fetch Media Items for selected album (or PICKED_GOOGLE_PHOTOS if available)
      const currentStored = await loadStoredPhotos();
      if (currentStored.length > 0 && (!settings.selectedAlbumId || settings.selectedAlbumId === 'PICKED_GOOGLE_PHOTOS')) {
        setPhotos(currentStored);
      } else {
        const albumToLoad =
          settings.selectedAlbumId && settings.selectedAlbumId !== 'album-family-vacation'
            ? settings.selectedAlbumId
            : currentStored.length > 0
            ? 'PICKED_GOOGLE_PHOTOS'
            : albumResult.albums[0]?.id || 'ALL_LIBRARY_PHOTOS';

        const fetchedPhotos = await fetchAlbumPhotos(userToken, albumToLoad);
        if (fetchedPhotos.length > 0) {
          setPhotos(fetchedPhotos);
        }
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

  // Google Photos Picker Flow
  const handleLaunchPhotosPicker = async () => {
    if (!userToken) {
      alert('Please connect your Google account first in Settings.');
      return;
    }
    setIsLaunchingPicker(true);
    setPhotosStatus({
      success: true,
      message: 'Opening Google Photos picker window...',
    });
    try {
      const result = await launchGooglePhotosPicker(userToken, (statusMsg) => {
        setPhotosStatus({ success: true, message: statusMsg });
      });
      if (result.success && result.photos.length > 0) {
        setPhotos(result.photos);
        updateSettings({
          selectedAlbumId: 'PICKED_GOOGLE_PHOTOS',
          selectedAlbumName: `📸 Selected Google Photos (${result.photos.length})`,
        });
        setPhotosStatus({
          success: true,
          message: `✓ Active: ${result.photos.length} photos selected from Google Photos`,
        });
        handleRefreshAlbums();
      } else {
        setPhotosStatus({
          success: false,
          message: result.error || 'Photo selection was cancelled.',
        });
      }
    } catch (err: any) {
      setPhotosStatus({
        success: false,
        message: err?.message || 'Failed to select photos from Google Photos',
      });
    } finally {
      setIsLaunchingPicker(false);
    }
  };

  const handleCheckPickerNow = async () => {
    setPhotosStatus({ success: true, message: 'Checking Google Photos selection...' });
    try {
      const result = await checkActivePickerNow();
      if (result.success && result.photos.length > 0) {
        setPhotos(result.photos);
        updateSettings({
          selectedAlbumId: 'PICKED_GOOGLE_PHOTOS',
          selectedAlbumName: `📸 Selected Google Photos (${result.photos.length})`,
        });
        setPhotosStatus({
          success: true,
          message: `✓ Active: ${result.photos.length} photos selected from Google Photos`,
        });
        setIsLaunchingPicker(false);
        handleRefreshAlbums();
      } else {
        setPhotosStatus({
          success: false,
          message: result.error || 'Google Photos has not received your selection yet.',
        });
      }
    } catch (err: any) {
      setPhotosStatus({
        success: false,
        message: err?.message || 'Check failed',
      });
    }
  };

  const handleCancelPicker = async () => {
    await cancelActivePickerSession();
    setIsLaunchingPicker(false);
    setPhotosStatus(undefined);
  };

  // Handle Google Auth Connect
  const handleConnectGoogle = () => {
    if (!settings.googleClientId) {
      alert('Please enter your Google OAuth Client ID first in Settings.');
      return;
    }
    triggerGoogleSignIn(
      settings.googleClientId,
      (token, baselineProfile) => {
        setUserToken(token);
        if (baselineProfile) {
          setUserProfile(baselineProfile);
        }
        updateSettings({ isDemoMode: false });
      },
      (fullProfile) => {
        setUserProfile(fullProfile);
      }
    );
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

    // If explicit demo album selected, immediately display its photos
    if (DEMO_PHOTOS[album.id]) {
      setPhotos(DEMO_PHOTOS[album.id]);
      return;
    }

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
        {/* TOP 45%: PHOTO SLIDESHOW (with LARGE CLOCK in top-right)  */}
        {/* ========================================================= */}
        <div className="relative w-full h-[45%] flex-shrink-0 overflow-hidden bg-black">
          <Slideshow
            photos={photos}
            albumTitle={settings.selectedAlbumName || 'Google Photos'}
            intervalSeconds={settings.slideshowInterval}
            onOpenAlbumPicker={() => setIsAlbumSelectOpen(true)}
            userToken={userToken}
          />

          {/* Top-Right Large Clock */}
          {settings.showDigitalClock && (
            <div className="absolute top-3 right-3 z-20 pointer-events-none">
              <ClockWidget militaryTime={settings.militaryTime} />
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* BOTTOM 55%: AGENDA CALENDAR DISPLAY WITH IN-LINE RIBBON   */}
        {/* ========================================================= */}
        <div className="flex-1 w-full overflow-hidden flex flex-col bg-black">
          <AgendaCalendar
            events={events}
            calendars={calendars}
            selectedCalendarIds={selectedCalendarIds}
            militaryTime={settings.militaryTime}
            agendaTitle={settings.familyAgendaTitle || 'Family Agenda'}
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
        onLaunchPhotosPicker={handleLaunchPhotosPicker}
        onCheckPickerNow={handleCheckPickerNow}
        onCancelPicker={handleCancelPicker}
        isLaunchingPicker={isLaunchingPicker}
        pickedPhotosCount={photos.length}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        userToken={userToken}
        userProfile={userProfile}
        onConnectGoogle={handleConnectGoogle}
        onDisconnectGoogle={handleDisconnectGoogle}
        albums={albums}
        onSelectAlbum={handleSelectAlbum}
        onRefreshAlbums={handleRefreshAlbums}
        onOpenAlbumModal={() => setIsAlbumSelectOpen(true)}
        onLaunchPhotosPicker={handleLaunchPhotosPicker}
        onCheckPickerNow={handleCheckPickerNow}
        onCancelPicker={handleCancelPicker}
        isLaunchingPicker={isLaunchingPicker}
        pickedPhotosCount={photos.length}
        nestStatus={nestStatus}
        photosStatus={photosStatus}
      />
    </div>
  );
};
