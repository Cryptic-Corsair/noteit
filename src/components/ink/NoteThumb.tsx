import { useMemo } from "react";
import type { Stroke } from "@/lib/ink";
import { brushCss, type PaperPatternId } from "./palette";

/** Lightweight SVG preview of a note's strokes with optional paper texture. */
export function NoteThumb({
  strokes,
  theme,
  pattern = "dots",
}: {
  strokes: Stroke[];
  theme: string;
  pattern?: PaperPatternId;
}) {
  const { view, items } = useMemo(() => {
    const sample = strokes.slice(-180);
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const s of sample) {
      x0 = Math.min(x0, s.bounds.x0);
      y0 = Math.min(y0, s.bounds.y0);
      x1 = Math.max(x1, s.bounds.x1);
      y1 = Math.max(y1, s.bounds.y1);
    }
    if (!isFinite(x0)) return { view: "0 0 100 70", items: [] as Stroke[] };
    const pad = 16;
    const w = Math.max(x1 - x0, 30) + pad * 2;
    const h = Math.max(y1 - y0, 20) + pad * 2;
    return { view: `${x0 - pad} ${y0 - pad} ${w} ${h}`, items: sample };
  }, [strokes]);

  return (
    <div
      data-theme={theme}
      className="relative h-full w-full overflow-hidden"
      style={{ background: "var(--canvas-paper)" }}
      aria-hidden
    >
      {/* Paper texture overlay */}
      <svg className="absolute inset-0 h-full w-full opacity-35" preserveAspectRatio="none">
        <defs>
          {pattern === "dots" && (
            <pattern id={`dot-pat-${theme}`} width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="7" cy="7" r="0.9" fill="currentColor" className="text-foreground/40" />
            </pattern>
          )}
          {pattern === "graph" && (
            <pattern id={`grid-pat-${theme}`} width="16" height="16" patternUnits="userSpaceOnUse">
              <path
                d="M 16 0 L 0 0 0 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.6"
                className="text-foreground/30"
              />
            </pattern>
          )}
          {pattern === "ruled" && (
            <pattern id={`rule-pat-${theme}`} width="100" height="18" patternUnits="userSpaceOnUse">
              <line
                x1="0"
                y1="18"
                x2="100"
                y2="18"
                stroke="currentColor"
                strokeWidth="0.6"
                className="text-foreground/30"
              />
            </pattern>
          )}
          {pattern === "isometric" && (
            <pattern
              id={`iso-pat-${theme}`}
              width="20"
              height="34.64"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 10 0 L 20 17.32 L 10 34.64 L 0 17.32 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-foreground/25"
              />
            </pattern>
          )}
        </defs>
        {pattern === "dots" && <rect width="100%" height="100%" fill={`url(#dot-pat-${theme})`} />}
        {pattern === "graph" && (
          <rect width="100%" height="100%" fill={`url(#grid-pat-${theme})`} />
        )}
        {pattern === "ruled" && (
          <>
            <rect width="100%" height="100%" fill={`url(#rule-pat-${theme})`} />
            <line
              x1="16"
              y1="0"
              x2="16"
              y2="100%"
              stroke="rgba(239, 68, 68, 0.4)"
              strokeWidth="1"
            />
          </>
        )}
        {pattern === "isometric" && (
          <rect width="100%" height="100%" fill={`url(#iso-pat-${theme})`} />
        )}
      </svg>

      {/* Strokes SVG */}
      <svg viewBox={view} className="relative h-full w-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          {items.map((s, i) =>
            s.brush.kind === "gradient" ? (
              <linearGradient key={s.id + i} id={`g-${s.id}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={s.brush.from} />
                <stop offset="100%" stopColor={s.brush.to} />
              </linearGradient>
            ) : null,
          )}
        </defs>
        {items.map((s) => (
          <polyline
            key={s.id}
            points={s.pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={s.brush.kind === "solid" ? s.brush.color : `url(#g-${s.id})`}
            strokeWidth={s.style === "highlighter" ? s.width * 1.5 : s.width}
            strokeOpacity={s.opacity ?? (s.style === "highlighter" ? 0.45 : 1)}
            strokeLinecap={s.style === "highlighter" ? "butt" : "round"}
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  );
}

export function brushSwatch(from: string, to: string) {
  return brushCss({ kind: "gradient", from, to });
}
