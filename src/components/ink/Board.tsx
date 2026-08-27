import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  brushStyle,
  clamp,
  computeBounds,
  computeGroupBounds,
  detectAndSnapShape,
  flipStroke,
  generateShape,
  MAX_ZOOM,
  MIN_ZOOM,
  pointNearStroke,
  rotateStroke,
  scaleStroke,
  shouldAddPoint,
  splitStrokeByCapsule,
  splitStrokeByEraserSegment,
  strokeIntersectsEraserSegment,
  strokeInLasso,
  strokeInRect,
  strokePath,
  toScreen,
  toWorld,
  translateStroke,
  uid,
  type Brush,
  type Camera,
  type EraserPt,
  type Pt,
  type Stroke,
  type StrokeStyle,
} from "@/lib/ink";
import {
  Toolbar,
  type Tool,
  type EraserMode,
  type EraserFilter,
  type LassoMode,
  type ShapeType,
} from "./Toolbar";
import { THEMES, type ThemeId, type PaperPatternId } from "./palette";
import { getNote, updateNote } from "@/lib/notes";

const pathCache = new WeakMap<Stroke, Path2D>();
const getCachedPath = (s: Stroke, isLive: boolean) => {
  if (isLive) return strokePath(s.pts);
  let p = pathCache.get(s);
  if (!p) {
    p = strokePath(s.pts);
    pathCache.set(s, p);
  }
  return p;
};

export function Board({ noteId }: { noteId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const strokesRef = useRef<Stroke[]>([]);
  const camRef = useRef<Camera>({ x: 0, y: 0, k: 1 });
  const liveRef = useRef<Stroke | null>(null);
  const eraserLastPtRef = useRef<EraserPt | null>(null);
  const shapeStartRef = useRef<Pt | null>(null);
  const lassoRef = useRef<Pt[] | null>(null);
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const selectionRef = useRef<Set<string>>(new Set());
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Gesture state machine
  const gestureRef = useRef<
    | { mode: "none" }
    | { mode: "draw"; id: number }
    | { mode: "shape"; id: number; start: Pt }
    | { mode: "erase"; id: number }
    | { mode: "lasso"; id: number }
    | { mode: "marquee"; id: number; start: Pt }
    | { mode: "pan"; id: number; lastX: number; lastY: number }
    | { mode: "move"; id: number; lastX: number; lastY: number }
    | {
        mode: "scale";
        id: number;
        handle: string;
        initialBounds: { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number };
        initialStrokes: Stroke[];
        startPt: Pt;
      }
    | {
        mode: "rotate";
        id: number;
        center: { x: number; y: number };
        initialStrokes: Stroke[];
        startAngle: number;
      }
    | { mode: "pinch"; startDist: number; startK: number; lastCx: number; lastCy: number }
  >({ mode: "none" });

  const historyRef = useRef<Stroke[][]>([[]]);
  const histIndexRef = useRef(0);
  const dirtyRef = useRef(false);
  const rafRef = useRef(0);

  // Tool states
  const [tool, setTool] = useState<Tool>("pen");
  const [penStyle, setPenStyle] = useState<StrokeStyle>("pen");
  const [eraserMode, setEraserMode] = useState<EraserMode>("stroke");
  const [eraserFilter, setEraserFilter] = useState<EraserFilter>("all");
  const [eraserSize, setEraserSize] = useState(20);
  const [lassoMode, setLassoMode] = useState<LassoMode>("freehand");
  const [shapeType, setShapeType] = useState<ShapeType>("line");
  const [autoSnapShape, setAutoSnapShape] = useState(false);

  // Style states
  const [brush, setBrush] = useState<Brush>({ kind: "solid", color: "#111318" });
  const [size, setSize] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [theme, setTheme] = useState<ThemeId>("graphite");
  const [pattern, setPattern] = useState<PaperPatternId>("dots");
  const [title, setTitle] = useState("Untitled note");
  const [zoom, setZoom] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);

  // Selection & History states
  const [hasSelection, setHasSelection] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Sync refs for live event callbacks
  const toolRef = useRef(tool);
  const penStyleRef = useRef(penStyle);
  const eraserModeRef = useRef(eraserMode);
  const eraserFilterRef = useRef(eraserFilter);
  const eraserSizeRef = useRef(eraserSize);
  const lassoModeRef = useRef(lassoMode);
  const shapeTypeRef = useRef(shapeType);
  const autoSnapShapeRef = useRef(autoSnapShape);
  const brushRef = useRef(brush);
  const sizeRef = useRef(size);
  const opacityRef = useRef(opacity);

  toolRef.current = tool;
  penStyleRef.current = penStyle;
  eraserModeRef.current = eraserMode;
  eraserFilterRef.current = eraserFilter;
  eraserSizeRef.current = eraserSize;
  lassoModeRef.current = lassoMode;
  shapeTypeRef.current = shapeType;
  autoSnapShapeRef.current = autoSnapShape;
  brushRef.current = brush;
  sizeRef.current = size;
  opacityRef.current = opacity;

  /* ---------------- Rendering ---------------- */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const cam = camRef.current;
    const css = getComputedStyle(document.documentElement);
    const paper = css.getPropertyValue("--canvas-paper").trim() || "#ffffff";
    const dot = css.getPropertyValue("--canvas-dot").trim() || "#00000022";
    const accent = css.getPropertyValue("--canvas-accent").trim() || "#6366f1";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.k, cam.k);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const viewX0 = -cam.x / cam.k;
    const viewY0 = -cam.y / cam.k;
    const viewX1 = viewX0 + w / cam.k;
    const viewY1 = viewY0 + h / cam.k;

    // --- Paper Grid Patterns (High-Precision World Coordinates) ---
    if (pattern === "dots") {
      let step = 32;
      while (step * cam.k < 18) step *= 2;
      while (step * cam.k > 80) step /= 2;

      const startX = Math.floor(viewX0 / step) * step;
      const endX = Math.ceil(viewX1 / step) * step;
      const startY = Math.floor(viewY0 / step) * step;
      const endY = Math.ceil(viewY1 / step) * step;
      const dotRadius = Math.max(0.75, 1.25 / cam.k);

      ctx.save();
      ctx.fillStyle = dot;
      ctx.beginPath();
      for (let gx = startX; gx <= endX; gx += step) {
        for (let gy = startY; gy <= endY; gy += step) {
          ctx.moveTo(gx + dotRadius, gy);
          ctx.arc(gx, gy, dotRadius, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      ctx.restore();
    } else if (pattern === "graph") {
      let step = 32;
      while (step * cam.k < 16) step *= 2;
      while (step * cam.k > 80) step /= 2;

      const startX = Math.floor(viewX0 / step) * step;
      const endX = Math.ceil(viewX1 / step) * step;
      const startY = Math.floor(viewY0 / step) * step;
      const endY = Math.ceil(viewY1 / step) * step;

      ctx.save();
      // Minor grid lines
      ctx.strokeStyle = dot;
      ctx.lineWidth = 0.8 / cam.k;
      ctx.beginPath();
      for (let gx = startX; gx <= endX; gx += step) {
        ctx.moveTo(gx, viewY0);
        ctx.lineTo(gx, viewY1);
      }
      for (let gy = startY; gy <= endY; gy += step) {
        ctx.moveTo(viewX0, gy);
        ctx.lineTo(viewX1, gy);
      }
      ctx.stroke();

      // Major grid lines (every 4 intervals)
      const majorStep = step * 4;
      const mStartX = Math.floor(viewX0 / majorStep) * majorStep;
      const mEndX = Math.ceil(viewX1 / majorStep) * majorStep;
      const mStartY = Math.floor(viewY0 / majorStep) * majorStep;
      const mEndY = Math.ceil(viewY1 / majorStep) * majorStep;

      ctx.lineWidth = 1.6 / cam.k;
      ctx.beginPath();
      for (let gx = mStartX; gx <= mEndX; gx += majorStep) {
        ctx.moveTo(gx, viewY0);
        ctx.lineTo(gx, viewY1);
      }
      for (let gy = mStartY; gy <= mEndY; gy += majorStep) {
        ctx.moveTo(viewX0, gy);
        ctx.lineTo(viewX1, gy);
      }
      ctx.stroke();
      ctx.restore();
    } else if (pattern === "ruled") {
      let step = 32;
      while (step * cam.k < 18) step *= 2;
      while (step * cam.k > 80) step /= 2;

      const startY = Math.floor(viewY0 / step) * step;
      const endY = Math.ceil(viewY1 / step) * step;

      ctx.save();
      ctx.strokeStyle = dot;
      ctx.lineWidth = 1 / cam.k;
      ctx.beginPath();
      for (let gy = startY; gy <= endY; gy += step) {
        ctx.moveTo(viewX0, gy);
        ctx.lineTo(viewX1, gy);
      }
      ctx.stroke();

      // Left vertical notebook margin line (classic red/coral accent)
      ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
      ctx.lineWidth = 1.5 / cam.k;
      ctx.beginPath();
      ctx.moveTo(80, viewY0);
      ctx.lineTo(80, viewY1);
      ctx.stroke();
      ctx.restore();
    } else if (pattern === "isometric") {
      let step = 36;
      while (step * cam.k < 20) step *= 2;
      while (step * cam.k > 90) step /= 2;

      const hStep = (step * Math.sqrt(3)) / 2;
      const tan30 = Math.tan(Math.PI / 6); // 1 / sqrt(3) ~= 0.57735

      ctx.save();
      ctx.strokeStyle = dot;
      ctx.lineWidth = 0.85 / cam.k;
      ctx.beginPath();

      // Horizontal lines
      const startY = Math.floor(viewY0 / hStep) * hStep;
      const endY = Math.ceil(viewY1 / hStep) * hStep;
      for (let gy = startY; gy <= endY; gy += hStep) {
        ctx.moveTo(viewX0, gy);
        ctx.lineTo(viewX1, gy);
      }

      // +30° lines (y = tan30 * x + c => c = y - tan30 * x)
      const cStep = hStep * 2;
      const minC1 = viewY0 - tan30 * viewX1;
      const maxC1 = viewY1 - tan30 * viewX0;
      const startC1 = Math.floor(minC1 / cStep) * cStep;
      const endC1 = Math.ceil(maxC1 / cStep) * cStep;
      for (let c = startC1; c <= endC1; c += cStep) {
        ctx.moveTo(viewX0, tan30 * viewX0 + c);
        ctx.lineTo(viewX1, tan30 * viewX1 + c);
      }

      // -30° lines (y = -tan30 * x + c => c = y + tan30 * x)
      const minC2 = viewY0 + tan30 * viewX0;
      const maxC2 = viewY1 + tan30 * viewX1;
      const startC2 = Math.floor(minC2 / cStep) * cStep;
      const endC2 = Math.ceil(maxC2 / cStep) * cStep;
      for (let c = startC2; c <= endC2; c += cStep) {
        ctx.moveTo(viewX0, -tan30 * viewX0 + c);
        ctx.lineTo(viewX1, -tan30 * viewX1 + c);
      }

      ctx.stroke();
      ctx.restore();
    }

    const paintStroke = (s: Stroke, selected: boolean, isLive: boolean = false) => {
      const b = s.bounds;
      const pad = s.width;
      if (b.x1 + pad < viewX0 || b.x0 - pad > viewX1 || b.y1 + pad < viewY0 || b.y0 - pad > viewY1)
        return;

      ctx.save();
      const isHighlighter = s.style === "highlighter";
      if (isHighlighter) {
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = s.opacity ?? 0.4;
        ctx.lineWidth = s.width * 1.5;
        ctx.lineCap = "square";
      } else {
        ctx.globalAlpha = s.opacity ?? 1;
        ctx.lineWidth = s.width;
        ctx.lineCap = "round";
      }

      ctx.strokeStyle = brushStyle(ctx, s);

      if (s.style === "calligraphy") {
        ctx.save();
        // Calligraphy ribbon drawing
        const pts = s.pts;
        if (pts.length > 1) {
          ctx.beginPath();
          const angle = Math.PI / 4; // 45 degree chisel nib
          const nx = Math.cos(angle) * (s.width / 2);
          const ny = Math.sin(angle) * (s.width / 2);
          for (let i = 0; i < pts.length; i++) {
            const p = pts[i]!;
            if (i === 0) ctx.moveTo(p.x - nx, p.y - ny);
            else ctx.lineTo(p.x - nx, p.y - ny);
          }
          for (let i = pts.length - 1; i >= 0; i--) {
            const p = pts[i]!;
            ctx.lineTo(p.x + nx, p.y + ny);
          }
          ctx.closePath();
          ctx.fillStyle = brushStyle(ctx, s);
          ctx.fill();
        }
        ctx.restore();
      } else {
        const path = getCachedPath(s, isLive);
        ctx.stroke(path);
      }

      // Selection Highlight aura
      if (selected) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = accent;
        ctx.lineWidth = s.width + 6 / cam.k;
        const path = getCachedPath(s, isLive);
        ctx.stroke(path);
        ctx.restore();
      }
      ctx.restore();
    };

    const sel = selectionRef.current;
    // Draw all completed strokes
    for (const s of strokesRef.current) {
      paintStroke(s, sel.has(s.id));
    }

    // Draw active in-progress stroke
    const live = liveRef.current;
    if (live) paintStroke(live, false, true);

    // Draw Lasso Freehand Boundary
    const lasso = lassoRef.current;
    if (lasso && lasso.length > 1) {
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5 / cam.k;
      ctx.setLineDash([5 / cam.k, 4 / cam.k]);
      ctx.beginPath();
      ctx.moveTo(lasso[0]!.x, lasso[0]!.y);
      for (const p of lasso) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.restore();
    }

    // Draw Marquee Box Boundary
    const marquee = marqueeRef.current;
    if (marquee) {
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5 / cam.k;
      ctx.setLineDash([5 / cam.k, 4 / cam.k]);
      const minX = Math.min(marquee.x0, marquee.x1);
      const minY = Math.min(marquee.y0, marquee.y1);
      const bw = Math.abs(marquee.x1 - marquee.x0);
      const bh = Math.abs(marquee.y1 - marquee.y0);
      ctx.strokeRect(minX, minY, bw, bh);
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = accent;
      ctx.fillRect(minX, minY, bw, bh);
      ctx.restore();
    }

    // Draw Selection Bounding Box & Transformation Handles
    if (sel.size > 0) {
      const selectedStrokes = strokesRef.current.filter((s) => sel.has(s.id));
      if (selectedStrokes.length > 0) {
        const bounds = computeGroupBounds(selectedStrokes);
        const pad = 10 / cam.k;
        const bx = bounds.x0 - pad;
        const by = bounds.y0 - pad;
        const bw = bounds.w + pad * 2;
        const bh = bounds.h + pad * 2;

        ctx.save();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5 / cam.k;
        ctx.strokeRect(bx, by, bw, bh);

        // Draw 8 Scale Handles
        const handleSize = 7 / cam.k;
        const handles = [
          { x: bx, y: by }, // top-left
          { x: bx + bw / 2, y: by }, // top-mid
          { x: bx + bw, y: by }, // top-right
          { x: bx + bw, y: by + bh / 2 }, // right-mid
          { x: bx + bw, y: by + bh }, // bottom-right
          { x: bx + bw / 2, y: by + bh }, // bottom-mid
          { x: bx, y: by + bh }, // bottom-left
          { x: bx, y: by + bh / 2 }, // left-mid
        ];

        ctx.fillStyle = paper;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5 / cam.k;
        for (const hPt of handles) {
          ctx.fillRect(hPt.x - handleSize / 2, hPt.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(hPt.x - handleSize / 2, hPt.y - handleSize / 2, handleSize, handleSize);
        }

        // Draw Top Rotation Handle
        const rotY = by - 24 / cam.k;
        ctx.beginPath();
        ctx.moveTo(bx + bw / 2, by);
        ctx.lineTo(bx + bw / 2, rotY);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(bx + bw / 2, rotY, handleSize / 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    }

    ctx.restore();

    // Draw Live Eraser Ring & Precision Indicator (Screen Space)
    if (toolRef.current === "eraser" && mousePosRef.current) {
      const { x, y } = mousePosRef.current;
      let erR = eraserSizeRef.current;
      if (gestureRef.current.mode === "erase" && eraserLastPtRef.current) {
        erR = eraserLastPtRef.current.r * cam.k;
      }
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, erR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle =
        gestureRef.current.mode === "erase"
          ? "rgba(168, 85, 247, 0.15)"
          : "rgba(99, 102, 241, 0.08)";
      ctx.fill();

      // Precision center dot
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();

      ctx.restore();
    }
  }, [pattern]);

  const requestDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      draw();
    });
  }, [draw]);

  /* ---------------- Persistence & Note Sync ---------------- */
  useEffect(() => {
    const note = getNote(noteId);
    if (note) {
      strokesRef.current = note.strokes ?? [];
      historyRef.current = [note.strokes ?? []];
      histIndexRef.current = 0;
      camRef.current = note.cam ?? { x: 0, y: 0, k: 1 };
      if (note.theme && THEMES.some((t) => t.id === note.theme)) setTheme(note.theme);
      if (note.pattern) setPattern(note.pattern);
      setTitle(note.title);
      setZoom(camRef.current.k);
      setStrokeCount(strokesRef.current.length);
      setCanUndo(false);
      setCanRedo(false);
    }
    requestDraw();
  }, [noteId, requestDraw]);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    requestDraw();
  }, [theme, requestDraw]);

  const save = useCallback(() => {
    dirtyRef.current = true;
    setIsSaving(true);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      updateNote(noteId, { strokes: strokesRef.current, cam: camRef.current, theme, pattern });
      setIsSaving(false);
    }, 1000);
    return () => clearInterval(t);
  }, [theme, pattern, noteId]);

  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      updateNote(noteId, { strokes: strokesRef.current, cam: camRef.current, theme, pattern });
      setIsSaving(false);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [noteId, theme, pattern]);

  /* ---------------- History Stack ---------------- */
  const commit = useCallback(
    (next: Stroke[]) => {
      strokesRef.current = next;
      setStrokeCount(next.length);
      const h = historyRef.current.slice(0, histIndexRef.current + 1);
      h.push(next);
      if (h.length > 80) h.shift();
      historyRef.current = h;
      histIndexRef.current = h.length - 1;
      setCanUndo(histIndexRef.current > 0);
      setCanRedo(false);
      save();
      requestDraw();
    },
    [requestDraw, save],
  );

  const jump = useCallback(
    (delta: number) => {
      const i = clamp(histIndexRef.current + delta, 0, historyRef.current.length - 1);
      if (i === histIndexRef.current) return;
      histIndexRef.current = i;
      strokesRef.current = historyRef.current[i] ?? [];
      setStrokeCount(strokesRef.current.length);
      selectionRef.current.clear();
      setHasSelection(false);
      setCanUndo(i > 0);
      setCanRedo(i < historyRef.current.length - 1);
      save();
      requestDraw();
    },
    [requestDraw, save],
  );

  /* ---------------- Camera & Zoom Helpers ---------------- */
  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const cam = camRef.current;
      const next = clamp(cam.k * factor, MIN_ZOOM, MAX_ZOOM);
      const ratio = next / cam.k;
      camRef.current = {
        k: next,
        x: px - (px - cam.x) * ratio,
        y: py - (py - cam.y) * ratio,
      };
      setZoom(next);
      save();
      requestDraw();
    },
    [requestDraw, save],
  );

  const setZoomLevel = useCallback(
    (targetK: number) => {
      const canvas = canvasRef.current;
      const w = canvas ? canvas.clientWidth : 800;
      const h = canvas ? canvas.clientHeight : 600;
      zoomAt(w / 2, h / 2, targetK / camRef.current.k);
    },
    [zoomAt],
  );

  const fitView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || strokesRef.current.length === 0) {
      camRef.current = { x: 0, y: 0, k: 1 };
      setZoom(1);
      requestDraw();
      return;
    }
    const bounds = computeGroupBounds(strokesRef.current);
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const pad = 60;
    const fitK = clamp(
      Math.min((cw - pad * 2) / bounds.w, (ch - pad * 2) / bounds.h),
      MIN_ZOOM,
      2.5,
    );
    camRef.current = {
      k: fitK,
      x: cw / 2 - bounds.cx * fitK,
      y: ch / 2 - bounds.cy * fitK,
    };
    setZoom(fitK);
    save();
    requestDraw();
  }, [requestDraw, save]);

  /* ---------------- Wheel & Resize Listeners ---------------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      if (e.ctrlKey || e.metaKey) {
        zoomAt(px, py, Math.exp(-e.deltaY * scale * 0.0025));
      } else {
        const cam = camRef.current;
        camRef.current = { ...cam, x: cam.x - e.deltaX * scale, y: cam.y - e.deltaY * scale };
        save();
        requestDraw();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, requestDraw, save]);

  useEffect(() => {
    const onResize = () => requestDraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [requestDraw]);

  /* ---------------- Selection Operations ---------------- */
  const deleteSelection = useCallback(() => {
    if (selectionRef.current.size === 0) return;
    const next = strokesRef.current.filter((s) => !selectionRef.current.has(s.id));
    selectionRef.current.clear();
    setHasSelection(false);
    commit(next);
  }, [commit]);

  const duplicateSelection = useCallback(() => {
    const sel = selectionRef.current;
    if (sel.size === 0) return;
    const offset = 24 / camRef.current.k;
    const cloned: Stroke[] = [];
    const newSel = new Set<string>();

    for (const s of strokesRef.current) {
      if (sel.has(s.id)) {
        const copy = translateStroke(s, offset, offset);
        copy.id = uid();
        cloned.push(copy);
        newSel.add(copy.id);
      }
    }
    selectionRef.current = newSel;
    commit([...strokesRef.current, ...cloned]);
  }, [commit]);

  const recolorSelection = useCallback(() => {
    const sel = selectionRef.current;
    if (sel.size === 0) return;
    const curBrush = brushRef.current;
    const curOpacity = opacityRef.current;
    const next = strokesRef.current.map((s) => {
      if (sel.has(s.id)) {
        return {
          ...s,
          brush: curBrush,
          opacity: curOpacity,
        };
      }
      return s;
    });
    commit(next);
  }, [commit]);

  const thickenSelection = useCallback(
    (delta: number) => {
      const sel = selectionRef.current;
      if (sel.size === 0) return;
      const next = strokesRef.current.map((s) => {
        if (sel.has(s.id)) {
          return {
            ...s,
            width: Math.max(1, s.width + delta),
          };
        }
        return s;
      });
      commit(next);
    },
    [commit],
  );

  const flipSelection = useCallback(
    (axis: "h" | "v") => {
      const sel = selectionRef.current;
      if (sel.size === 0) return;
      const selected = strokesRef.current.filter((s) => sel.has(s.id));
      const bounds = computeGroupBounds(selected);
      const next = strokesRef.current.map((s) => {
        if (sel.has(s.id)) {
          return flipStroke(s, bounds.cx, bounds.cy, axis);
        }
        return s;
      });
      commit(next);
    },
    [commit],
  );

  const rotateSelection = useCallback(
    (angleDeg: number) => {
      const sel = selectionRef.current;
      if (sel.size === 0) return;
      const selected = strokesRef.current.filter((s) => sel.has(s.id));
      const bounds = computeGroupBounds(selected);
      const rad = (angleDeg * Math.PI) / 180;
      const next = strokesRef.current.map((s) => {
        if (sel.has(s.id)) {
          return rotateStroke(s, { x: bounds.cx, y: bounds.cy }, rad);
        }
        return s;
      });
      commit(next);
    },
    [commit],
  );

  const deselect = useCallback(() => {
    selectionRef.current.clear();
    setHasSelection(false);
    requestDraw();
  }, [requestDraw]);

  /* ---------------- Keyboard Shortcuts ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        jump(e.shiftKey ? 1 : -1);
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const allIds = new Set(strokesRef.current.map((s) => s.id));
        selectionRef.current = allIds;
        setHasSelection(allIds.size > 0);
        requestDraw();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectionRef.current.size) {
          e.preventDefault();
          deleteSelection();
        }
        return;
      }
      if (e.key === "Escape") {
        deselect();
        return;
      }

      const map: Record<string, Tool> = {
        p: "pen",
        e: "eraser",
        l: "lasso",
        h: "hand",
        v: "hand",
        s: "shape",
      };
      const t = map[e.key.toLowerCase()];
      if (t) setTool(t);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump, deleteSelection, duplicateSelection, deselect, requestDraw]);

  /* ---------------- Pointer / Drawing State Machine ---------------- */
  const localPoint = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const performEraseStep = (p0: EraserPt, p1: EraserPt): boolean => {
    const mode = eraserModeRef.current;
    const filter = eraserFilterRef.current;

    if (mode === "stroke") {
      const initialLen = strokesRef.current.length;
      const kept = strokesRef.current.filter((s) => {
        if (filter === "pen-only" && s.style === "highlighter") return true;
        if (filter === "highlighter-only" && s.style !== "highlighter") return true;
        return !strokeIntersectsEraserSegment(s, p0.x, p0.y, p0.r, p1.x, p1.y, p1.r);
      });
      if (kept.length !== initialLen) {
        strokesRef.current = kept;
        return true;
      }
      return false;
    } else {
      let changed = false;
      const next: Stroke[] = [];
      for (const s of strokesRef.current) {
        if (
          (filter === "pen-only" && s.style === "highlighter") ||
          (filter === "highlighter-only" && s.style !== "highlighter")
        ) {
          next.push(s);
          continue;
        }

        const splits = splitStrokeByEraserSegment(s, p0.x, p0.y, p0.r, p1.x, p1.y, p1.r);
        if (splits.length !== 1 || splits[0] !== s) {
          changed = true;
          next.push(...splits);
        } else {
          next.push(s);
        }
      }
      if (changed) {
        strokesRef.current = next;
        return true;
      }
      return false;
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const { x, y } = localPoint(e);
    pointersRef.current.set(e.pointerId, { x, y });
    mousePosRef.current = { x, y };

    if (pointersRef.current.size === 2) {
      liveRef.current = null;
      lassoRef.current = null;
      marqueeRef.current = null;
      const pts = [...pointersRef.current.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      gestureRef.current = {
        mode: "pinch",
        startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        startK: camRef.current.k,
        lastCx: (a.x + b.x) / 2,
        lastCy: (a.y + b.y) / 2,
      };
      requestDraw();
      return;
    }
    if (pointersRef.current.size > 2) return;

    const world = toWorld(camRef.current, x, y);
    const middle = e.button === 1;
    const activeTool = toolRef.current;

    // Hand / Pan navigation
    if (activeTool === "hand" || middle || (e.pointerType === "mouse" && e.shiftKey)) {
      gestureRef.current = { mode: "pan", id: e.pointerId, lastX: x, lastY: y };
      return;
    }

    // Selection gizmo hit testing
    const sel = selectionRef.current;
    if (sel.size > 0) {
      const selected = strokesRef.current.filter((s) => sel.has(s.id));
      if (selected.length > 0) {
        const bounds = computeGroupBounds(selected);
        const pad = 10 / camRef.current.k;
        const bx = bounds.x0 - pad;
        const by = bounds.y0 - pad;
        const bw = bounds.w + pad * 2;
        const bh = bounds.h + pad * 2;
        const rotY = by - 24 / camRef.current.k;
        const handleHitDist = 14 / camRef.current.k;

        // Check rotation handle hit
        if (Math.hypot(world.x - (bx + bw / 2), world.y - rotY) <= handleHitDist) {
          gestureRef.current = {
            mode: "rotate",
            id: e.pointerId,
            center: { x: bounds.cx, y: bounds.cy },
            initialStrokes: selected,
            startAngle: Math.atan2(world.y - bounds.cy, world.x - bounds.cx),
          };
          return;
        }

        // Check 8 scale handles
        const handleList = [
          { id: "nw", x: bx, y: by },
          { id: "n", x: bx + bw / 2, y: by },
          { id: "ne", x: bx + bw, y: by },
          { id: "e", x: bx + bw, y: by + bh / 2 },
          { id: "se", x: bx + bw, y: by + bh },
          { id: "s", x: bx + bw / 2, y: by + bh },
          { id: "sw", x: bx, y: by + bh },
          { id: "w", x: bx, y: by + bh / 2 },
        ];

        for (const hnd of handleList) {
          if (Math.hypot(world.x - hnd.x, world.y - hnd.y) <= handleHitDist) {
            gestureRef.current = {
              mode: "scale",
              id: e.pointerId,
              handle: hnd.id,
              initialBounds: bounds,
              initialStrokes: selected,
              startPt: { x: world.x, y: world.y, p: 1 },
            };
            return;
          }
        }

        // Check inside bounding box or on stroke -> move
        if (
          (world.x >= bx && world.x <= bx + bw && world.y >= by && world.y <= by + bh) ||
          selected.some((s) => pointNearStroke(s, world.x, world.y, 16 / camRef.current.k))
        ) {
          gestureRef.current = { mode: "move", id: e.pointerId, lastX: world.x, lastY: world.y };
          return;
        }
      }

      // Clicked outside selection: clear and proceed with active tool immediately
      sel.clear();
      setHasSelection(false);
    }

    // Lasso Selection tool
    if (activeTool === "lasso") {
      if (lassoModeRef.current === "freehand") {
        lassoRef.current = [{ x: world.x, y: world.y, p: 1 }];
        gestureRef.current = { mode: "lasso", id: e.pointerId };
      } else {
        marqueeRef.current = { x0: world.x, y0: world.y, x1: world.x, y1: world.y };
        gestureRef.current = {
          mode: "marquee",
          id: e.pointerId,
          start: { x: world.x, y: world.y, p: 1 },
        };
      }
      requestDraw();
      return;
    }

    // Eraser Tool
    if (activeTool === "eraser") {
      const pressure = e.pointerType === "pen" ? clamp(e.pressure || 0.5, 0.15, 1) : 0.7;
      const baseR = eraserSizeRef.current / camRef.current.k;
      const r = baseR * (e.pointerType === "pen" ? 0.6 + pressure * 0.6 : 1);
      const startPt: EraserPt = { x: world.x, y: world.y, p: pressure, r };

      eraserLastPtRef.current = startPt;
      gestureRef.current = { mode: "erase", id: e.pointerId };

      performEraseStep(startPt, startPt);
      requestDraw();
      return;
    }

    // Shape Tool
    if (activeTool === "shape") {
      shapeStartRef.current = { x: world.x, y: world.y, p: 1 };
      gestureRef.current = {
        mode: "shape",
        id: e.pointerId,
        start: { x: world.x, y: world.y, p: 1 },
      };
      liveRef.current = generateShape(
        shapeTypeRef.current,
        shapeStartRef.current,
        shapeStartRef.current,
        brushRef.current,
        sizeRef.current,
      );
      requestDraw();
      return;
    }

    // Pen Tool
    const pressure = e.pointerType === "pen" ? clamp(e.pressure || 0.5, 0.15, 1) : 0.7;
    const style = penStyleRef.current;
    liveRef.current = {
      id: uid(),
      pts: [{ x: world.x, y: world.y, p: pressure }],
      width: sizeRef.current * (style === "highlighter" ? 1.5 : 0.75 + pressure * 0.5),
      brush: brushRef.current,
      style,
      opacity: opacityRef.current,
      bounds: { x0: world.x, y0: world.y, x1: world.x, y1: world.y },
    };
    gestureRef.current = { mode: "draw", id: e.pointerId };
    requestDraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { x, y } = localPoint(e);
    mousePosRef.current = { x, y };

    const world = toWorld(camRef.current, x, y);

    // Hover cursor feedback when selection is active and not mid-gesture
    if (selectionRef.current.size > 0 && gestureRef.current.mode === "none" && wrapRef.current) {
      const selStrokes = strokesRef.current.filter((s) => selectionRef.current.has(s.id));
      if (selStrokes.length > 0) {
        const bounds = computeGroupBounds(selStrokes);
        const pad = 10 / camRef.current.k;
        const bx = bounds.x0 - pad;
        const by = bounds.y0 - pad;
        const bw = bounds.w + pad * 2;
        const bh = bounds.h + pad * 2;
        const rotY = by - 24 / camRef.current.k;
        const handleHitDist = 14 / camRef.current.k;

        if (Math.hypot(world.x - (bx + bw / 2), world.y - rotY) <= handleHitDist) {
          wrapRef.current.style.cursor = "grab";
        } else if (
          Math.hypot(world.x - bx, world.y - by) <= handleHitDist ||
          Math.hypot(world.x - (bx + bw), world.y - (by + bh)) <= handleHitDist
        ) {
          wrapRef.current.style.cursor = "nwse-resize";
        } else if (
          Math.hypot(world.x - (bx + bw), world.y - by) <= handleHitDist ||
          Math.hypot(world.x - bx, world.y - (by + bh)) <= handleHitDist
        ) {
          wrapRef.current.style.cursor = "nesw-resize";
        } else if (
          Math.hypot(world.x - (bx + bw / 2), world.y - by) <= handleHitDist ||
          Math.hypot(world.x - (bx + bw / 2), world.y - (by + bh)) <= handleHitDist
        ) {
          wrapRef.current.style.cursor = "ns-resize";
        } else if (
          Math.hypot(world.x - bx, world.y - (by + bh / 2)) <= handleHitDist ||
          Math.hypot(world.x - (bx + bw), world.y - (by + bh / 2)) <= handleHitDist
        ) {
          wrapRef.current.style.cursor = "ew-resize";
        } else if (
          (world.x >= bx && world.x <= bx + bw && world.y >= by && world.y <= by + bh) ||
          selStrokes.some((s) => pointNearStroke(s, world.x, world.y, 16 / camRef.current.k))
        ) {
          wrapRef.current.style.cursor = "move";
        } else {
          wrapRef.current.style.cursor = cursor;
        }
      }
    } else if (wrapRef.current && wrapRef.current.style.cursor !== cursor) {
      wrapRef.current.style.cursor = cursor;
    }

    if (!pointersRef.current.has(e.pointerId)) {
      if (toolRef.current === "eraser") requestDraw();
      return;
    }
    pointersRef.current.set(e.pointerId, { x, y });
    const g = gestureRef.current;

    // Pinch Zoom / Pan
    if (g.mode === "pinch") {
      const pts = [...pointersRef.current.values()];
      const a = pts[0];
      const b = pts[1];
      if (!a || !b) return;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const cam = camRef.current;
      const nextK = clamp(g.startK * (dist / g.startDist), MIN_ZOOM, MAX_ZOOM);
      const ratio = nextK / cam.k;
      camRef.current = {
        k: nextK,
        x: cx - (cx - cam.x) * ratio + (cx - g.lastCx),
        y: cy - (cy - cam.y) * ratio + (cy - g.lastCy),
      };
      g.lastCx = cx;
      g.lastCy = cy;
      setZoom(nextK);
      requestDraw();
      return;
    }

    if (g.mode === "none" || g.id !== e.pointerId) {
      if (toolRef.current === "eraser") requestDraw();
      return;
    }

    // Pan
    if (g.mode === "pan") {
      const cam = camRef.current;
      camRef.current = { ...cam, x: cam.x + (x - g.lastX), y: cam.y + (y - g.lastY) };
      g.lastX = x;
      g.lastY = y;
      requestDraw();
      return;
    }

    // Erase
    if (g.mode === "erase") {
      const events =
        typeof e.nativeEvent.getCoalescedEvents === "function"
          ? e.nativeEvent.getCoalescedEvents()
          : [e.nativeEvent];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const baseR = eraserSizeRef.current / camRef.current.k;

      for (const ev of events.length ? events : [e.nativeEvent]) {
        const w = toWorld(camRef.current, ev.clientX - rect.left, ev.clientY - rect.top);
        const pressure = e.pointerType === "pen" ? clamp(ev.pressure || 0.5, 0.15, 1) : 0.7;
        const r = baseR * (e.pointerType === "pen" ? 0.6 + pressure * 0.6 : 1);
        const pt: EraserPt = { x: w.x, y: w.y, p: pressure, r };

        const lastPt = eraserLastPtRef.current ?? pt;
        if (!eraserLastPtRef.current || shouldAddPoint(lastPt, pt, 0.8 / camRef.current.k)) {
          eraserLastPtRef.current = pt;
          performEraseStep(lastPt, pt);
        }
      }
      requestDraw();
      return;
    }

    // Lasso Freehand
    if (g.mode === "lasso") {
      const poly = lassoRef.current;
      if (!poly) return;
      const last = poly[poly.length - 1];
      if (shouldAddPoint(last, { x: world.x, y: world.y, p: 1 }, 3 / camRef.current.k)) {
        poly.push({ x: world.x, y: world.y, p: 1 });
        requestDraw();
      }
      return;
    }

    // Lasso Marquee Box
    if (g.mode === "marquee") {
      marqueeRef.current = {
        x0: g.start.x,
        y0: g.start.y,
        x1: world.x,
        y1: world.y,
      };
      requestDraw();
      return;
    }

    // Move Selection
    if (g.mode === "move") {
      const dx = world.x - g.lastX;
      const dy = world.y - g.lastY;
      g.lastX = world.x;
      g.lastY = world.y;
      const sel = selectionRef.current;
      strokesRef.current = strokesRef.current.map((s) =>
        sel.has(s.id) ? translateStroke(s, dx, dy) : s,
      );
      requestDraw();
      return;
    }

    // Rotate Selection
    if (g.mode === "rotate") {
      const currentAngle = Math.atan2(world.y - g.center.y, world.x - g.center.x);
      const angleDelta = currentAngle - g.startAngle;
      const sel = selectionRef.current;
      strokesRef.current = strokesRef.current.map((s) => {
        if (sel.has(s.id)) {
          const initS = g.initialStrokes.find((is) => is.id === s.id);
          if (initS) return rotateStroke(initS, g.center, angleDelta);
        }
        return s;
      });
      requestDraw();
      return;
    }

    // Scale Selection
    if (g.mode === "scale") {
      const b = g.initialBounds;
      const handle = g.handle;
      const bw = b.w || 1;
      const bh = b.h || 1;
      let scaleX = 1;
      let scaleY = 1;

      if (handle.includes("e")) scaleX = (world.x - b.x0) / bw;
      if (handle.includes("w")) scaleX = (b.x1 - world.x) / bw;
      if (handle.includes("s")) scaleY = (world.y - b.y0) / bh;
      if (handle.includes("n")) scaleY = (b.y1 - world.y) / bh;

      if (Math.abs(scaleX) < 0.05) scaleX = Math.sign(scaleX || 1) * 0.05;
      if (Math.abs(scaleY) < 0.05) scaleY = Math.sign(scaleY || 1) * 0.05;

      const origin = {
        x: handle.includes("w") ? b.x1 : handle.includes("e") ? b.x0 : b.cx,
        y: handle.includes("n") ? b.y1 : handle.includes("s") ? b.y0 : b.cy,
      };

      const sel = selectionRef.current;
      strokesRef.current = strokesRef.current.map((s) => {
        if (sel.has(s.id)) {
          const initS = g.initialStrokes.find((is) => is.id === s.id);
          if (initS) return scaleStroke(initS, origin, scaleX, scaleY);
        }
        return s;
      });
      requestDraw();
      return;
    }

    // Shape Drag
    if (g.mode === "shape") {
      liveRef.current = generateShape(
        shapeTypeRef.current,
        g.start,
        { x: world.x, y: world.y, p: 1 },
        brushRef.current,
        sizeRef.current,
      );
      requestDraw();
      return;
    }

    // Pen Draw
    if (g.mode === "draw") {
      const live = liveRef.current;
      if (!live) return;
      const events =
        typeof e.nativeEvent.getCoalescedEvents === "function"
          ? e.nativeEvent.getCoalescedEvents()
          : [e.nativeEvent];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      for (const ev of events.length ? events : [e.nativeEvent]) {
        const w = toWorld(camRef.current, ev.clientX - rect.left, ev.clientY - rect.top);
        const pt: Pt = {
          x: w.x,
          y: w.y,
          p: e.pointerType === "pen" ? clamp(ev.pressure || 0.5, 0.15, 1) : 0.7,
        };
        if (shouldAddPoint(live.pts[live.pts.length - 1], pt, 1.2 / camRef.current.k)) {
          live.pts.push(pt);
          const b = live.bounds;
          b.x0 = Math.min(b.x0, pt.x);
          b.y0 = Math.min(b.y0, pt.y);
          b.x1 = Math.max(b.x1, pt.x);
          b.y1 = Math.max(b.y1, pt.y);
        }
      }
      requestDraw();
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    const g = gestureRef.current;

    if (g.mode === "pinch") {
      if (pointersRef.current.size < 2) gestureRef.current = { mode: "none" };
      save();
      return;
    }
    if (g.mode === "none" || g.id !== e.pointerId) return;
    gestureRef.current = { mode: "none" };

    // Finalize Pen Drawing
    if (g.mode === "draw") {
      let live = liveRef.current;
      liveRef.current = null;
      if (live && live.pts.length > 0) {
        // Check for Shape Auto-Snapping
        if (autoSnapShapeRef.current && live.style === "pen") {
          const snapped = detectAndSnapShape(live.pts);
          if (snapped) {
            live = {
              ...live,
              pts: snapped.pts,
              style: snapped.type,
              bounds: computeBounds(snapped.pts),
            };
          }
        }
        live.bounds = computeBounds(live.pts);
        commit([...strokesRef.current, live]);
      } else {
        requestDraw();
      }
      return;
    }

    // Finalize Shape
    if (g.mode === "shape") {
      const live = liveRef.current;
      liveRef.current = null;
      if (live && live.pts.length > 0) {
        commit([...strokesRef.current, live]);
      } else {
        requestDraw();
      }
      return;
    }

    // Finalize Erase
    if (g.mode === "erase") {
      eraserLastPtRef.current = null;
      commit([...strokesRef.current]);
      requestDraw();
      return;
    }

    // Finalize Move, Scale, Rotate
    if (g.mode === "move" || g.mode === "scale" || g.mode === "rotate") {
      commit([...strokesRef.current]);
      return;
    }

    // Finalize Freehand Lasso
    if (g.mode === "lasso") {
      const poly = lassoRef.current;
      lassoRef.current = null;
      const sel = selectionRef.current;
      sel.clear();
      if (poly && poly.length > 2) {
        for (const s of strokesRef.current) {
          if (strokeInLasso(s, poly)) sel.add(s.id);
        }
      } else if (poly && poly.length > 0) {
        // Tap to select single stroke
        const tap = poly[0]!;
        const hit = [...strokesRef.current]
          .reverse()
          .find((s) => pointNearStroke(s, tap.x, tap.y, 14 / camRef.current.k));
        if (hit) sel.add(hit.id);
      }
      setHasSelection(sel.size > 0);
      requestDraw();
      return;
    }

    // Finalize Marquee Box Selection
    if (g.mode === "marquee") {
      const marquee = marqueeRef.current;
      marqueeRef.current = null;
      const sel = selectionRef.current;
      sel.clear();
      if (marquee) {
        const bw = Math.abs(marquee.x1 - marquee.x0);
        const bh = Math.abs(marquee.y1 - marquee.y0);
        if (bw > 4 / camRef.current.k || bh > 4 / camRef.current.k) {
          for (const s of strokesRef.current) {
            if (strokeInRect(s, marquee)) sel.add(s.id);
          }
        } else {
          // Tap to select
          const hit = [...strokesRef.current]
            .reverse()
            .find((s) => pointNearStroke(s, marquee.x0, marquee.y0, 14 / camRef.current.k));
          if (hit) sel.add(hit.id);
        }
      }
      setHasSelection(sel.size > 0);
      requestDraw();
      return;
    }

    save();
  };

  /* ---------------- Export Canvas Features ---------------- */
  const exportImage = useCallback(
    (format: "png" | "svg" | "json") => {
      const strokes = strokesRef.current;
      const css = getComputedStyle(document.documentElement);
      const paper = css.getPropertyValue("--canvas-paper").trim() || "#ffffff";

      if (format === "json") {
        const dataStr =
          "data:text/json;charset=utf-8," +
          encodeURIComponent(
            JSON.stringify(
              {
                title,
                theme,
                pattern,
                strokes,
                exportedAt: new Date().toISOString(),
              },
              null,
              2,
            ),
          );
        const a = document.createElement("a");
        a.href = dataStr;
        a.download = `${title.toLowerCase().replace(/\s+/g, "_") || "note"}.json`;
        a.click();
        return;
      }

      if (strokes.length === 0) {
        alert("Canvas is empty. Draw something before exporting!");
        return;
      }

      const bounds = computeGroupBounds(strokes);
      const pad = 40;
      const expW = Math.max(200, Math.round(bounds.w + pad * 2));
      const expH = Math.max(200, Math.round(bounds.h + pad * 2));

      if (format === "svg") {
        const svgLines: string[] = [];
        svgLines.push(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x0 - pad} ${bounds.y0 - pad} ${expW} ${expH}" width="${expW}" height="${expH}">`,
        );
        svgLines.push(
          `<rect x="${bounds.x0 - pad}" y="${bounds.y0 - pad}" width="${expW}" height="${expH}" fill="${paper}"/>`,
        );
        svgLines.push("<defs>");
        strokes.forEach((s, idx) => {
          if (s.brush.kind === "gradient") {
            svgLines.push(
              `<linearGradient id="exp-g-${idx}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${s.brush.from}"/><stop offset="100%" stop-color="${s.brush.to}"/></linearGradient>`,
            );
          }
        });
        svgLines.push("</defs>");

        strokes.forEach((s, idx) => {
          const strokeColor = s.brush.kind === "solid" ? s.brush.color : `url(#exp-g-${idx})`;
          const ptsStr = s.pts.map((p) => `${p.x},${p.y}`).join(" ");
          svgLines.push(
            `<polyline points="${ptsStr}" fill="none" stroke="${strokeColor}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.opacity ?? 1}"/>`,
          );
        });
        svgLines.push("</svg>");

        const blob = new Blob([svgLines.join("\n")], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.toLowerCase().replace(/\s+/g, "_") || "drawing"}.svg`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      if (format === "png") {
        const offCanvas = document.createElement("canvas");
        const scale = 2; // high-dpi 2x export
        offCanvas.width = expW * scale;
        offCanvas.height = expH * scale;
        const octx = offCanvas.getContext("2d");
        if (!octx) return;

        octx.scale(scale, scale);
        octx.fillStyle = paper;
        octx.fillRect(0, 0, expW, expH);

        octx.translate(-(bounds.x0 - pad), -(bounds.y0 - pad));
        octx.lineCap = "round";
        octx.lineJoin = "round";

        strokes.forEach((s) => {
          octx.save();
          if (s.style === "highlighter") {
            octx.globalCompositeOperation = "multiply";
            octx.globalAlpha = s.opacity ?? 0.4;
            octx.lineWidth = s.width * 1.5;
            octx.lineCap = "square";
          } else {
            octx.globalAlpha = s.opacity ?? 1;
            octx.lineWidth = s.width;
          }
          octx.strokeStyle = brushStyle(octx, s);
          const path = strokePath(s.pts);
          octx.stroke(path);
          octx.restore();
        });

        const url = offCanvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title.toLowerCase().replace(/\s+/g, "_") || "drawing"}.png`;
        a.click();
      }
    },
    [title, theme, pattern],
  );

  /* ---------------- Dynamic Cursor ---------------- */
  const cursor = useMemo(() => {
    if (tool === "hand") return "grab";
    if (tool === "eraser") return "none"; // custom ring cursor rendered on canvas
    if (tool === "lasso") return "crosshair";
    if (tool === "shape") return "crosshair";
    return "crosshair";
  }, [tool]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background select-none">
      {/* Canvas Wrap */}
      <div
        ref={wrapRef}
        className="absolute inset-0 touch-none"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      {/* Redesigned Floating Toolbar & Controls */}
      <Toolbar
        title={title}
        onTitleChange={(t) => {
          setTitle(t);
          updateNote(noteId, { title: t });
        }}
        isSaving={isSaving}
        strokeCount={strokeCount}
        tool={tool}
        setTool={setTool}
        penStyle={penStyle}
        setPenStyle={setPenStyle}
        eraserMode={eraserMode}
        setEraserMode={setEraserMode}
        eraserFilter={eraserFilter}
        setEraserFilter={setEraserFilter}
        eraserSize={eraserSize}
        setEraserSize={setEraserSize}
        lassoMode={lassoMode}
        setLassoMode={setLassoMode}
        shapeType={shapeType}
        setShapeType={setShapeType}
        autoSnapShape={autoSnapShape}
        setAutoSnapShape={setAutoSnapShape}
        brush={brush}
        setBrush={setBrush}
        size={size}
        setSize={setSize}
        opacity={opacity}
        setOpacity={setOpacity}
        theme={theme}
        setTheme={setTheme}
        pattern={pattern}
        setPattern={setPattern}
        zoom={zoom}
        setZoomLevel={setZoomLevel}
        canUndo={canUndo}
        canRedo={canRedo}
        hasSelection={hasSelection}
        onUndo={() => jump(-1)}
        onRedo={() => jump(1)}
        onDeleteSelection={deleteSelection}
        onDuplicateSelection={duplicateSelection}
        onRecolorSelection={recolorSelection}
        onThickenSelection={thickenSelection}
        onFlipSelection={flipSelection}
        onRotateSelection={rotateSelection}
        onDeselect={deselect}
        onResetView={() => {
          camRef.current = { x: 0, y: 0, k: 1 };
          setZoom(1);
          save();
          requestDraw();
        }}
        onFitView={fitView}
        onClear={() => {
          if (strokesRef.current.length === 0) return;
          if (confirm("Are you sure you want to clear the entire canvas?")) {
            selectionRef.current.clear();
            setHasSelection(false);
            commit([]);
          }
        }}
        onExportImage={exportImage}
      />
    </div>
  );
}
