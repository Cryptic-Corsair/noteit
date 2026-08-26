import type { Brush } from "@/lib/ink";

export const SOLID_COLORS = [
  "#111318",
  "#3b4252",
  "#4c566a",
  "#5b6472",
  "#e7422f",
  "#f08a24",
  "#f2c744",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#92400e",
  "#f3f4f6",
  "#ffffff",
];

export const HIGHLIGHTER_COLORS = [
  "#fef08a", // soft yellow
  "#bbf7d0", // mint green
  "#bae6fd", // soft sky blue
  "#fed7aa", // peach orange
  "#fbcfe8", // pink blush
  "#ddd6fe", // lavender purple
];

export const GRADIENTS: { from: string; to: string; name: string }[] = [
  { name: "Sunset Glow", from: "#ff7e5f", to: "#feb47b" },
  { name: "Neon Cyber", from: "#ec4899", to: "#3b82f6" },
  { name: "Lagoon Teal", from: "#06b6d4", to: "#3b82f6" },
  { name: "Cosmic Violet", from: "#8b5cf6", to: "#ec4899" },
  { name: "Emerald Mint", from: "#10b981", to: "#06b6d4" },
  { name: "Citrus Punch", from: "#f59e0b", to: "#ef4444" },
  { name: "Northern Lights", from: "#34d399", to: "#6366f1" },
  { name: "Obsidian Silver", from: "#475569", to: "#94a3b8" },
];

export function brushCss(b: Brush) {
  return b.kind === "solid" ? b.color : `linear-gradient(135deg, ${b.from}, ${b.to})`;
}

export const THEMES = [
  { id: "graphite", name: "Graphite", desc: "Minimalist dark slate" },
  { id: "paper", name: "Paper", desc: "Warm archival parchment" },
  { id: "midnight", name: "Midnight", desc: "Deep sapphire dark" },
  { id: "sage", name: "Sage", desc: "Botanical calming green" },
  { id: "rose", name: "Rose Quartz", desc: "Warm blush tone" },
  { id: "blueprint", name: "Blueprint", desc: "Architectural grid" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const PAPER_PATTERNS = [
  { id: "dots", name: "Dot Grid", icon: "GridDots" },
  { id: "graph", name: "Square Graph", icon: "Grid3X3" },
  { id: "ruled", name: "Ruled Lines", icon: "AlignJustify" },
  { id: "isometric", name: "Isometric", icon: "Boxes" },
  { id: "blank", name: "Plain Paper", icon: "Square" },
] as const;

export type PaperPatternId = (typeof PAPER_PATTERNS)[number]["id"];
