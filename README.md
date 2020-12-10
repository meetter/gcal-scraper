# GCAL Scraper

This tool extracts your Google calendar meetings into convenient for analyzing format.

### Input

Input is list of users to analyze. You can clarify aliases to increase precision.
Example:

```json
[
  {
    "email": "anton@meetter.io",
    "aliases": ["anton@meetter.app"]
  },
  {
    "email": "gene@meetter.io",
    "aliases": ["gene@meetter.app"]
  },
  {
    "email": "foga@meetter.io",
    "aliases": ["foga@meetter.app"]
  },
  {
    "email": "mila@meetter.io",
    "aliases": ["mila@meetter.app"]
  }
]
```

### Output

List of all the meetings and list of meetings per user.
Each meeting is in the following format:

```ts
export interface Meeting {
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
```

## Before starting

1. Put `credentials.json` into project root. Get it here: `https://developers.google.com/calendar/quickstart/nodejs`. Pick `Desktop app` as OAuth client.
1. List users for analyzing. See example format: `/input/users.example.json`.
1. install deps `yarn`

## Running

```
yarn start --input=./input/users.json --output=./output --timeRangeFrom=2020-12-01T00:00:00.000Z --timeRangeTo=2020-12-12T00:00:00.000Z
```

All params are optional.

## Developing

2. `yarn build:watch` - to compile ts and watch for changes
3. `node ./build/main/index.js` - to run
