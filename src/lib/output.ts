import { writeFile as _writeFile } from 'fs';
import { promisify } from 'util';
import { NormalizedEvent } from './normalize_events';
import mkdirp from 'mkdirp';

const writeFile = promisify(_writeFile);

export async function toJsonFile(
  all: NormalizedEvent[],
  byUser: Record<string, NormalizedEvent[]>,
  output: string = './output'
) {
  mkdirp.sync(output);
  mkdirp.sync(`${output}/users`);
  await writeFile(`${output}/all.json`, JSON.stringify(all, null, 4), 'utf-8');
  for (const user of Object.keys(byUser)) {
    await writeFile(
      `${output}/users/${user}.json`,
      JSON.stringify(byUser[user], null, 4),
      'utf-8'
    );
  }
}
