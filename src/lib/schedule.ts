// Date helpers for "YYYY-MM-DD" strings. Dates are handled in UTC so they never shift by a day.

export function toDay(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}

export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

// Last working day of a bid: a 1-day job finishes on its start date.
export function bidFinish(start: string | null | undefined, durationDays: number | null | undefined): string | null {
  const s = toDay(start);
  if (!s || !durationDays) return null;
  return addDays(s, durationDays - 1);
}

export interface ScheduledBlock {
  id: number;
  title: string;
  status: string;
  desired_start_date?: string | null;
  desired_completion_date?: string | null;
  estimated_completion_date?: string | null;
  actual_completion_date?: string | null;
  scheduled_start?: string | null;
  scheduled_finish?: string | null;
}

// Best known start/finish of a block: actual > trade's estimate > accepted bid > owner's target.
export function expectedStart(b: ScheduledBlock): string | null {
  return toDay(b.scheduled_start) || toDay(b.desired_start_date);
}

export function expectedFinish(b: ScheduledBlock): string | null {
  return (
    toDay(b.actual_completion_date) ||
    toDay(b.estimated_completion_date) ||
    toDay(b.scheduled_finish) ||
    toDay(b.desired_completion_date)
  );
}

// Owner's target window for a block. Without a target start, work can begin the day after upstream finishes.
export function targetWindow(block: ScheduledBlock, upstream: ScheduledBlock[]) {
  const upstreamFinishes = upstream.map(expectedFinish).filter((d): d is string => !!d).sort();
  const latestUpstream = upstreamFinishes[upstreamFinishes.length - 1] || null;
  const start = toDay(block.desired_start_date) || (latestUpstream ? addDays(latestUpstream, 1) : null);
  const finish = toDay(block.desired_completion_date);
  const duration = start && finish && finish >= start ? daysBetween(start, finish) + 1 : null;
  return { start, finish, duration, latestUpstream, startIsDerived: !block.desired_start_date && !!start };
}

export interface ScheduleCheck {
  ok: boolean;
  issues: string[];
}

export function checkBidSchedule(
  block: ScheduledBlock,
  upstream: ScheduledBlock[],
  downstream: ScheduledBlock[],
  start: string | null | undefined,
  durationDays: number | null | undefined
): ScheduleCheck | null {
  const s = toDay(start);
  const finish = bidFinish(s, durationDays);
  if (!s || !finish) return null;

  const issues: string[] = [];
  for (const up of upstream) {
    const upFinish = expectedFinish(up);
    if (upFinish && s <= upFinish) {
      issues.push(`Starts before "${up.title}" is expected to finish (${upFinish})`);
    }
  }
  const target = toDay(block.desired_completion_date);
  if (target && finish > target) {
    const late = daysBetween(target, finish);
    issues.push(`Finishes ${late} day${late !== 1 ? "s" : ""} after the owner's target (${target})`);
  }
  for (const down of downstream) {
    const downStart = expectedStart(down);
    if (downStart && finish >= downStart) {
      issues.push(`Runs into "${down.title}", which is set to start ${downStart}`);
    }
  }
  return { ok: issues.length === 0, issues };
}

// Every block that waits on this one, directly or further down the chain
export function downstreamClosure(blockId: number, blocks: { id: number; dependencies?: number[] }[]): number[] {
  const found = new Set<number>();
  const queue = [blockId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const b of blocks) {
      if (!found.has(b.id) && b.id !== blockId && (b.dependencies || []).includes(current)) {
        found.add(b.id);
        queue.push(b.id);
      }
    }
  }
  return Array.from(found);
}
