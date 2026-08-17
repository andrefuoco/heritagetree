/**
 * Genealogical dates are routinely partial ("1890", "about 1912", "before
 * 1920"), so dates are stored as free text and only loosely parsed — enough to
 * show a lifespan when both ends contain a plausible year.
 */

export function extractYear(value: string): number | null {
  const match = value.match(/\b(1\d{3}|20\d{2})\b/);
  if (!match?.[1]) return null;
  const year = Number(match[1]);
  return year >= 1000 && year <= 2200 ? year : null;
}

export function lifespanYears(birth: string, death: string): number | null {
  const from = extractYear(birth);
  const to = extractYear(death);
  if (from === null || to === null) return null;
  const years = to - from;
  return years >= 0 && years < 130 ? years : null;
}
