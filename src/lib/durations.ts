import { addDays } from "./schedule";

// Rough job lengths in calendar days to give owners a starting point; real jobs vary.
const KEYWORD_DAYS: [RegExp, number][] = [
  [/inspection|punch/i, 2],
  [/fixture|trim[- ]?out|finish work|electrical finish|plumbing finish/i, 2],
  [/rough[- ]?in/i, 4],
  [/demo/i, 3],
  [/framing|frame/i, 5],
  [/insulat/i, 2],
  [/drywall/i, 5],
  [/cabinet/i, 5],
  [/counter/i, 7],
  [/backsplash/i, 3],
  [/shower|tub/i, 5],
  [/tile/i, 4],
  [/floor/i, 4],
  [/paint/i, 4],
  [/roof/i, 4],
  [/window|door/i, 3],
  [/foundation|concrete|slab/i, 5],
  [/landscap|grading/i, 5],
  [/hvac|duct/i, 4],
];

const TRADE_DAYS: Record<string, number> = {
  Electrician: 3,
  Plumber: 3,
  Carpenter: 5,
  "Tile Installer": 4,
  Painter: 4,
  HVAC: 4,
  Roofer: 4,
  Mason: 5,
  Concrete: 5,
  Landscaper: 5,
  "General Contractor": 5,
};

export function typicalDays(title: string | null | undefined, tradeType: string | null | undefined): number {
  for (const [pattern, days] of KEYWORD_DAYS) {
    if (title && pattern.test(title)) return days;
  }
  return (tradeType && TRADE_DAYS[tradeType]) || 5;
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
export function suggestSchedule(blocks: SchedulableBlock[], projectStart: string) {
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
    const days = typicalDays(b.title, b.trade_type);
    const start = b.start || (b.finish ? addDays(b.finish, -(days - 1)) : earliest);
    const finish = b.finish || addDays(start, days - 1);
    result[i] = { start, finish };
    return result[i];
  };

  blocks.forEach((_, i) => place(i));
  return result;
}
