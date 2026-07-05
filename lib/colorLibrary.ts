export interface ColorSwatch {
  name: string;
  hex: string;
  tier: "ordinary" | "premium";
}

export const COLOR_LIBRARY: ColorSwatch[] = [
  // Ordinary — clean, everyday, flat-friendly colors
  { name: "Slate", hex: "#64748B", tier: "ordinary" },
  { name: "Forest", hex: "#2F6B3A", tier: "ordinary" },
  { name: "Denim", hex: "#3B5B92", tier: "ordinary" },
  { name: "Clay", hex: "#B0654A", tier: "ordinary" },
  { name: "Sand", hex: "#D9B589", tier: "ordinary" },
  { name: "Charcoal", hex: "#2B2B2E", tier: "ordinary" },
  { name: "Bone", hex: "#E8E4D9", tier: "ordinary" },
  { name: "Moss", hex: "#7A8B5C", tier: "ordinary" },

  // Premium — richer, more saturated, named variants
  { name: "Crimson", hex: "#DC143C", tier: "premium" },
  { name: "Vermilion", hex: "#E34234", tier: "premium" },
  { name: "Royal Violet", hex: "#7851A9", tier: "premium" },
  { name: "Emerald", hex: "#0F9960", tier: "premium" },
  { name: "Sapphire", hex: "#0F52BA", tier: "premium" },
  { name: "Amber Gold", hex: "#FFBF00", tier: "premium" },
  { name: "Obsidian", hex: "#0B0B0F", tier: "premium" },
  { name: "Platinum", hex: "#D7D7D9", tier: "premium" },
  { name: "Magenta Bloom", hex: "#C2185B", tier: "premium" },
  { name: "Electric Cyan", hex: "#00BCD4", tier: "premium" },
];

export function getSwatchesByTier(tier: "ordinary" | "premium"): ColorSwatch[] {
  return COLOR_LIBRARY.filter((c) => c.tier === tier);
}
