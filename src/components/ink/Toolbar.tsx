import { useState } from "react";
import {
  Pen,
  Highlighter,
  Brush as BrushIcon,
  Eraser,
  Lasso,
  Hand,
  Undo2,
  Redo2,
  Trash2,
  Palette,
  Crosshair,
  Sparkles,
  X,
  ChevronLeft,
  Minus,
  MoveRight,
  Square,
  Circle,
  Shapes,
  Scissors,
  Copy,
  FlipHorizontal,
  FlipVertical,
  Download,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Layers,
  Wand2,
  RotateCw,
  Check,
  FileCode,
  Image as ImageIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Brush, StrokeStyle } from "@/lib/ink";
import {
  brushCss,
  GRADIENTS,
  SOLID_COLORS,
  HIGHLIGHTER_COLORS,
  THEMES,
  PAPER_PATTERNS,
  type ThemeId,
  type PaperPatternId,
} from "./palette";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Tool = "pen" | "eraser" | "lasso" | "hand" | "shape";
export type EraserMode = "stroke" | "precision";
export type EraserFilter = "all" | "pen-only" | "highlighter-only";
export type LassoMode = "freehand" | "rect";
export type ShapeType = "line" | "arrow" | "rectangle" | "ellipse";

type Props = {
  title: string;
  onTitleChange: (t: string) => void;
  isSaving: boolean;
  strokeCount: number;
  // Tool state
  tool: Tool;
  setTool: (t: Tool) => void;
  penStyle: StrokeStyle;
  setPenStyle: (s: StrokeStyle) => void;
  eraserMode: EraserMode;
  setEraserMode: (m: EraserMode) => void;
  eraserFilter: EraserFilter;
  setEraserFilter: (f: EraserFilter) => void;
  eraserSize: number;
  setEraserSize: (s: number) => void;
  lassoMode: LassoMode;
  setLassoMode: (m: LassoMode) => void;
  shapeType: ShapeType;
  setShapeType: (s: ShapeType) => void;
  autoSnapShape: boolean;
  setAutoSnapShape: (b: boolean) => void;
  // Appearance
  brush: Brush;
  setBrush: (b: Brush) => void;
  size: number;
  setSize: (n: number) => void;
  opacity: number;
  setOpacity: (o: number) => void;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  pattern: PaperPatternId;
  setPattern: (p: PaperPatternId) => void;
  zoom: number;
  setZoomLevel: (z: number) => void;
  // Actions
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelection: () => void;
  onDuplicateSelection: () => void;
  onRecolorSelection: () => void;
  onThickenSelection: (delta: number) => void;
  onFlipSelection: (axis: "h" | "v") => void;
  onRotateSelection: (angleDeg: number) => void;
  onDeselect: () => void;
  onResetView: () => void;
  onFitView: () => void;
  onClear: () => void;
  onExportImage: (format: "png" | "svg" | "json") => void;
};

const PEN_STYLES: { id: StrokeStyle; label: string; icon: typeof Pen; desc: string }[] = [
  { id: "pen", label: "Studio Pen", icon: Pen, desc: "Smooth pressure-sensitive vector ink" },
  {
    id: "calligraphy",
    label: "Calligraphy Nib",
    icon: BrushIcon,
    desc: "Chisel-edge ribbon stroke for script",
  },
  {
    id: "highlighter",
    label: "Highlighter",
    icon: Highlighter,
    desc: "Translucent luminous marker with multiply blend",
  },
  {
    id: "brush",
    label: "Watercolor Brush",
    icon: Sparkles,
    desc: "Expressive tapered fluid strokes",
  },
];

const SHAPE_ITEMS: { id: ShapeType; label: string; icon: typeof Minus }[] = [
  { id: "line", label: "Straight Line", icon: Minus },
  { id: "arrow", label: "Arrow", icon: MoveRight },
  { id: "rectangle", label: "Rectangle", icon: Square },
  { id: "ellipse", label: "Ellipse & Circle", icon: Circle },
];

const QUICK_SIZES = [1.5, 3, 6, 12, 20, 32];

export function Toolbar(p: Props) {
  const [activePanel, setActivePanel] = useState<
    null | "palette" | "pen-menu" | "eraser-menu" | "lasso-menu" | "shape-menu" | "theme"
  >(null);
  const [customFrom, setCustomFrom] = useState("#6366f1");
  const [customTo, setCustomTo] = useState("#ec4899");

  const closePanel = () => setActivePanel(null);

  return (
    <>
      {/* Top Floating Glass Bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3 sm:p-4">
        {/* Left Island: Back + Title + Status */}
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-panel-border bg-panel/85 p-1.5 shadow-float backdrop-blur-xl transition-all">
          <Link
            to="/"
            aria-label="Back to all notes"
            title="Back to all notes"
            className="grid h-9 w-9 place-items-center rounded-xl text-panel-foreground/75 transition-colors hover:bg-panel-accent hover:text-panel-foreground"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Link>
          <div className="flex flex-col min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <input
                value={p.title}
                onChange={(e) => p.onTitleChange(e.target.value)}
                aria-label="Note title"
                placeholder="Untitled notebook"
                className="w-32 truncate border-none bg-transparent font-display text-sm font-semibold leading-tight tracking-tight text-panel-foreground outline-none placeholder:text-panel-foreground/40 focus:w-48 sm:w-48 sm:focus:w-64 transition-all"
              />
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  p.isSaving
                    ? "bg-amber-400 animate-pulse"
                    : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                )}
                title={p.isSaving ? "Saving changes..." : "All changes saved locally"}
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] text-panel-foreground/50 font-medium">
              <span>{p.strokeCount} strokes</span>
              <span>•</span>
              <span className="capitalize">{p.theme}</span>
            </div>
          </div>
        </div>

        {/* Right Island: History + Zoom + View + Themes + Export + AI */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-panel-border bg-panel/85 p-1.5 shadow-float backdrop-blur-xl">
          {/* Undo / Redo */}
          <button
            type="button"
            aria-label="Undo stroke"
            title="Undo (Ctrl+Z)"
            disabled={!p.canUndo}
            onClick={p.onUndo}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl text-panel-foreground/75 transition-all hover:bg-panel-accent hover:text-panel-foreground active:scale-95",
              !p.canUndo && "pointer-events-none opacity-25",
            )}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Redo stroke"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!p.canRedo}
            onClick={p.onRedo}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl text-panel-foreground/75 transition-all hover:bg-panel-accent hover:text-panel-foreground active:scale-95",
              !p.canRedo && "pointer-events-none opacity-25",
            )}
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <span className="mx-0.5 h-5 w-px bg-panel-border" />

          {/* Zoom Control Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Zoom options"
                className="flex h-9 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold tabular-nums text-panel-foreground/80 transition-colors hover:bg-panel-accent hover:text-panel-foreground"
              >
                <span>{Math.round(p.zoom * 100)}%</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 bg-panel/95 backdrop-blur-2xl border-panel-border text-panel-foreground"
            >
              <DropdownMenuItem
                onClick={() => p.setZoomLevel(0.5)}
                className="flex justify-between"
              >
                <span>50%</span>
                <span className="text-xs text-panel-foreground/40">Zoom out</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => p.setZoomLevel(1.0)}
                className="flex justify-between font-medium"
              >
                <span>100% (Actual)</span>
                <span className="text-xs text-panel-foreground/40">1:1</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => p.setZoomLevel(2.0)}
                className="flex justify-between"
              >
                <span>200%</span>
                <span className="text-xs text-panel-foreground/40">Zoom in</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-panel-border" />
              <DropdownMenuItem onClick={p.onFitView} className="gap-2">
                <Crosshair className="h-4 w-4" />
                <span>Fit All Content</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={p.onResetView} className="gap-2">
                <RotateCw className="h-4 w-4" />
                <span>Reset Origin (0,0)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="mx-0.5 h-5 w-px bg-panel-border" />

          {/* Paper Pattern & Theme Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Paper & Grid Settings"
                title="Paper & Grid Settings"
                className="grid h-9 w-9 place-items-center rounded-xl text-panel-foreground/75 transition-colors hover:bg-panel-accent hover:text-panel-foreground"
              >
                <Layers className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-panel/95 backdrop-blur-2xl border-panel-border text-panel-foreground p-2"
            >
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-panel-foreground/40">
                Paper Grid Pattern
              </p>
              <div className="grid grid-cols-2 gap-1 mb-2">
                {PAPER_PATTERNS.map((pat) => (
                  <button
                    key={pat.id}
                    onClick={() => p.setPattern(pat.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors text-left",
                      p.pattern === pat.id
                        ? "bg-panel-accent text-panel-foreground ring-1 ring-panel-ring font-semibold"
                        : "hover:bg-panel-accent/50 text-panel-foreground/75",
                    )}
                  >
                    <span>{pat.name}</span>
                  </button>
                ))}
              </div>

              <DropdownMenuSeparator className="bg-panel-border" />
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-panel-foreground/40">
                Color Palette & Theme
              </p>
              <div className="grid grid-cols-2 gap-1">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => p.setTheme(t.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 text-xs transition-colors",
                      p.theme === t.id
                        ? "bg-panel-accent ring-1 ring-panel-ring font-medium"
                        : "hover:bg-panel-accent/50 text-panel-foreground/80",
                    )}
                  >
                    <span
                      className="h-4 w-4 rounded-md border border-panel-border shadow-xs shrink-0"
                      data-theme={t.id}
                      style={{ background: "var(--canvas-paper)" }}
                    />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Export Canvas"
                title="Export Image or Vector"
                className="grid h-9 w-9 place-items-center rounded-xl text-panel-foreground/75 transition-colors hover:bg-panel-accent hover:text-panel-foreground"
              >
                <Download className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 bg-panel/95 backdrop-blur-2xl border-panel-border text-panel-foreground"
            >
              <DropdownMenuItem onClick={() => p.onExportImage("png")} className="gap-2">
                <ImageIcon className="h-4 w-4" />
                <span>Export High-Res PNG</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => p.onExportImage("svg")} className="gap-2">
                <FileCode className="h-4 w-4" />
                <span>Export Vector SVG</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => p.onExportImage("json")} className="gap-2">
                <Download className="h-4 w-4" />
                <span>Backup Raw Notes (JSON)</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-panel-border" />
              <DropdownMenuItem
                onClick={p.onClear}
                className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                <span>Clear Canvas</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Floating Selection Bar (when items are lassoed) */}
      {p.hasSelection && (
        <div className="pointer-events-none absolute inset-x-0 top-18 z-20 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-primary/40 bg-panel/95 p-1.5 shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-top-3 duration-200">
            <span className="px-2 text-xs font-semibold text-primary">Selection:</span>

            <button
              type="button"
              onClick={p.onRecolorSelection}
              title="Apply current color/brush to selection"
              className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-panel-foreground hover:bg-panel-accent transition-colors"
            >
              <span
                className="h-3.5 w-3.5 rounded-full border border-panel-border"
                style={{ background: brushCss(p.brush) }}
              />
              <span>Recolor</span>
            </button>

            <button
              type="button"
              onClick={() => p.onThickenSelection(1.5)}
              title="Thicken stroke width"
              className="rounded-xl px-2 py-1.5 text-xs font-medium text-panel-foreground hover:bg-panel-accent transition-colors"
            >
              + Thickness
            </button>
            <button
              type="button"
              onClick={() => p.onThickenSelection(-1.5)}
              title="Reduce stroke width"
              className="rounded-xl px-2 py-1.5 text-xs font-medium text-panel-foreground hover:bg-panel-accent transition-colors"
            >
              - Thickness
            </button>

            <span className="mx-0.5 h-4 w-px bg-panel-border" />

            <button
              type="button"
              onClick={p.onDuplicateSelection}
              title="Duplicate selection"
              className="grid h-8 w-8 place-items-center rounded-xl text-panel-foreground/80 hover:bg-panel-accent hover:text-panel-foreground transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => p.onFlipSelection("h")}
              title="Flip Horizontally"
              className="grid h-8 w-8 place-items-center rounded-xl text-panel-foreground/80 hover:bg-panel-accent hover:text-panel-foreground transition-colors"
            >
              <FlipHorizontal className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => p.onFlipSelection("v")}
              title="Flip Vertically"
              className="grid h-8 w-8 place-items-center rounded-xl text-panel-foreground/80 hover:bg-panel-accent hover:text-panel-foreground transition-colors"
            >
              <FlipVertical className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => p.onRotateSelection(90)}
              title="Rotate 90° Clockwise"
              className="grid h-8 w-8 place-items-center rounded-xl text-panel-foreground/80 hover:bg-panel-accent hover:text-panel-foreground transition-colors"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>

            <span className="mx-0.5 h-4 w-px bg-panel-border" />

            <button
              type="button"
              onClick={p.onDeleteSelection}
              title="Delete selection (Backspace)"
              className="grid h-8 w-8 place-items-center rounded-xl text-destructive hover:bg-destructive/15 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={p.onDeselect}
              title="Deselect"
              className="grid h-8 w-8 place-items-center rounded-xl text-panel-foreground/60 hover:bg-panel-accent hover:text-panel-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Sub-tool / Configuration Popovers */}
      {activePanel && (
        <div className="absolute inset-x-0 bottom-24 z-30 flex justify-center px-4 sm:bottom-28">
          <div className="w-full max-w-lg rounded-3xl border border-panel-border bg-panel/95 p-5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header with Title & Close */}
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-sm font-semibold tracking-tight text-panel-foreground">
                {activePanel === "pen-menu" && "Pen & Nib Dynamics"}
                {activePanel === "eraser-menu" && "Eraser Modes & Filters"}
                {activePanel === "lasso-menu" && "Lasso Selection Tools"}
                {activePanel === "shape-menu" && "Shapes & Smart Snapping"}
                {activePanel === "palette" && "Ink Colors, Blends & Thickness"}
              </span>
              <button
                type="button"
                aria-label="Close"
                onClick={closePanel}
                className="grid h-7 w-7 place-items-center rounded-lg text-panel-foreground/50 hover:bg-panel-accent hover:text-panel-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Panel: Pen Styles */}
            {activePanel === "pen-menu" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {PEN_STYLES.map((ps) => {
                    const active = p.penStyle === ps.id;
                    const IconComp = ps.icon;
                    return (
                      <button
                        key={ps.id}
                        type="button"
                        onClick={() => {
                          p.setTool("pen");
                          p.setPenStyle(ps.id);
                          if (ps.id === "highlighter") {
                            p.setOpacity(0.4);
                            p.setSize(Math.max(p.size, 16));
                          } else if (p.opacity < 0.9) {
                            p.setOpacity(1);
                          }
                          closePanel();
                        }}
                        className={cn(
                          "flex flex-col items-start gap-1 rounded-2xl border border-panel-border p-3 text-left transition-all",
                          active
                            ? "bg-panel-accent ring-2 ring-panel-ring font-medium"
                            : "hover:bg-panel-accent/60",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <IconComp className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium text-panel-foreground">
                            {ps.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-panel-foreground/55">{ps.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Panel: Eraser Modes & Settings */}
            {activePanel === "eraser-menu" && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-panel-foreground/45">
                    Eraser Type
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        p.setTool("eraser");
                        p.setEraserMode("stroke");
                        closePanel();
                      }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-2xl border border-panel-border p-3 text-left transition-all",
                        p.eraserMode === "stroke"
                          ? "bg-panel-accent ring-2 ring-panel-ring font-medium"
                          : "hover:bg-panel-accent/60",
                      )}
                    >
                      <Eraser className="h-4 w-4 text-primary" />
                      <div>
                        <div className="text-xs font-semibold text-panel-foreground">
                          Object Eraser
                        </div>
                        <div className="text-[10px] text-panel-foreground/55">
                          Erases entire stroke on touch
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        p.setTool("eraser");
                        p.setEraserMode("precision");
                        closePanel();
                      }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-2xl border border-panel-border p-3 text-left transition-all",
                        p.eraserMode === "precision"
                          ? "bg-panel-accent ring-2 ring-panel-ring font-medium"
                          : "hover:bg-panel-accent/60",
                      )}
                    >
                      <Scissors className="h-4 w-4 text-primary" />
                      <div>
                        <div className="text-xs font-semibold text-panel-foreground">
                          Precision Slicer
                        </div>
                        <div className="text-[10px] text-panel-foreground/55">
                          Pixel slicing & segment cut
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-panel-foreground/45">
                    <span>Eraser Radius</span>
                    <span className="tabular-nums font-mono">{Math.round(p.eraserSize)}px</span>
                  </div>
                  <input
                    type="range"
                    min={6}
                    max={60}
                    step={2}
                    value={p.eraserSize}
                    onChange={(e) => p.setEraserSize(Number(e.target.value))}
                    className="ink-range w-full"
                  />
                  <div className="flex justify-between mt-2 gap-2">
                    {[8, 16, 28, 48].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => p.setEraserSize(s)}
                        className={cn(
                          "flex-1 py-1 rounded-lg text-xs font-medium border border-panel-border transition-colors",
                          Math.round(p.eraserSize) === s
                            ? "bg-panel-accent ring-1 ring-panel-ring"
                            : "hover:bg-panel-accent/50 text-panel-foreground/75",
                        )}
                      >
                        {s}px
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-panel-foreground/45">
                    Eraser Target Filter
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: "all", label: "Erase Everything" },
                        { id: "pen-only", label: "Pen Ink Only" },
                        { id: "highlighter-only", label: "Highlighters Only" },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => p.setEraserFilter(f.id)}
                        className={cn(
                          "rounded-xl border border-panel-border p-2 text-center text-xs transition-colors",
                          p.eraserFilter === f.id
                            ? "bg-panel-accent ring-2 ring-panel-ring font-medium"
                            : "hover:bg-panel-accent/50 text-panel-foreground/70",
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Panel: Lasso Modes */}
            {activePanel === "lasso-menu" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      p.setTool("lasso");
                      p.setLassoMode("freehand");
                      closePanel();
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border border-panel-border p-3 text-left transition-all",
                      p.lassoMode === "freehand"
                        ? "bg-panel-accent ring-2 ring-panel-ring font-medium"
                        : "hover:bg-panel-accent/60",
                    )}
                  >
                    <Lasso className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-panel-foreground">
                        Freehand Loop
                      </div>
                      <div className="text-[10px] text-panel-foreground/55">
                        Draw freeform boundary
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      p.setTool("lasso");
                      p.setLassoMode("rect");
                      closePanel();
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border border-panel-border p-3 text-left transition-all",
                      p.lassoMode === "rect"
                        ? "bg-panel-accent ring-2 ring-panel-ring font-medium"
                        : "hover:bg-panel-accent/60",
                    )}
                  >
                    <Square className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-panel-foreground">
                        Rectangle Marquee
                      </div>
                      <div className="text-[10px] text-panel-foreground/55">Drag selection box</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Panel: Shapes */}
            {activePanel === "shape-menu" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SHAPE_ITEMS.map((si) => {
                    const active = p.tool === "shape" && p.shapeType === si.id;
                    const IconComp = si.icon;
                    return (
                      <button
                        key={si.id}
                        type="button"
                        onClick={() => {
                          p.setTool("shape");
                          p.setShapeType(si.id);
                          closePanel();
                        }}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-2xl border border-panel-border p-3 text-center transition-all",
                          active
                            ? "bg-panel-accent ring-2 ring-panel-ring font-medium"
                            : "hover:bg-panel-accent/60",
                        )}
                      >
                        <IconComp className="h-5 w-5 text-primary" />
                        <span className="text-xs font-medium text-panel-foreground">
                          {si.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-panel-accent/60 p-3 border border-panel-border">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-xs font-semibold text-panel-foreground">
                        Auto-Snap Shapes
                      </div>
                      <div className="text-[10px] text-panel-foreground/55">
                        Auto straightens lines & loops while drawing
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => p.setAutoSnapShape(!p.autoSnapShape)}
                    className={cn(
                      "h-6 w-11 rounded-full transition-colors relative p-0.5",
                      p.autoSnapShape ? "bg-primary" : "bg-panel-border",
                    )}
                  >
                    <span
                      className={cn(
                        "block h-5 w-5 rounded-full bg-white transition-transform",
                        p.autoSnapShape ? "translate-x-5" : "translate-x-0",
                      )}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Panel: Palette & Thickness */}
            {activePanel === "palette" && (
              <div className="space-y-4">
                {/* Solid Swatches */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-panel-foreground/45">
                    Solid Colors
                  </p>
                  <div className="grid grid-cols-8 gap-1.5">
                    {SOLID_COLORS.map((c) => {
                      const active = p.brush.kind === "solid" && p.brush.color === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Color ${c}`}
                          onClick={() => p.setBrush({ kind: "solid", color: c })}
                          className={cn(
                            "h-7 rounded-lg border border-panel-border transition-transform hover:scale-110",
                            active &&
                              "ring-2 ring-panel-ring ring-offset-2 ring-offset-panel scale-105",
                          )}
                          style={{ background: c }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Highlighter Swatches */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-panel-foreground/45">
                    Highlighter Inks
                  </p>
                  <div className="grid grid-cols-6 gap-2">
                    {HIGHLIGHTER_COLORS.map((c) => {
                      const active = p.brush.kind === "solid" && p.brush.color === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            p.setBrush({ kind: "solid", color: c });
                            p.setPenStyle("highlighter");
                            p.setOpacity(0.4);
                          }}
                          className={cn(
                            "h-7 rounded-lg border border-panel-border transition-transform hover:scale-105",
                            active && "ring-2 ring-panel-ring ring-offset-2 ring-offset-panel",
                          )}
                          style={{ background: c }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Gradient Inks */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-panel-foreground/45">
                    Dual-Tone Gradients
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {GRADIENTS.map((g) => {
                      const active =
                        p.brush.kind === "gradient" &&
                        p.brush.from === g.from &&
                        p.brush.to === g.to;
                      return (
                        <button
                          key={g.name}
                          type="button"
                          title={g.name}
                          onClick={() => p.setBrush({ kind: "gradient", from: g.from, to: g.to })}
                          className={cn(
                            "flex items-center justify-center h-8 rounded-xl border border-panel-border text-[10px] font-medium text-white transition-transform hover:scale-105 shadow-xs",
                            active &&
                              "ring-2 ring-panel-ring ring-offset-2 ring-offset-panel scale-102 font-bold",
                          )}
                          style={{ background: brushCss({ kind: "gradient", ...g }) }}
                        >
                          {g.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Gradient Builder */}
                <div className="rounded-2xl bg-panel-accent/60 p-3 border border-panel-border">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-panel-foreground/45">
                    Custom Gradient Creator
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Gradient start"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded-lg border border-panel-border bg-transparent p-0"
                    />
                    <div
                      className="h-8 flex-1 rounded-lg border border-panel-border"
                      style={{ background: `linear-gradient(90deg, ${customFrom}, ${customTo})` }}
                    />
                    <input
                      type="color"
                      aria-label="Gradient end"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded-lg border border-panel-border bg-transparent p-0"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        p.setBrush({ kind: "gradient", from: customFrom, to: customTo })
                      }
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* Thickness Controls */}
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-panel-foreground/45">
                    <span>Stroke Thickness</span>
                    <span className="tabular-nums font-mono">{p.size.toFixed(1)}px</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={40}
                    step={0.5}
                    value={p.size}
                    aria-label="Stroke thickness"
                    onChange={(e) => p.setSize(Number(e.target.value))}
                    className="ink-range w-full"
                  />
                  <div className="flex justify-between mt-2 gap-1.5">
                    {QUICK_SIZES.map((qs) => (
                      <button
                        key={qs}
                        type="button"
                        onClick={() => p.setSize(qs)}
                        className={cn(
                          "flex-1 py-1 rounded-lg text-xs font-medium border border-panel-border transition-colors",
                          Math.abs(p.size - qs) < 0.5
                            ? "bg-panel-accent ring-1 ring-panel-ring font-bold"
                            : "hover:bg-panel-accent/50 text-panel-foreground/75",
                        )}
                      >
                        {qs}px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity Control */}
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-panel-foreground/45">
                    <span>Ink Opacity / Alpha</span>
                    <span className="tabular-nums font-mono">{Math.round(p.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={p.opacity}
                    aria-label="Ink opacity"
                    onChange={(e) => p.setOpacity(Number(e.target.value))}
                    className="ink-range w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Ergonomic Floating Bottom Tool Dock */}
      <nav
        aria-label="Drawing tools"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 sm:p-5"
      >
        <div className="pointer-events-auto flex items-center gap-1 rounded-3xl border border-panel-border bg-panel/90 p-1.5 shadow-2xl backdrop-blur-2xl">
          {/* Pen Group Button */}
          <div className="relative flex items-center">
            <button
              type="button"
              aria-label="Pen tool"
              title={`Pen Tool (${p.penStyle})`}
              onClick={() => {
                p.setTool("pen");
                if (activePanel === "pen-menu") closePanel();
              }}
              onDoubleClick={() => setActivePanel(activePanel === "pen-menu" ? null : "pen-menu")}
              className={cn(
                "flex h-11 items-center gap-1.5 rounded-2xl px-3 transition-all",
                p.tool === "pen"
                  ? "bg-primary text-primary-foreground font-medium shadow-md scale-102"
                  : "text-panel-foreground/75 hover:bg-panel-accent hover:text-panel-foreground",
              )}
            >
              {p.penStyle === "highlighter" ? (
                <Highlighter className="h-[18px] w-[18px]" />
              ) : p.penStyle === "calligraphy" || p.penStyle === "brush" ? (
                <BrushIcon className="h-[18px] w-[18px]" />
              ) : (
                <Pen className="h-[18px] w-[18px]" />
              )}
              <span className="hidden sm:inline text-xs font-semibold capitalize">
                {p.penStyle}
              </span>
            </button>
            <button
              type="button"
              aria-label="Pen options"
              onClick={() => setActivePanel(activePanel === "pen-menu" ? null : "pen-menu")}
              className={cn(
                "grid h-11 w-6 place-items-center rounded-r-2xl text-panel-foreground/60 hover:text-panel-foreground transition-colors",
                activePanel === "pen-menu" && "text-primary",
              )}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          {/* Eraser Group Button */}
          <div className="relative flex items-center">
            <button
              type="button"
              aria-label="Eraser tool"
              title={`Eraser Tool (${p.eraserMode})`}
              onClick={() => {
                p.setTool("eraser");
                if (activePanel === "eraser-menu") closePanel();
              }}
              onDoubleClick={() =>
                setActivePanel(activePanel === "eraser-menu" ? null : "eraser-menu")
              }
              className={cn(
                "flex h-11 items-center gap-1.5 rounded-2xl px-3 transition-all",
                p.tool === "eraser"
                  ? "bg-primary text-primary-foreground font-medium shadow-md scale-102"
                  : "text-panel-foreground/75 hover:bg-panel-accent hover:text-panel-foreground",
              )}
            >
              {p.eraserMode === "precision" ? (
                <Scissors className="h-[18px] w-[18px]" />
              ) : (
                <Eraser className="h-[18px] w-[18px]" />
              )}
              <span className="hidden sm:inline text-xs font-semibold capitalize">
                {p.eraserMode}
              </span>
            </button>
            <button
              type="button"
              aria-label="Eraser options"
              onClick={() => setActivePanel(activePanel === "eraser-menu" ? null : "eraser-menu")}
              className={cn(
                "grid h-11 w-6 place-items-center rounded-r-2xl text-panel-foreground/60 hover:text-panel-foreground transition-colors",
                activePanel === "eraser-menu" && "text-primary",
              )}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          {/* Lasso Group Button */}
          <div className="relative flex items-center">
            <button
              type="button"
              aria-label="Lasso tool"
              title={`Lasso Tool (${p.lassoMode})`}
              onClick={() => {
                p.setTool("lasso");
                if (activePanel === "lasso-menu") closePanel();
              }}
              onDoubleClick={() =>
                setActivePanel(activePanel === "lasso-menu" ? null : "lasso-menu")
              }
              className={cn(
                "flex h-11 items-center gap-1.5 rounded-2xl px-3 transition-all",
                p.tool === "lasso"
                  ? "bg-primary text-primary-foreground font-medium shadow-md scale-102"
                  : "text-panel-foreground/75 hover:bg-panel-accent hover:text-panel-foreground",
              )}
            >
              <Lasso className="h-[18px] w-[18px]" />
              <span className="hidden sm:inline text-xs font-semibold capitalize">Lasso</span>
            </button>
            <button
              type="button"
              aria-label="Lasso options"
              onClick={() => setActivePanel(activePanel === "lasso-menu" ? null : "lasso-menu")}
              className={cn(
                "grid h-11 w-6 place-items-center rounded-r-2xl text-panel-foreground/60 hover:text-panel-foreground transition-colors",
                activePanel === "lasso-menu" && "text-primary",
              )}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          {/* Shapes Group Button */}
          <div className="relative flex items-center">
            <button
              type="button"
              aria-label="Shape tool"
              title={`Shape Tool (${p.shapeType})`}
              onClick={() => {
                p.setTool("shape");
                if (activePanel === "shape-menu") closePanel();
              }}
              onDoubleClick={() =>
                setActivePanel(activePanel === "shape-menu" ? null : "shape-menu")
              }
              className={cn(
                "flex h-11 items-center gap-1.5 rounded-2xl px-3 transition-all",
                p.tool === "shape"
                  ? "bg-primary text-primary-foreground font-medium shadow-md scale-102"
                  : "text-panel-foreground/75 hover:bg-panel-accent hover:text-panel-foreground",
              )}
            >
              <Shapes className="h-[18px] w-[18px]" />
              <span className="hidden sm:inline text-xs font-semibold capitalize">Shapes</span>
            </button>
            <button
              type="button"
              aria-label="Shape options"
              onClick={() => setActivePanel(activePanel === "shape-menu" ? null : "shape-menu")}
              className={cn(
                "grid h-11 w-6 place-items-center rounded-r-2xl text-panel-foreground/60 hover:text-panel-foreground transition-colors",
                activePanel === "shape-menu" && "text-primary",
              )}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>

          {/* Hand / Pan Tool Button */}
          <button
            type="button"
            aria-label="Pan tool"
            title="Pan / Navigate Canvas (H or Shift+Drag)"
            onClick={() => {
              p.setTool("hand");
              closePanel();
            }}
            className={cn(
              "grid h-11 w-11 place-items-center rounded-2xl text-panel-foreground/75 transition-all",
              p.tool === "hand"
                ? "bg-primary text-primary-foreground shadow-md scale-102"
                : "hover:bg-panel-accent hover:text-panel-foreground",
            )}
          >
            <Hand className="h-[18px] w-[18px]" />
          </button>

          <span className="mx-1 h-6 w-px bg-panel-border" />

          {/* Quick Nib Preview / Master Palette Trigger */}
          <button
            type="button"
            aria-label="Ink colors and palette"
            title="Ink & Palette Settings"
            onClick={() => setActivePanel(activePanel === "palette" ? null : "palette")}
            className={cn(
              "flex h-11 items-center gap-2 rounded-2xl border border-panel-border/60 px-3 transition-all hover:bg-panel-accent",
              activePanel === "palette" && "bg-panel-accent ring-2 ring-panel-ring",
            )}
          >
            <span
              className="h-5 w-5 rounded-full border border-panel-border shadow-xs shrink-0"
              style={{
                background: brushCss(p.brush),
                opacity: p.opacity,
              }}
            />
            <span
              className="rounded-full bg-panel-foreground/80 transition-all shrink-0"
              style={{
                height: Math.max(3, Math.min(p.size, 16)),
                width: Math.max(3, Math.min(p.size, 16)),
              }}
            />
            <Palette className="h-4 w-4 text-panel-foreground/70" />
          </button>
        </div>
      </nav>
    </>
  );
}
