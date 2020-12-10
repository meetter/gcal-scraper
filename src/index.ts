import yargs from 'yargs';
import { getCalendar } from './lib/calendar';
import { getRanges } from './lib/range';
import { Event, scrape } from './lib/scrape';
import { normalizeEvents } from './lib/normalize_events';
import { getUsers } from './lib/input';
import { toJsonFile } from './lib/output';

console.log(process.argv.slice(2));
const argv = yargs(process.argv.slice(2)).options({
  input: { type: 'string', default: './input/users.json' },
  output: { type: 'string', default: './output' },
  timeRangeFrom: { type: 'string', default: '2020-12-01T00:00:00.000Z' },
  timeRangeTo: { type: 'string' },
}).argv;

(async () => {
  try {
    const calendar = await getCalendar();
    const { allUsers, usersMap } = await getUsers(argv.input);

    const ranges = getRanges({
      from: new Date(argv.timeRangeFrom),
      to: argv.timeRangeTo ? new Date(argv.timeRangeTo) : undefined,
      periodDays: 20,
    });

    for (let range of ranges) {
      const eventsInRangeFromAllUsers: Event[] = [];
      for (let user of allUsers) {
        const events = await scrape(calendar, user.email, range);
        eventsInRangeFromAllUsers.push(...events);
        console.log(
          `Got ${events.length} from ${user.email} from range ${JSON.stringify(
            range
          )}`
        );
      }
      const { all, byUser } = await normalizeEvents(
        eventsInRangeFromAllUsers,
        usersMap
      );

      await toJsonFile(all, byUser, argv.output);
    }
  } catch (e) {
    console.error(e);
  }
})();
