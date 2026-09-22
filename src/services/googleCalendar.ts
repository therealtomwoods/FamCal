import { CalendarInfo, CalendarEvent, CalendarType } from '../types';

// Standard Google Calendar Color Palette
export const GOOGLE_EVENT_COLORS: Record<string, string> = {
  '1': '#7986cb', // Lavender
  '2': '#33b679', // Sage
  '3': '#8e24aa', // Grape
  '4': '#e67c73', // Flamingo
  '5': '#f6bf26', // Banana
  '6': '#f4511e', // Tangerine
  '7': '#039be5', // Peacock
  '8': '#616161', // Graphite
  '9': '#3f51b5', // Blueberry
  '10': '#0b8043', // Basil
  '11': '#d50000', // Tomato
};

interface GCalListItem {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
  selected?: boolean;
}

interface GCalEventItem {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  htmlLink?: string;
  attendees?: Array<{ displayName?: string; email?: string }>;
}

export async function fetchUserCalendars(token: string): Promise<CalendarInfo[]> {
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch calendars: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const items: GCalListItem[] = data.items || [];

    return items.map((item) => {
      let type: CalendarType = 'secondary';
      if (item.primary) {
        type = 'primary';
      } else if (item.accessRole === 'reader' || item.accessRole === 'freeBusyReader') {
        type = 'subscribed';
      }

      return {
        id: item.id,
        summary: item.summary || 'Untitled Calendar',
        description: item.description,
        backgroundColor: item.backgroundColor || '#0284c7',
        foregroundColor: item.foregroundColor || '#ffffff',
        primary: !!item.primary,
        type,
        selected: true, // Default to selected
        accessRole: item.accessRole,
      };
    });
  } catch (error) {
    console.error('Error fetching Google Calendars:', error);
    throw error;
  }
}

export async function fetchCalendarEvents(
  token: string,
  calendar: CalendarInfo,
  timeMin: Date = new Date(),
  daysAhead: number = 7
): Promise<CalendarEvent[]> {
  try {
    const timeMax = new Date(timeMin);
    timeMax.setDate(timeMax.getDate() + daysAhead);

    // Set timeMin to beginning of today
    const startOfToday = new Date(timeMin);
    startOfToday.setHours(0, 0, 0, 0);

    const params = new URLSearchParams({
      timeMin: startOfToday.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      console.warn(`Could not fetch events for calendar ${calendar.summary}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const items: GCalEventItem[] = data.items || [];

    return items.map((item) => {
      const isAllDay = !!item.start?.date && !item.start?.dateTime;
      
      let startDate: Date;
      let endDate: Date;

      if (isAllDay && item.start?.date) {
        // Date strings are YYYY-MM-DD
        const [sYear, sMonth, sDay] = item.start.date.split('-').map(Number);
        startDate = new Date(sYear, sMonth - 1, sDay, 0, 0, 0);

        if (item.end?.date) {
          const [eYear, eMonth, eDay] = item.end.date.split('-').map(Number);
          // End date for all-day events in Google Calendar is exclusive, so subtract 1 minute
          endDate = new Date(eYear, eMonth - 1, eDay, 23, 59, 59);
        } else {
          endDate = new Date(sYear, sMonth - 1, sDay, 23, 59, 59);
        }
      } else {
        startDate = new Date(item.start?.dateTime || new Date());
        endDate = new Date(item.end?.dateTime || startDate);
      }

      // Resolve color: event-level colorId -> calendar backgroundColor
      let resolvedColor = calendar.backgroundColor;
      if (item.colorId && GOOGLE_EVENT_COLORS[item.colorId]) {
        resolvedColor = GOOGLE_EVENT_COLORS[item.colorId];
      }

      // Clean up location field
      let cleanLocation = item.location?.trim();
      if (cleanLocation) {
        // Remove duplicate newlines or extra spaces
        cleanLocation = cleanLocation.replace(/\s+/g, ' ');
      }

      return {
        id: item.id,
        calendarId: calendar.id,
        calendarName: calendar.summary,
        title: item.summary || '(No Title)',
        description: item.description,
        location: cleanLocation,
        start: startDate,
        end: endDate,
        allDay: isAllDay,
        color: resolvedColor,
        attendeesCount: item.attendees?.length,
        htmlLink: item.htmlLink,
      };
    });
  } catch (error) {
    console.error(`Failed to fetch events for calendar ${calendar.id}:`, error);
    return [];
  }
}

export async function fetchAllSelectedCalendarEvents(
  token: string,
  calendars: CalendarInfo[],
  selectedIds: string[]
): Promise<CalendarEvent[]> {
  const activeCalendars = calendars.filter((c) => selectedIds.includes(c.id));
  const eventPromises = activeCalendars.map((cal) => fetchCalendarEvents(token, cal));
  const results = await Promise.all(eventPromises);

  const combined = results.flat();
  // Sort chronologically
  combined.sort((a, b) => a.start.getTime() - b.start.getTime());
  return combined;
}
