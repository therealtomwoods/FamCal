export type CalendarType = 'primary' | 'secondary' | 'subscribed';

export interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  backgroundColor: string;
  foregroundColor: string;
  primary?: boolean;
  type: CalendarType;
  selected: boolean;
  accessRole?: string;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  calendarName: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string; // Hex color (resolved from event.colorId or calendar color)
  attendeesCount?: number;
  htmlLink?: string;
}

export interface PhotoItem {
  id: string;
  url: string;
  baseUrl?: string;
  filename?: string;
  caption?: string;
  dateTaken?: string;
  width?: number;
  height?: number;
}

export interface PhotoAlbum {
  id: string;
  title: string;
  coverPhotoBaseUrl?: string;
  mediaItemsCount?: number;
}

export interface WeatherData {
  temp: number;
  condition: string;
  conditionCode: number;
  high: number;
  low: number;
  humidity: number;
  city: string;
  icon: string;
}

export interface StockItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface NestThermostatState {
  currentTemp: number;
  targetTemp: number;
  mode: 'heat' | 'cool' | 'eco' | 'off';
  status: 'heating' | 'cooling' | 'idle';
  humidity: number;
  deviceName: string;
  eco: boolean;
}

export interface AppSettings {
  googleClientId: string;
  selectedCalendarIds: string[];
  selectedAlbumId: string;
  selectedAlbumName: string;
  slideshowInterval: number; // seconds
  slideshowTransition: 'fade' | 'slide' | 'zoom';
  showWeather: boolean;
  showStockTicker: boolean;
  showNestThermostat: boolean;
  showDigitalClock: boolean;
  weatherLocation: string;
  weatherLat: number;
  weatherLon: number;
  weatherUnits: 'F' | 'C';
  stockSymbols: string[];
  isKioskFramed: boolean; // frame in 9:16 aspect box on wide screens
  isDemoMode: boolean;
  militaryTime: boolean;
}
