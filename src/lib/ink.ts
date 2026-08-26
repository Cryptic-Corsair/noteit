export type Brush =
  { kind: "solid"; color: string } | { kind: "gradient"; from: string; to: string };

export type Pt = { x: number; y: number; p: number };

export type StrokeStyle =
  "pen" | "calligraphy" | "highlighter" | "brush" | "line" | "arrow" | "rectangle" | "ellipse";

export type Stroke = {
  id: string;
  pts: Pt[];
  width: number;
  brush: Brush;
  style?: StrokeStyle;
  opacity?: number;
  /** cached bounds in world space */
  bounds: { x0: number; y0: number; x1: number; y1: number };
};

export type Camera = { x: number; y: number; k: number };

export const uid = () => Math.random().toString(36).slice(2, 10);

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function toWorld(cam: Camera, sx: number, sy: number) {
  return { x: (sx - cam.x) / cam.k, y: (sy - cam.y) / cam.k };
}

export function toScreen(cam: Camera, wx: number, wy: number) {
  return { x: wx * cam.k + cam.x, y: wy * cam.k + cam.y };
}

export function computeBounds(pts: Pt[]) {
  if (pts.length === 0) {
    return { x0: 0, y0: 0, x1: 0, y1: 0 };
  }
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

export function computeGroupBounds(strokes: Stroke[]) {
  if (strokes.length === 0) {
    return { x0: 0, y0: 0, x1: 0, y1: 0, cx: 0, cy: 0, w: 0, h: 0 };
  }
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const s of strokes) {
    const pad = s.width / 2;
    if (s.bounds.x0 - pad < x0) x0 = s.bounds.x0 - pad;
    if (s.bounds.y0 - pad < y0) y0 = s.bounds.y0 - pad;
    if (s.bounds.x1 + pad > x1) x1 = s.bounds.x1 + pad;
    if (s.bounds.y1 + pad > y1) y1 = s.bounds.y1 + pad;
  }
  return {
    x0,
    y0,
    x1,
    y1,
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    w: Math.max(1, x1 - x0),
    h: Math.max(1, y1 - y0),
  };
}

/** Simplify while drawing: skip points closer than `min` world units. */
export function shouldAddPoint(last: Pt | undefined, p: Pt, min: number) {
  if (!last) return true;
  return Math.hypot(p.x - last.x, p.y - last.y) >= min;
}

export function strokePath(pts: Pt[]) {
  const path = new Path2D();
  if (pts.length === 0) return path;
  const first = pts[0]!;
  if (pts.length < 3) {
    const l = pts[pts.length - 1]!;
    path.moveTo(first.x, first.y);
    path.lineTo(l.x + 0.01, l.y + 0.01);
    return path;
  }
  path.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    path.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  const last = pts[pts.length - 1]!;
  path.lineTo(last.x, last.y);
  return path;
}

export function brushStyle(ctx: CanvasRenderingContext2D, s: Stroke): string | CanvasGradient {
  if (s.brush.kind === "solid") return s.brush.color;
  const { x0, y0, x1, y1 } = s.bounds;
  const g = ctx.createLinearGradient(x0, y0, x1 === x0 && y1 === y0 ? x0 + 1 : x1, y1);
  g.addColorStop(0, s.brush.from);
  g.addColorStop(1, s.brush.to);
  return g;
}

export function pointNearStroke(s: Stroke, x: number, y: number, r: number) {
  const b = s.bounds;
  const pad = r + s.width;
  if (x < b.x0 - pad || x > b.x1 + pad || y < b.y0 - pad || y > b.y1 + pad) return false;
  const rr = (r + s.width / 2) ** 2;
  for (let i = 0; i < s.pts.length - 1; i++) {
    if (distSqToSeg(x, y, s.pts[i]!, s.pts[i + 1]!) <= rr) return true;
  }
  if (s.pts.length === 1) {
    const p = s.pts[0]!;
    return (p.x - x) ** 2 + (p.y - y) ** 2 <= rr;
  }
  return false;
}

function distSqToSeg(x: number, y: number, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  let t = len === 0 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / len;
  t = clamp(t, 0, 1);
  const px = a.x + t * dx - x;
  const py = a.y + t * dy - y;
  return px * px + py * py;
}

export function pointInPolygon(poly: Pt[], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x,
      yi = poly[i]!.y,
      xj = poly[j]!.x,
      yj = poly[j]!.y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function strokeInLasso(s: Stroke, poly: Pt[]) {
  if (poly.length < 3) return false;
  const pb = computeBounds(poly);
  // Bounding box rejection test
  if (s.bounds.x1 < pb.x0 || s.bounds.x0 > pb.x1 || s.bounds.y1 < pb.y0 || s.bounds.y0 > pb.y1)
    return false;

  const total = s.pts.length;
  if (total === 0) return false;

  // For very short strokes / dots, check all points
  if (total <= 3) {
    return s.pts.some((p) => pointInPolygon(poly, p.x, p.y));
  }

  // Check center point first
  const cx = (s.bounds.x0 + s.bounds.x1) / 2;
  const cy = (s.bounds.y0 + s.bounds.y1) / 2;
  if (pointInPolygon(poly, cx, cy)) return true;

  let hits = 0;
  const step = Math.max(1, Math.floor(total / 30));
  let checked = 0;
  for (let i = 0; i < total; i += step) {
    const p = s.pts[i]!;
    if (pointInPolygon(poly, p.x, p.y)) hits++;
    checked++;
  }
  return hits > 0 && (hits / checked >= 0.2 || hits >= 2);
}

export function strokeInRect(s: Stroke, r: { x0: number; y0: number; x1: number; y1: number }) {
  const minX = Math.min(r.x0, r.x1);
  const maxX = Math.max(r.x0, r.x1);
  const minY = Math.min(r.y0, r.y1);
  const maxY = Math.max(r.y0, r.y1);

  if (s.bounds.x1 < minX || s.bounds.x0 > maxX || s.bounds.y1 < minY || s.bounds.y0 > maxY) {
    return false;
  }

  // Check center point
  const cx = (s.bounds.x0 + s.bounds.x1) / 2;
  const cy = (s.bounds.y0 + s.bounds.y1) / 2;
  if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) return true;

  return s.pts.some((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
}

/* ---------------- Precision Eraser (Path Trimming / Splitting) ---------------- */

export function splitStrokeByCircle(s: Stroke, cx: number, cy: number, r: number): Stroke[] {
  const pad = r + s.width / 2;
  if (
    cx + pad < s.bounds.x0 ||
    cx - pad > s.bounds.x1 ||
    cy + pad < s.bounds.y0 ||
    cy - pad > s.bounds.y1
  ) {
    return [s]; // no intersection
  }

  const rSq = (r + s.width / 4) ** 2;
  const pieces: Pt[][] = [];
  let currentPiece: Pt[] = [];

  for (let i = 0; i < s.pts.length; i++) {
    const p = s.pts[i]!;
    const dSq = (p.x - cx) ** 2 + (p.y - cy) ** 2;
    if (dSq > rSq) {
      currentPiece.push(p);
    } else {
      if (currentPiece.length > 0) {
        pieces.push(currentPiece);
        currentPiece = [];
      }
    }
  }
  if (currentPiece.length > 0) {
    pieces.push(currentPiece);
  }

  // Filter out tiny disconnected residue dots (< 2 pts and span < 2px)
  const validPieces = pieces.filter((pts) => {
    if (pts.length >= 2) return true;
    return false;
  });

  return validPieces.map((pts) => ({
    id: uid(),
    pts,
    width: s.width,
    brush: s.brush,
    style: s.style,
    opacity: s.opacity,
    bounds: computeBounds(pts),
  }));
}

/* ---------------- Transforms (Move, Scale, Rotate, Flip, Recolor) ---------------- */

export function translateStroke(s: Stroke, dx: number, dy: number): Stroke {
  const pts = s.pts.map((p) => ({ x: p.x + dx, y: p.y + dy, p: p.p }));
  return {
    ...s,
    pts,
    bounds: {
      x0: s.bounds.x0 + dx,
      y0: s.bounds.y0 + dy,
      x1: s.bounds.x1 + dx,
      y1: s.bounds.y1 + dy,
    },
  };
}

export function scaleStroke(
  s: Stroke,
  origin: { x: number; y: number },
  sx: number,
  sy: number,
): Stroke {
  const pts = s.pts.map((p) => ({
    x: origin.x + (p.x - origin.x) * sx,
    y: origin.y + (p.y - origin.y) * sy,
    p: p.p,
  }));
  const avgScale = (Math.abs(sx) + Math.abs(sy)) / 2;
  return {
    ...s,
    pts,
    width: Math.max(0.5, s.width * avgScale),
    bounds: computeBounds(pts),
  };
}

export function rotateStroke(s: Stroke, origin: { x: number; y: number }, rad: number): Stroke {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pts = s.pts.map((p) => {
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    return {
      x: origin.x + dx * cos - dy * sin,
      y: origin.y + dx * sin + dy * cos,
      p: p.p,
    };
  });
  return {
    ...s,
    pts,
    bounds: computeBounds(pts),
  };
}

export function flipStroke(s: Stroke, cx: number, cy: number, axis: "h" | "v"): Stroke {
  const pts = s.pts.map((p) => ({
    x: axis === "h" ? cx - (p.x - cx) : p.x,
    y: axis === "v" ? cy - (p.y - cy) : p.y,
    p: p.p,
  }));
  return {
    ...s,
    pts,
    bounds: computeBounds(pts),
  };
}

/* ---------------- Shape Generators ---------------- */

export function generateShape(
  type: "line" | "arrow" | "rectangle" | "ellipse",
  start: Pt,
  end: Pt,
  brush: Brush,
  width: number,
): Stroke {
  let pts: Pt[] = [];
  const minPoints = 30;

  if (type === "line") {
    pts = [
      { x: start.x, y: start.y, p: 0.8 },
      { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, p: 0.8 },
      { x: end.x, y: end.y, p: 0.8 },
    ];
  } else if (type === "arrow") {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const headLen = Math.max(16, width * 3.5);

    const leftX = end.x - headLen * Math.cos(angle - Math.PI / 6);
    const leftY = end.y - headLen * Math.sin(angle - Math.PI / 6);
    const rightX = end.x - headLen * Math.cos(angle + Math.PI / 6);
    const rightY = end.y - headLen * Math.sin(angle + Math.PI / 6);

    pts = [
      { x: start.x, y: start.y, p: 0.8 },
      { x: end.x, y: end.y, p: 0.8 },
      { x: leftX, y: leftY, p: 0.8 },
      { x: end.x, y: end.y, p: 0.8 },
      { x: rightX, y: rightY, p: 0.8 },
    ];
  } else if (type === "rectangle") {
    pts = [
      { x: start.x, y: start.y, p: 0.8 },
      { x: end.x, y: start.y, p: 0.8 },
      { x: end.x, y: end.y, p: 0.8 },
      { x: start.x, y: end.y, p: 0.8 },
      { x: start.x, y: start.y, p: 0.8 },
    ];
  } else if (type === "ellipse") {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;

    for (let i = 0; i <= minPoints; i++) {
      const theta = (i / minPoints) * Math.PI * 2;
      pts.push({
        x: cx + rx * Math.cos(theta),
        y: cy + ry * Math.sin(theta),
        p: 0.8,
      });
    }
  }

  return {
    id: uid(),
    pts,
    width,
    brush,
    style: type,
    bounds: computeBounds(pts),
  };
}

/* ---------------- Shape Auto-Snapping Helper ---------------- */

export function detectAndSnapShape(
  pts: Pt[],
): { type: "line" | "ellipse" | "rectangle"; pts: Pt[] } | null {
  if (pts.length < 10) return null;
  const start = pts[0]!;
  const end = pts[pts.length - 1]!;
  const dist = Math.hypot(end.x - start.x, end.y - start.y);

  // Total path length
  let pathLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    pathLen += Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.y - pts[i]!.y);
  }

  // Straight line test: path length very close to Euclidean distance
  if (pathLen > 25 && dist / pathLen > 0.94) {
    return {
      type: "line",
      pts: [
        { x: start.x, y: start.y, p: 0.8 },
        { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, p: 0.8 },
        { x: end.x, y: end.y, p: 0.8 },
      ],
    };
  }

  // Closed loop test
  if (dist < 40 && pathLen > 80) {
    const bounds = computeBounds(pts);
    const w = bounds.x1 - bounds.x0;
    const h = bounds.y1 - bounds.y0;
    const cx = (bounds.x0 + bounds.x1) / 2;
    const cy = (bounds.y0 + bounds.y1) / 2;
    const rx = w / 2;
    const ry = h / 2;

    // Check if points roughly conform to ellipse
    let ellipseDiffSum = 0;
    for (const p of pts) {
      const norm = ((p.x - cx) / (rx || 1)) ** 2 + ((p.y - cy) / (ry || 1)) ** 2;
      ellipseDiffSum += Math.abs(norm - 1);
    }
    const avgDiff = ellipseDiffSum / pts.length;
    if (avgDiff < 0.35) {
      const circlePts: Pt[] = [];
      for (let i = 0; i <= 36; i++) {
        const theta = (i / 36) * Math.PI * 2;
        circlePts.push({
          x: cx + rx * Math.cos(theta),
          y: cy + ry * Math.sin(theta),
          p: 0.8,
        });
      }
      return { type: "ellipse", pts: circlePts };
    }
  }

  return null;
}
