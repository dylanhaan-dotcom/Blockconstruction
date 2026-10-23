export const TRADE_TYPES = [
  "Electrician",
  "Plumber",
  "Carpenter",
  "Tile Installer",
  "Painter",
  "HVAC",
  "Roofer",
  "Mason",
  "Concrete",
  "Landscaper",
  "General Contractor",
];

// Trade list columns (secondary_trades, capabilities) are stored as JSON arrays of strings.
export function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
