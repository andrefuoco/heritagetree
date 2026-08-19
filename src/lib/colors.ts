/**
 * Surname colouring.
 *
 * The hue is derived from the surname itself rather than handed out from a
 * palette, so everybody sharing a surname always matches — siblings, cousins,
 * and people added months apart — with no palette bookkeeping and no drift
 * between sessions or devices.
 *
 * Only hue and saturation are decided here. Lightness is left to CSS so the
 * same family colour can read as pale paper in the light theme and as a deep
 * tint in the dark one.
 */

export function normaliseSurname(surname: string): string {
  return surname.trim().toLocaleLowerCase();
}

/** FNV-1a; small, stable, and well spread for short strings. */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Hues are picked off a 12-stop wheel rather than the full 360°, so two
 * different surnames are either clearly the same colour or clearly different —
 * never a barely-perceptible 8° apart.
 */
const HUE_STOPS = 12;

/** Hue for a surname, or -1 for "no surname yet", which renders neutral grey. */
export function hueForSurname(surname: string, overrides: Record<string, number> = {}): number {
  const key = normaliseSurname(surname);
  if (!key) return -1;
  const override = overrides[key];
  if (override !== undefined) return override;
  return (hash(key) % HUE_STOPS) * (360 / HUE_STOPS);
}

export interface SurnameTone {
  hue: number;
  /** Unitless percentage; CSS multiplies it by 1%. */
  sat: number;
  neutral: boolean;
}

/** Deceased people keep their family hue but are desaturated. */
export function toneForSurname(
  surname: string,
  deceased: boolean,
  overrides: Record<string, number> = {},
): SurnameTone {
  const hue = hueForSurname(surname, overrides);
  return { hue: Math.max(hue, 0), sat: deceased ? 26 : 62, neutral: hue < 0 };
}

/** CSS custom properties consumed by `.card` and `.panel`. */
export function toneVars(tone: SurnameTone): React.CSSProperties {
  return { '--hue': tone.hue, '--sat': tone.sat } as React.CSSProperties;
}

/** A concrete mid-lightness colour, for the swatches in the colour picker. */
export function swatchColor(hue: number): string {
  return `hsl(${hue} 62% 58%)`;
}

/** The 12 hues a user can pick from when overriding a surname's colour. */
export const HUE_CHOICES = Array.from({ length: HUE_STOPS }, (_, i) => i * (360 / HUE_STOPS));
