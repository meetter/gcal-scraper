import { calendar_v3 } from 'googleapis';
import stripHtml from 'string-strip-html';
import { User, UserFieldsToAnalyze } from './input';
import groupBy from 'lodash/groupBy';
import uniqBy from 'lodash/uniqBy';

type Event = calendar_v3.Schema$Event;
type Attendee = calendar_v3.Schema$EventAttendee;

export interface NormalizedEvent {
  id: string;
  startTime: string;
  endTime: string;
  duration: number; // minutes
  durationHours: number;
  htmlLink?: string;
  created?: string;
  updated?: string;
  summary: string;
  description: string; // removed html from description
  descriptionRaw: string; // original description. could be html
  text: string; // summary + description
  recurringEventId?: string;
  isRecurring: boolean;
  sequence: number;

  creator?: string;

  participants: string[]; // assuming who actually joined and spend time on a meet
  participantsCount: number;
  participantsKnownCount: number;

  accepted: string[];
  acceptedCount: number;

  declined: string[];
  declinedCount: number;

  tentative: string[];
  tentativeCount: number;

  needsAction: string[];
  needsActionsCount: number;

  required: string[];
  requiredCount: number;

  optional: string[];
  optionalCount: number;

  isOneOnOne: boolean;
  isInternal: boolean; // internal company meeting

  user?: string; // who's event is this
}

const UNKNOWN = 'unknown';

export function normalizeEvents(
  events: Event[],
  usersMap: Record<string, User>
): { all: NormalizedEvent[]; byUser: Record<string, NormalizedEvent[]> } {
  events = events.filter(isEventRelevant);

  const mergedEvents = resolveDuplicateEvents(events);
  const all = mergedEvents
    .map((event) => normalizeRelevantEvent(event, usersMap))
    .map((event) => ({
      ...event,
      user: undefined,
    }));

  const byUser: Record<string, NormalizedEvent[]> = {};
  events
    .map((event) => normalizeRelevantEvent(event, usersMap))
    .filter((event) => event.user && event.user !== UNKNOWN)
    .forEach((event) => {
      if (!event.user) return;

      if (!byUser[event.user]) {
        byUser[event.user] = [];
      }
      byUser[event.user].push(event);
    });

  return {
    all,
    byUser,
  };
}

function getUsersField(
  attendees: Attendee[],
  usersMap: Record<string, User>,
  field: UserFieldsToAnalyze
): string[] {
  return attendees.map((a) => getUserField(a.email!, usersMap, field));
}

function getUserField(
  email: string,
  usersMap: Record<string, User>,
  field: UserFieldsToAnalyze
): string {
  const user = usersMap[email] ?? {};
  // const user = usersMap[email] ?? { email }; // uncomment if want users which are no in set!

  return user[field] || UNKNOWN;
}

function resolveDuplicateEvents(events: Event[]): Event[] {
  // merge duplicates
  const eventsById = groupBy(events, 'id');
  const groupedByDuplicates = groupBy(Object.keys(eventsById), (id) => {
    const event = eventsById[id][0];
    return event.start?.date + (event.summary ?? '');
  });
  Object.values(groupedByDuplicates).forEach((duplicates) => {
    if (duplicates.length > 1) {
      const [original, ...other] = duplicates;
      other.forEach((duplicateId) => {
        eventsById[original].push(...eventsById[duplicateId]);
        delete eventsById[duplicateId];
      });
    }
  });
  // sort each by last updated
  Object.values(eventsById).forEach((eventsById) => {
    eventsById.sort(
      (a, b) =>
        new Date(b.updated ?? b.created!).getTime() -
        new Date(a.updated ?? a.created!).getTime()
    );
  });

  let uniqueEvents: Event[] = [];
  Object.values(eventsById).forEach((events) => {
    if (events.length === 1) {
      uniqueEvents.push(events[0]);
    } else {
      const event = events[events.length - 1];
      const attendeesFromAllEvents = uniqBy(
        events
          .map((event) => event.attendees!)
          .filter(Boolean)
          .reduce((res, next) => res.concat(...next!), []) // flatten
          .filter(Boolean) as calendar_v3.Schema$EventAttendee[],
        'email'
      );
      uniqueEvents.push({
        ...event,
        attendees: attendeesFromAllEvents,
      });
    }
  });

  return uniqueEvents;
}

function isEventRelevant(event: Event): boolean {
  if (!event.start?.dateTime) return false;
  if (!event.end?.dateTime) return false;
  if (!event.attendees) return false;
  if (event.attendees.length < 2) return false;

  if (event.summary) {
    const notRelevantKeywords = [
      'family',
      'kid',
      'cake',
      'party',
      'placeholder',
      '[hold]',
      'notice',
    ];
    const includesNotRelevantKeyword = notRelevantKeywords.some((keyword) =>
      event.summary?.toLowerCase().includes(keyword)
    );
    if (includesNotRelevantKeyword) {
      return false;
    }
  }

  const startTime = event.start.dateTime!;
  const endTime = event.end.dateTime!;

  const duration = Math.round(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
  );

  if (duration > 60 * 4) return false; // likely just blocked calendar. no meeting could be be longer the 4 hours ...

  return true;
}

function normalizeRelevantEvent(
  event: Event,
  usersInfo: Record<string, User>
): NormalizedEvent {
  const users = event.attendees!.filter((a) => a.email && !a.resource); // filter only users with email and not resources

  const declined = users.filter((u) => u.responseStatus === 'declined');
  const accepted = users.filter((u) => u.responseStatus === 'accepted');
  const tentative = users.filter((u) => u.responseStatus === 'tentative');
  const needsAction = users.filter((u) => u.responseStatus === 'needsAction');

  let participants = [...accepted];

  if (
    !isSomeCommonEventWhichIsLikelyNotAttendedIfNotExplicitlyAccepted(
      event.attendees!.map((a) => a.email ?? ''),
      event.summary ?? ''
    )
  ) {
    participants.push(...tentative);
    participants.push(...needsAction);
  }

  const self = participants.find((p) => p.self);

  const required = users.filter((u) => !u.optional);
  const optional = users.filter((u) => u.optional);

  const startTime = event.start!.dateTime!;
  const endTime = event.end!.dateTime!;

  const duration = Math.round(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
  );

  // TODO: need config to identify team emails
  // const isInternal = () => {
  //   return required
  //     .map((r) => r.email!)
  //     .filter(Boolean)
  //     .every(isInternalEmail);
  // };

  return {
    id: event.id!,
    startTime,
    endTime,
    htmlLink: event.htmlLink ?? '',
    created: event.created ?? undefined,
    updated: event.updated ?? event.created ?? undefined,
    summary: event.summary ?? '',
    description: stripHtml(event.description ?? ''),
    descriptionRaw: event.description ?? '',
    text: stripHtml((event.summary ?? '') + '\n' + (event.description ?? '')),
    // description: '<censored>',
    // descriptionRaw: '<censored>',
    // text: '<censored>',
    creator: event.creator?.email
      ? getUserField(event.creator.email, usersInfo, 'email')
      : undefined,
    recurringEventId: event.recurringEventId ?? undefined,
    isRecurring: Boolean(event.recurringEventId),
    sequence: event.sequence || 1,
    duration,
    durationHours: duration / 60,
    participants: getUsersField(participants, usersInfo, 'email'),
    participantsCount: participants.length,
    participantsKnownCount: getUsersField(
      participants,
      usersInfo,
      'email'
    ).filter((p) => p !== UNKNOWN).length,
    accepted: getUsersField(accepted, usersInfo, 'email'),
    acceptedCount: accepted.length,
    declined: getUsersField(declined, usersInfo, 'email'),
    declinedCount: declined.length,
    tentative: getUsersField(tentative, usersInfo, 'email'),
    tentativeCount: tentative.length,
    needsAction: getUsersField(needsAction, usersInfo, 'email'),
    needsActionsCount: needsAction.length,
    required: getUsersField(required, usersInfo, 'email'),
    requiredCount: required.length,
    optional: getUsersField(optional, usersInfo, 'email'),
    optionalCount: optional.length,
    isOneOnOne: users.length === 2,
    isInternal: false, // isInternal(),
    user: self?.email
      ? getUserField(self.email!, usersInfo, 'email')
      : undefined,
  };
}
function isSomeCommonEventWhichIsLikelyNotAttendedIfNotExplicitlyAccepted(
  users: string[],
  summary: string
): boolean {
  if (users.length > 12) return true; // to much users, likely some general send out
  const hasGroup = users.some((user) => {
    return (
      user.includes('support') ||
      user.includes('employees') ||
      user.includes('-cal') ||
      user.includes('cal-')
    );
  });

  if (hasGroup) return true;

  const keywords = [
    'social',
    'break',
    'guild',
    'ama',
    'hangout',
    'coffee',
    'watercooler',
  ];
  const hasSocialKeyword = keywords.some((k) =>
    summary.toLowerCase().includes(k)
  );

  if (!summary) return true;

  if (hasSocialKeyword) {
    return true;
  }

  return false;
}
