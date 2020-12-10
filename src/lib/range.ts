import { subDays, subSeconds } from 'date-fns';

export function getRanges({
  from,
  to = new Date(),
  periodDays = 7
}: {
  from: Date;
  to?: Date;
  periodDays?: number; // days
}): { from: Date; to: Date }[] {
  let curTo = to;
  const res: { from: Date; to: Date }[] = [];
  while (subDays(curTo, periodDays) > from) {
    const curFrom = subDays(curTo, periodDays);
    res.push({ from: curFrom, to: curTo });
    curTo = subSeconds(curFrom, 1);
  }

  res.push({ from, to: curTo });

  return res;
}
