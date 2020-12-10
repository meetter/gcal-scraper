import { promisify } from 'util';
import { readFile as _readFile } from 'fs';

const readFile = promisify(_readFile);

export interface User {
  email: string;
  aliases?: string[];
  team?: string;
}

export type UserFieldsToAnalyze = keyof Pick<User, 'email' | 'team'>;

export async function getUsers(
  input = './input/users.json'
): Promise<{
  allUsers: User[];
  usersMap: Record<string, User>;
}> {
  const users = JSON.parse(
    await readFile(input, { encoding: 'utf-8' })
  ) as User[];

  const aliasesMap = users.reduce((res, next) => {
    res[next.email] = next;
    next.aliases?.forEach((al) => {
      res[al] = next;
    });
    return res;
  }, {} as Record<string, User>);

  return {
    allUsers: users,
    usersMap: aliasesMap,
  };
}
