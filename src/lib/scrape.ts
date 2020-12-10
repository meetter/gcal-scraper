import { Calendar } from './calendar';
import { calendar_v3 } from 'googleapis';

export type Event = calendar_v3.Schema$Event;

export async function scrape(
  calendar: Calendar,
  userId: string, // userId (email)
  timeRange: { from: Date; to?: Date }
): Promise<Event[]> {
  const events: Event[] = [];

  const load = async (nextPageToken?: string) => {
    const response = await calendar.events.list({
      calendarId: userId,
      timeMin: timeRange.from.toISOString(),
      timeMax: (timeRange?.to ?? new Date()).toISOString(),
      maxResults: 1000,
      singleEvents: true,
      orderBy: 'startTime',
      pageToken: nextPageToken,
      showHiddenInvitations: true,
      maxAttendees: 1000
    });

    if (response.data.items) {
      events.push(...response.data.items);
    }

    if (response.data.nextPageToken) {
      await load(response.data.nextPageToken);
    }
  };

  await load();

  return events;
}
