import { useMemo } from "react";
import type { Stroke } from "@/lib/ink";
import { brushCss } from "./palette";

/** Lightweight SVG preview of a note's strokes. */
export function NoteThumb({ strokes, theme }: { strokes: Stroke[]; theme: string }) {
  const { view, items } = useMemo(() => {
    const sample = strokes.slice(-160);
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
    if (!isFinite(x0)) return { view: "0 0 100 60", items: [] as Stroke[] };
    const pad = 16;
    const w = Math.max(x1 - x0, 20) + pad * 2;
    const h = Math.max(y1 - y0, 12) + pad * 2;
    return { view: `${x0 - pad} ${y0 - pad} ${w} ${h}`, items: sample };
  }, [strokes]);

  return (
    <div
      data-theme={theme}
      className="h-full w-full"
      style={{ background: "var(--canvas-paper)" }}
      aria-hidden
    >
      <svg viewBox={view} className="h-full w-full" preserveAspectRatio="xMidYMid slice">
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
