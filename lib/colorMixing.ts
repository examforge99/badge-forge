// Convert a hex string like "#B0654A" into {r, g, b}
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Mix a base color toward a target color by a given percentage (0-100).
// percentage = 0   -> pure base color
// percentage = 100 -> pure target color
// This is the general-purpose function behind both "tint" (target = white)
// and "shade" (target = black).
export function mixColor(baseHex: string, targetHex: string, percentage: number): string {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  const t = Math.max(0, Math.min(100, percentage)) / 100;

  const r = base.r + (target.r - base.r) * t;
  const g = base.g + (target.g - base.g) * t;
  const b = base.b + (target.b - base.b) * t;

  return rgbToHex(r, g, b);
}

// Convenience wrappers matching the color-theory terms directly
export function tint(baseHex: string, percentage: number): string {
  return mixColor(baseHex, "#FFFFFF", percentage);
}

export function shade(baseHex: string, percentage: number): string {
  return mixColor(baseHex, "#000000", percentage);
}

// Tone: mix toward neutral gray (muted, less saturated, similar brightness)
export function tone(baseHex: string, percentage: number): string {
  return mixColor(baseHex, "#808080", percentage);
}
