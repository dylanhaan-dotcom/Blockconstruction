// Planning benchmarks for schedules and costs, taken from published industry sources until
// BlockConstruction has enough completed projects to use its own numbers.
// Durations are calendar days. Every figure names its source so it can be checked and replaced.

export interface Source {
  label: string;
  url: string; // empty when only the publisher is known
}

export const SOURCES = {
  censusSoc: {
    label: "U.S. Census Survey of Construction (via NAHB, 2024 homes)",
    url: "https://www.census.gov/construction/soc/index.html",
  },
  builderPhases: {
    label: "Builder phase timelines (Block Renovation, The Plan Collection)",
    url: "https://www.blockrenovation.com/guides/new-home-construction-timelines-important-factors",
  },
  nahbCost: {
    label: "NAHB Cost of Constructing a Home, 2022",
    url: "https://www.nahb.org/blog/2023/03/60-percent-of-home-sales-price-goes-to-construction-costs",
  },
  kitchenPhases: {
    label: "Kitchen remodel phase guides (Projul, Kitchen Cabinet Kings)",
    url: "https://projul.com/blog/construction-kitchen-remodel-guide",
  },
  angiKitchen: {
    label: "Angi kitchen remodel cost guide",
    url: "https://www.angi.com/articles/how-much-should-kitchen-remodel-cost.htm",
  },
  angiBacksplash: {
    label: "Angi backsplash installation costs",
    url: "https://www.angi.com/nearme/backsplash-installation",
  },
  angiTile: {
    label: "Angi tile installation cost guide",
    url: "",
  },
  angiBath: {
    label: "Angi bathroom remodel cost guide",
    url: "https://em.angi.com/bathroom-remodel-cost/",
  },
  angiDeck: {
    label: "Angi / HomeAdvisor deck cost guide",
    url: "https://www.nerdwallet.com/home-ownership/home-improvement/learn/cost-to-build-deck",
  },
  estimate: {
    label: "BlockConstruction estimate (no published source yet)",
    url: "",
  },
} satisfies Record<string, Source>;

export type Scale = "new_home" | "remodel" | "deck";

export function projectScale(projectType: string | null | undefined, title?: string | null): Scale {
  const text = `${projectType || ""} ${title || ""}`;
  if (/house|new home|home build|new construction|custom home|ground[- ]up/i.test(text)) return "new_home";
  if (/deck|porch|pergola/i.test(text)) return "deck";
  return "remodel";
}

// NAHB 2022: share of total construction cost by stage
export const NAHB_STAGES = {
  siteFoundation: { label: "Site work & foundations", share: 0.184 }, // 7.4% site work + 11.0% foundations
  framing: { label: "Framing", share: 0.205 },
  exterior: { label: "Exterior finishes", share: 0.118 },
  systems: { label: "Major system rough-ins (plumbing, electrical, HVAC)", share: 0.179 },
  interior: { label: "Interior finishes", share: 0.24 },
  finalSteps: { label: "Final steps (landscaping, cleanup, inspection)", share: 0.059 },
};
type Stage = keyof typeof NAHB_STAGES;

export interface Benchmark {
  days: number;
  range?: string; // published range the days were taken from
  durationSource: Source;
  cost?: { low: number; high: number; source: Source };
  stage?: Stage; // new homes: NAHB cost stage this block belongs to
}

interface Rule extends Benchmark {
  match: RegExp;
}

// Order matters: the first matching rule wins.
const RULES: Record<Scale, Rule[]> = {
  new_home: [
    { match: /underground|under[- ]?slab/i, days: 5, durationSource: SOURCES.estimate, stage: "systems" },
    { match: /site|foundation|footing|excavat|slab/i, days: 28, range: "1–4 weeks for the foundation", durationSource: SOURCES.builderPhases, stage: "siteFoundation" },
    { match: /fram/i, days: 42, range: "4–8 weeks", durationSource: SOURCES.builderPhases, stage: "framing" },
    { match: /roof/i, days: 14, range: "part of 6–8 weeks for framing & roofing", durationSource: SOURCES.builderPhases, stage: "exterior" },
    { match: /rough/i, days: 35, range: "4–8 weeks for rough-ins & inspections", durationSource: SOURCES.builderPhases, stage: "systems" },
    { match: /insulat/i, days: 7, range: "3–5 weeks for insulation & drywall together", durationSource: SOURCES.builderPhases, stage: "interior" },
    { match: /drywall/i, days: 21, range: "3–5 weeks for insulation & drywall together", durationSource: SOURCES.builderPhases, stage: "interior" },
    { match: /exterior|siding|landscap/i, days: 42, range: "interior & exterior finishes take 3–4 months together", durationSource: SOURCES.builderPhases, stage: "exterior" },
    { match: /trim|door/i, days: 28, range: "6–10 weeks for interior finishes", durationSource: SOURCES.builderPhases, stage: "interior" },
    { match: /paint/i, days: 21, range: "6–10 weeks for interior finishes", durationSource: SOURCES.builderPhases, stage: "interior" },
    { match: /tile|floor/i, days: 21, range: "6–10 weeks for interior finishes", durationSource: SOURCES.builderPhases, stage: "interior" },
    { match: /cabinet|counter/i, days: 21, range: "6–10 weeks for interior finishes", durationSource: SOURCES.builderPhases, stage: "interior" },
    { match: /hvac.*finish|finish.*hvac/i, days: 5, durationSource: SOURCES.estimate, stage: "systems" },
    { match: /finish|trim[- ]?out|fixture/i, days: 7, durationSource: SOURCES.estimate, stage: "systems" },
    { match: /punch|inspection|final/i, days: 14, durationSource: SOURCES.estimate, stage: "finalSteps" },
  ],
  remodel: [
    { match: /bath.*demo|demo.*bath/i, days: 7, range: "1–2 weeks", durationSource: SOURCES.kitchenPhases, cost: { low: 1000, high: 2300, source: SOURCES.angiBath } },
    { match: /demo/i, days: 7, range: "1–2 weeks", durationSource: SOURCES.kitchenPhases },
    { match: /rough|electrical update/i, days: 14, range: "1–4 weeks depending on the guide and on moving walls", durationSource: SOURCES.kitchenPhases },
    { match: /cabinet/i, days: 5, range: "1–3 days to install, plus adjustments", durationSource: SOURCES.kitchenPhases },
    { match: /counter/i, days: 14, range: "about 2 weeks to template, fabricate and install", durationSource: SOURCES.kitchenPhases, cost: { low: 1800, high: 4400, source: SOURCES.angiKitchen } },
    { match: /backsplash/i, days: 4, durationSource: SOURCES.estimate, cost: { low: 500, high: 1500, source: SOURCES.angiBacksplash } },
    { match: /waterproof|shower|tub/i, days: 7, durationSource: SOURCES.estimate, cost: { low: 400, high: 6500, source: SOURCES.angiTile } },
    { match: /tile/i, days: 5, durationSource: SOURCES.estimate, cost: { low: 400, high: 6500, source: SOURCES.angiTile } },
    { match: /floor/i, days: 5, durationSource: SOURCES.estimate },
    { match: /fram/i, days: 5, durationSource: SOURCES.estimate },
    { match: /drywall/i, days: 7, durationSource: SOURCES.estimate },
    { match: /insulat/i, days: 2, durationSource: SOURCES.estimate },
    { match: /paint/i, days: 4, durationSource: SOURCES.estimate },
    { match: /vanity|fixture|finish|trim[- ]?out/i, days: 3, durationSource: SOURCES.estimate },
    { match: /punch|inspection/i, days: 2, durationSource: SOURCES.estimate },
  ],
  deck: [
    // HomeAdvisor: a simple small-to-medium deck takes about two weeks; split across the phases
    { match: /site|footing|prep/i, days: 3, range: "≈2 weeks for the whole deck", durationSource: SOURCES.angiDeck },
    { match: /fram/i, days: 4, range: "≈2 weeks for the whole deck", durationSource: SOURCES.angiDeck },
    { match: /electric|lighting/i, days: 2, range: "≈2 weeks for the whole deck", durationSource: SOURCES.angiDeck },
    { match: /deck|rail/i, days: 5, range: "≈2 weeks for the whole deck", durationSource: SOURCES.angiDeck },
    { match: /stain|seal|finish|paint/i, days: 2, range: "≈2 weeks for the whole deck", durationSource: SOURCES.angiDeck },
  ],
};

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

export function benchmarkFor(title: string | null | undefined, tradeType: string | null | undefined, scale: Scale): Benchmark {
  for (const rule of RULES[scale]) {
    if (title && rule.match.test(title)) {
      const { match: _match, ...benchmark } = rule; // eslint-disable-line @typescript-eslint/no-unused-vars
      return benchmark;
    }
  }
  return { days: (tradeType && TRADE_DAYS[tradeType]) || 5, durationSource: SOURCES.estimate };
}

export interface ProjectBenchmark {
  summary: string;
  source: Source;
  cost?: { low: number; high: number; source: Source };
}

export function projectBenchmark(scale: Scale, projectType?: string | null): ProjectBenchmark {
  if (scale === "new_home") {
    return {
      summary: "An average single-family house takes about 7.6 months to build, after about 1.4 months of permits and preparation.",
      source: SOURCES.censusSoc,
    };
  }
  if (scale === "deck") {
    return {
      summary: "A simple small-to-medium deck takes about two weeks once work starts.",
      source: SOURCES.angiDeck,
      cost: { low: 4300, high: 12700, source: SOURCES.angiDeck },
    };
  }
  if (/bath/i.test(projectType || "")) {
    return {
      summary: "Most bathroom remodels cost $6,000–$15,000; layout changes and upscale finishes can reach $20,000–$60,000.",
      source: SOURCES.angiBath,
      cost: { low: 6000, high: 15000, source: SOURCES.angiBath },
    };
  }
  return {
    summary: "A midrange kitchen remodel takes about 8–12 weeks; structural changes can push it to 12–20+ weeks.",
    source: SOURCES.kitchenPhases,
    cost: /kitchen/i.test(projectType || "") ? { low: 13000, high: 38000, source: SOURCES.angiKitchen } : undefined,
  };
}

export function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}
