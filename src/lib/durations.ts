import { addDays } from "./schedule";
import { Scale, benchmarkFor } from "./benchmarks";

// Typical length of a block, from the published benchmarks in ./benchmarks
export function typicalDays(title: string | null | undefined, tradeType: string | null | undefined, scale: Scale = "remodel"): number {
  return benchmarkFor(title, tradeType, scale).days;
}

export interface SchedulableBlock {
  title: string;
  trade_type: string | null;
  depends_on: number[]; // indexes into the same list
  start: string | null;
  finish: string | null;
}

// Fills in missing target dates: each block starts the day after its latest dependency finishes
// (or on the project start) and runs for its typical duration. Dates already set are kept.
export function suggestSchedule(blocks: SchedulableBlock[], projectStart: string, scale: Scale = "remodel") {
  const result: { start: string; finish: string }[] = [];
  const visiting = new Set<number>();

  const place = (i: number): { start: string; finish: string } => {
    if (result[i]) return result[i];
    const b = blocks[i];
    let earliest = projectStart;
    if (!visiting.has(i)) {
      visiting.add(i); // guards against dependency cycles
      for (const d of b.depends_on) {
        if (d === i || !blocks[d]) continue;
        const next = addDays(place(d).finish, 1);
        if (next > earliest) earliest = next;
      }
      visiting.delete(i);
    }
    const days = typicalDays(b.title, b.trade_type, scale);
    const start = b.start || (b.finish ? addDays(b.finish, -(days - 1)) : earliest);
    const finish = b.finish || addDays(start, days - 1);
    result[i] = { start, finish };
    return result[i];
  };

  blocks.forEach((_, i) => place(i));
  return result;
}

// Keeps each block from starting before its dependencies finish: a block whose start is empty or
// earlier than the day after its latest dependency's finish moves to that day, keeping its length
// (or its typical length when it had none). Later starts are left alone, so owners can add slack.
export function alignToDependencies(blocks: SchedulableBlock[], scale: Scale = "remodel") {
  const result = blocks.map((b) => ({ start: b.start, finish: b.finish }));
  const done = new Set<number>();
  const visiting = new Set<number>();

  const align = (i: number) => {
    if (done.has(i) || visiting.has(i)) return; // visiting guards against dependency cycles
    visiting.add(i);
    const b = blocks[i];
    let required: string | null = null;
    for (const d of b.depends_on) {
      if (d === i || !blocks[d]) continue;
      align(d);
      const depFinish = result[d].finish;
      if (depFinish) {
        const next = addDays(depFinish, 1);
        if (!required || next > required) required = next;
      }
    }
    const current = result[i];
    if (required && (!current.start || current.start < required)) {
      const length =
        current.start && current.finish && current.finish >= current.start
          ? Math.round((Date.parse(current.finish) - Date.parse(current.start)) / 86400000) + 1
          : typicalDays(b.title, b.trade_type, scale);
      result[i] = { start: required, finish: addDays(required, length - 1) };
    }
    visiting.delete(i);
    done.add(i);
  };

  blocks.forEach((_, i) => align(i));
  return result;
}

// The earliest a block can start: the day after its latest dependency finishes
export function earliestStart(dependencyFinishes: (string | null | undefined)[]): string | null {
  const finishes = dependencyFinishes.filter((d): d is string => !!d).map((d) => d.slice(0, 10)).sort();
  return finishes.length ? addDays(finishes[finishes.length - 1], 1) : null;
}
