import { CalendarInfo, CalendarEvent, PhotoAlbum, PhotoItem, StockItem, NestThermostatState } from '../types';

export const DEMO_CALENDARS: CalendarInfo[] = [
  {
    id: 'primary',
    summary: 'Family Central',
    description: 'Shared family master schedule',
    backgroundColor: '#0284c7', // Sky blue
    foregroundColor: '#ffffff',
    primary: true,
    type: 'primary',
    selected: true,
  },
  {
    id: 'cal-kids-sports',
    summary: 'Kids Sports & Activities',
    description: 'Soccer, swim, gymnastics & practices',
    backgroundColor: '#ea580c', // Orange
    foregroundColor: '#ffffff',
    primary: false,
    type: 'secondary',
    selected: true,
  },
  {
    id: 'cal-school',
    summary: 'Lincoln School District',
    description: 'School events, exams, half days & parent nights',
    backgroundColor: '#8b5cf6', // Purple
    foregroundColor: '#ffffff',
    primary: false,
    type: 'subscribed',
    selected: true,
  },
  {
    id: 'cal-mom',
    summary: 'Mom Schedule',
    description: 'Personal, appointments & fitness',
    backgroundColor: '#e11d48', // Rose
    foregroundColor: '#ffffff',
    primary: false,
    type: 'secondary',
    selected: true,
  },
  {
    id: 'cal-dad',
    summary: 'Dad Travel & Work',
    description: 'Work flights, conferences & projects',
    backgroundColor: '#059669', // Emerald
    foregroundColor: '#ffffff',
    primary: false,
    type: 'secondary',
    selected: true,
  },
  {
    id: 'cal-holidays',
    summary: 'Holidays in United States',
    description: 'Public holidays and observances',
    backgroundColor: '#475569', // Slate
    foregroundColor: '#ffffff',
    primary: false,
    type: 'subscribed',
    selected: true,
  }
];

export function getDemoEvents(): CalendarEvent[] {
  const now = new Date();
  
  // Helper to create dates relative to today
  const makeDate = (daysFromNow: number, hours: number, minutes: number = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  return [
    // --- TODAY'S EVENTS ---
    {
      id: 'demo-1',
      calendarId: 'cal-mom',
      calendarName: 'Mom Schedule',
      title: 'Morning Yoga Flow',
      location: 'CorePower Studio 2 (820 Grand Ave)',
      start: makeDate(0, 7, 30),
      end: makeDate(0, 8, 30),
      allDay: false,
      color: '#e11d48',
    },
    {
      id: 'demo-2',
      calendarId: 'cal-school',
      calendarName: 'Lincoln School District',
      title: 'Elementary Early Dismissal (12:30 PM)',
      location: 'Lincoln Elementary Campus',
      start: makeDate(0, 0, 0),
      end: makeDate(0, 23, 59),
      allDay: true,
      color: '#8b5cf6',
    },
    {
      id: 'demo-3',
      calendarId: 'primary',
      calendarName: 'Family Central',
      title: 'Pediatric Dental Checkups (Leo & Maya)',
      location: 'Oakwood Dental Clinic - Suite 410',
      start: makeDate(0, 14, 0),
      end: makeDate(0, 15, 15),
      allDay: false,
      color: '#0284c7',
    },
    {
      id: 'demo-4',
      calendarId: 'cal-kids-sports',
      calendarName: 'Kids Sports & Activities',
      title: 'U11 Soccer Practice vs Rapids',
      location: 'Sunset Regional Park — Field 4B (1420 W 8th St)',
      start: makeDate(0, 16, 45),
      end: makeDate(0, 18, 15),
      allDay: false,
      color: '#ea580c',
    },
    {
      id: 'demo-5',
      calendarId: 'primary',
      calendarName: 'Family Central',
      title: 'Family Taco Tuesday & Board Games',
      location: 'Home (Kitchen & Patio)',
      start: makeDate(0, 18, 45),
      end: makeDate(0, 20, 30),
      allDay: false,
      color: '#0284c7',
    },

    // --- TOMORROW'S EVENTS ---
    {
      id: 'demo-6',
      calendarId: 'cal-dad',
      calendarName: 'Dad Travel & Work',
      title: 'Flight to Chicago (United UA 824)',
      location: 'Terminal 2, Gate C14 - Metro Airport',
      start: makeDate(1, 8, 15),
      end: makeDate(1, 11, 45),
      allDay: false,
      color: '#059669',
    },
    {
      id: 'demo-7',
      calendarId: 'cal-kids-sports',
      calendarName: 'Kids Sports & Activities',
      title: 'Maya Gymnastics Tumbling Level 3',
      location: 'Apex Athletic Academy (Gym 2)',
      start: makeDate(1, 15, 30),
      end: makeDate(1, 17, 0),
      allDay: false,
      color: '#ea580c',
    },
    {
      id: 'demo-8',
      calendarId: 'cal-school',
      calendarName: 'Lincoln School District',
      title: 'PTA Fall Festival Planning Committee',
      location: 'School Library Media Center',
      start: makeDate(1, 18, 30),
      end: makeDate(1, 19, 45),
      allDay: false,
      color: '#8b5cf6',
    },

    // --- DAY AFTER TOMORROW ---
    {
      id: 'demo-9',
      calendarId: 'primary',
      calendarName: 'Family Central',
      title: 'Grandpa & Grandma Visit for Dinner',
      location: 'Home Dining Room',
      start: makeDate(2, 17, 30),
      end: makeDate(2, 21, 0),
      allDay: false,
      color: '#0284c7',
    },
    {
      id: 'demo-10',
      calendarId: 'cal-kids-sports',
      calendarName: 'Kids Sports & Activities',
      title: 'Weekend Soccer Tournament: Game 1',
      location: 'Highland Park Sports Complex - Pitch 1',
      start: makeDate(3, 9, 30),
      end: makeDate(3, 11, 0),
      allDay: false,
      color: '#ea580c',
    },
    {
      id: 'demo-11',
      calendarId: 'primary',
      calendarName: 'Family Central',
      title: 'Weekly Grocery Haul & Farmers Market',
      location: 'Downtown Farmers Market Pavilion',
      start: makeDate(3, 11, 30),
      end: makeDate(3, 13, 0),
      allDay: false,
      color: '#0284c7',
    },
    {
      id: 'demo-12',
      calendarId: 'cal-holidays',
      calendarName: 'Holidays in United States',
      title: 'Autumn Equinox Celebration',
      location: 'Community Botanical Gardens',
      start: makeDate(4, 0, 0),
      end: makeDate(4, 23, 59),
      allDay: true,
      color: '#475569',
    }
  ];
}

export const DEMO_ALBUMS: PhotoAlbum[] = [
  {
    id: 'album-family-vacation',
    title: 'Summer Family Vacation 2026',
    coverPhotoBaseUrl: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=1200&q=80',
    mediaItemsCount: 42,
  },
  {
    id: 'album-kids-adventures',
    title: 'Kids Outdoor Adventures',
    coverPhotoBaseUrl: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80',
    mediaItemsCount: 38,
  },
  {
    id: 'album-weekend-hikes',
    title: 'Weekend Mountain Hikes',
    coverPhotoBaseUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    mediaItemsCount: 29,
  },
  {
    id: 'album-holiday-celebrations',
    title: 'Holidays & Birthdays',
    coverPhotoBaseUrl: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&w=1200&q=80',
    mediaItemsCount: 56,
  }
];

export const DEMO_PHOTOS: Record<string, PhotoItem[]> = {
  'album-family-vacation': [
    {
      id: 'photo-1',
      url: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=1400&q=85',
      caption: 'Sunset beach walk along the Pacific coast',
      dateTaken: 'July 14, 2026'
    },
    {
      id: 'photo-2',
      url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1400&q=85',
      caption: 'Kayaking in the crystal blue alpine lake',
      dateTaken: 'July 16, 2026'
    },
    {
      id: 'photo-3',
      url: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=1400&q=85',
      caption: 'Campfire under the starry summer sky',
      dateTaken: 'July 18, 2026'
    },
    {
      id: 'photo-4',
      url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1400&q=85',
      caption: 'Family road trip through scenic redwoods',
      dateTaken: 'July 20, 2026'
    }
  ],
  'album-kids-adventures': [
    {
      id: 'photo-5',
      url: 'https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&w=1400&q=85',
      caption: 'Maya scoring her first championship goal!',
      dateTaken: 'August 5, 2026'
    },
    {
      id: 'photo-6',
      url: 'https://images.unsplash.com/photo-1533227268428-f9ed0900fb3b?auto=format&fit=crop&w=1400&q=85',
      caption: 'Leo building tree forts at the park',
      dateTaken: 'August 12, 2026'
    }
  ]
};

export const DEMO_STOCKS: StockItem[] = [
  { symbol: 'S&P 500', name: 'S&P 500', price: 5864.20, change: 32.15, changePercent: 0.55 },
  { symbol: 'AAPL', name: 'Apple Inc.', price: 232.80, change: 1.95, changePercent: 0.84 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 178.45, change: -0.62, changePercent: -0.35 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 438.10, change: 3.40, changePercent: 0.78 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 128.90, change: 4.10, changePercent: 3.28 },
  { symbol: 'AMZN', name: 'Amazon.com', price: 189.25, change: 0.85, changePercent: 0.45 },
];

export const DEMO_NEST: NestThermostatState = {
  currentTemp: 71,
  targetTemp: 70,
  mode: 'cool',
  status: 'cooling',
  humidity: 44,
  deviceName: 'Main Floor Nest Thermostat',
  eco: false
};
