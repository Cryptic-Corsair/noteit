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

export type EraserPt = { x: number; y: number; p: number; r: number };

/* ---------------- Recreated Eraser Engine (Capsule Intersection & Precision Splitting) ---------------- */

/**
 * Check if a stroke is intersected by an eraser capsule from (x0, y0, r0) to (x1, y1, r1).
 */
export function strokeIntersectsEraserSegment(
  s: Stroke,
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number,
): boolean {
  const maxR = Math.max(r0, r1) + s.width / 2;
  const minX = Math.min(x0, x1) - maxR;
  const maxX = Math.max(x0, x1) + maxR;
  const minY = Math.min(y0, y1) - maxR;
  const maxY = Math.max(y0, y1) + maxR;

  // Bounding box rejection
  if (minX > s.bounds.x1 || maxX < s.bounds.x0 || minY > s.bounds.y1 || maxY < s.bounds.y0) {
    return false;
  }

  const ex = x1 - x0;
  const ey = y1 - y0;
  const eLenSq = ex * ex + ey * ey;
  const pts = s.pts;
  if (pts.length === 0) return false;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    let t = eLenSq === 0 ? 0 : ((p.x - x0) * ex + (p.y - y0) * ey) / eLenSq;
    t = clamp(t, 0, 1);
    const cx = x0 + t * ex;
    const cy = y0 + t * ey;
    const effR = r0 + t * (r1 - r0) + s.width * 0.45;
    const dSq = (p.x - cx) ** 2 + (p.y - cy) ** 2;
    if (dSq <= effR * effR) return true;

    // Check segment to next point if segment is longer than eraser radius
    if (i < pts.length - 1) {
      const pNext = pts[i + 1]!;
      const segLen = Math.hypot(pNext.x - p.x, pNext.y - p.y);
      if (segLen > Math.max(2, effR * 0.6)) {
        const steps = Math.ceil(segLen / Math.max(2, effR * 0.5));
        for (let step = 1; step < steps; step++) {
          const st = step / steps;
          const sx = p.x + st * (pNext.x - p.x);
          const sy = p.y + st * (pNext.y - p.y);
          let et = eLenSq === 0 ? 0 : ((sx - x0) * ex + (sy - y0) * ey) / eLenSq;
          et = clamp(et, 0, 1);
          const ecx = x0 + et * ex;
          const ecy = y0 + et * ey;
          const eR = r0 + et * (r1 - r0) + s.width * 0.45;
          if ((sx - ecx) ** 2 + (sy - ecy) ** 2 <= eR * eR) return true;
        }
      }
    }
  }

  return false;
}

/**
 * Smoothly cut and split a stroke using an eraser capsule from (x0, y0, r0) to (x1, y1, r1).
 * Finds clean boundary entry and exit points so strokes terminate cleanly at the eraser circumference.
 */
export function splitStrokeByEraserSegment(
  s: Stroke,
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number,
): Stroke[] {
  const maxR = Math.max(r0, r1) + s.width / 2;
  const minX = Math.min(x0, x1) - maxR;
  const maxX = Math.max(x0, x1) + maxR;
  const minY = Math.min(y0, y1) - maxR;
  const maxY = Math.max(y0, y1) + maxR;

  // Quick bounding box check
  if (minX > s.bounds.x1 || maxX < s.bounds.x0 || minY > s.bounds.y1 || maxY < s.bounds.y0) {
    return [s];
  }

  const ex = x1 - x0;
  const ey = y1 - y0;
  const eLenSq = ex * ex + ey * ey;

  const isInside = (x: number, y: number): { inside: boolean; effR: number } => {
    let t = eLenSq === 0 ? 0 : ((x - x0) * ex + (y - y0) * ey) / eLenSq;
    t = clamp(t, 0, 1);
    const cx = x0 + t * ex;
    const cy = y0 + t * ey;
    const effR = r0 + t * (r1 - r0) + s.width * 0.35;
    const distSq = (x - cx) ** 2 + (y - cy) ** 2;
    return { inside: distSq <= effR * effR, effR };
  };

  const findBoundary = (pA: Pt, pB: Pt, aInside: boolean): Pt => {
    let low = 0;
    let high = 1;
    for (let iter = 0; iter < 4; iter++) {
      const mid = (low + high) / 2;
      const mx = pA.x + mid * (pB.x - pA.x);
      const my = pA.y + mid * (pB.y - pA.y);
      const { inside } = isInside(mx, my);
      if (inside === aInside) {
        low = mid;
      } else {
        high = mid;
      }
    }
    const t = (low + high) / 2;
    return {
      x: pA.x + t * (pB.x - pA.x),
      y: pA.y + t * (pB.y - pA.y),
      p: pA.p + t * (pB.p - pA.p),
    };
  };

  const pieces: Pt[][] = [];
  let currentPiece: Pt[] = [];
  let anyErased = false;

  const pts = s.pts;
  if (pts.length === 0) return [];

  let prevPt = pts[0]!;
  let prevInside = isInside(prevPt.x, prevPt.y).inside;

  if (!prevInside) {
    currentPiece.push(prevPt);
  } else {
    anyErased = true;
  }

  for (let i = 1; i < pts.length; i++) {
    const curPt = pts[i]!;
    const curInside = isInside(curPt.x, curPt.y).inside;

    if (!prevInside && !curInside) {
      // Check if long segment pierced through eraser
      const segLen = Math.hypot(curPt.x - prevPt.x, curPt.y - prevPt.y);
      if (segLen > 4) {
        const steps = Math.ceil(segLen / 3);
        let pierced = false;
        for (let st = 1; st < steps; st++) {
          const ratio = st / steps;
          const testX = prevPt.x + ratio * (curPt.x - prevPt.x);
          const testY = prevPt.y + ratio * (curPt.y - prevPt.y);
          if (isInside(testX, testY).inside) {
            pierced = true;
            break;
          }
        }
        if (pierced) {
          anyErased = true;
          const entry = findBoundary(prevPt, curPt, false);
          currentPiece.push(entry);
          if (currentPiece.length > 0) pieces.push(currentPiece);
          const exit = findBoundary(curPt, prevPt, false);
          currentPiece = [exit, curPt];
          prevPt = curPt;
          prevInside = curInside;
          continue;
        }
      }
      currentPiece.push(curPt);
    } else if (!prevInside && curInside) {
      // Moving from outside to inside eraser
      anyErased = true;
      const bound = findBoundary(prevPt, curPt, false);
      currentPiece.push(bound);
      if (currentPiece.length > 0) {
        pieces.push(currentPiece);
        currentPiece = [];
      }
    } else if (prevInside && !curInside) {
      // Moving from inside to outside eraser
      anyErased = true;
      const bound = findBoundary(prevPt, curPt, true);
      currentPiece = [bound, curPt];
    } else {
      // Inside eraser
      anyErased = true;
    }

    prevPt = curPt;
    prevInside = curInside;
  }

  if (currentPiece.length > 0) {
    pieces.push(currentPiece);
  }

  if (!anyErased) {
    return [s];
  }

  const validPieces = pieces.filter((pList) => {
    if (pList.length < 2) return false;
    let len = 0;
    for (let j = 0; j < pList.length - 1; j++) {
      len += Math.hypot(pList[j + 1]!.x - pList[j]!.x, pList[j + 1]!.y - pList[j]!.y);
      if (len >= 1.5) return true;
    }
    return len >= 1.5;
  });

  return validPieces.map((pList) => ({
    id: uid(),
    pts: pList,
    width: s.width,
    brush: s.brush,
    style: s.style,
    opacity: s.opacity,
    bounds: computeBounds(pList),
  }));
}

/** Legacy alias for backwards compatibility */
export function splitStrokeByCapsule(
  s: Stroke,
  ex0: number,
  ey0: number,
  ex1: number,
  ey1: number,
  r: number,
): Stroke[] {
  return splitStrokeByEraserSegment(s, ex0, ey0, r, ex1, ey1, r);
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

export function resamplePoints(pts: Pt[], spacing: number = 2): Pt[] {
  if (pts.length < 2) return pts;
  const out: Pt[] = [pts[0]!];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist / spacing);
    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      out.push({
        x: a.x + dx * t,
        y: a.y + dy * t,
        p: a.p + (b.p - a.p) * t,
      });
    }
  }
  return out;
}

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

  pts = resamplePoints(pts, 4); // Resample for smooth eraser cutting

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
