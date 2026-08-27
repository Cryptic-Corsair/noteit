import {
  X,
  Command,
  Sparkles,
  Pen,
  Eraser,
  Lasso,
  Move,
  Copy,
  RotateCw,
  ZoomIn,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
};

interface ShortcutGroup {
  category: string;
  icon: typeof Pen;
  items: { key: string; label: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: "Drawing & Tools",
    icon: Pen,
    items: [
      { key: "P", label: "Studio Pen" },
      { key: "E", label: "Eraser" },
      { key: "L", label: "Lasso Selection" },
      { key: "S", label: "Shapes Tool" },
      { key: "H", label: "Hand / Pan" },
      { key: "Space + Drag", label: "Quick Pan" },
      { key: "[ / ]", label: "Decrease / Increase Size" },
    ],
  },
  {
    category: "Selection & Edit",
    icon: Copy,
    items: [
      { key: "⌘ Z / Ctrl+Z", label: "Undo Stroke" },
      { key: "⌘ ⇧ Z / Ctrl+Y", label: "Redo Stroke" },
      { key: "⌘ A", label: "Select All Strokes" },
      { key: "⌘ C", label: "Copy Selection" },
      { key: "⌘ X", label: "Cut Selection" },
      { key: "⌘ V", label: "Paste at Offset" },
      { key: "⌘ D", label: "Duplicate Selection" },
      { key: "Del / Backspace", label: "Delete Selection" },
      { key: "Esc", label: "Deselect" },
    ],
  },
  {
    category: "Canvas & Navigation",
    icon: ZoomIn,
    items: [
      { key: "Scroll / Trackpad", label: "Pan Infinite Canvas" },
      { key: "⌘ + Scroll / Pinch", label: "Smooth Zoom In / Out" },
      { key: "F", label: "Fit All Content in View" },
      { key: "⌘ 0", label: "Reset View to 100%" },
      { key: "2-Finger Drag", label: "Pinch & Pan on Touchscreen" },
      { key: "? / /", label: "Toggle Shortcuts Guide" },
    ],
  },
];

export function ShortcutsModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div
        className="w-full max-w-xl rounded-3xl border border-panel-border bg-panel/95 p-6 shadow-2xl backdrop-blur-2xl text-panel-foreground animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-panel-border">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Command className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-panel-foreground leading-tight">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-panel-foreground/60">
                Speed up your sketch and notebook workflow
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts dialog"
            className="grid h-8 w-8 place-items-center rounded-xl text-panel-foreground/60 hover:bg-panel-accent hover:text-panel-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {SHORTCUT_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.category} className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-panel-foreground/45">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  <span>{group.category}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-panel-border/60 bg-panel-accent/40 px-3 py-2 text-xs"
                    >
                      <span className="text-panel-foreground/80 font-medium truncate">
                        {item.label}
                      </span>
                      <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-panel-border bg-panel px-1.5 font-mono text-[11px] font-semibold text-panel-foreground/90 shadow-2xs">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="mt-5 pt-4 border-t border-panel-border flex items-center justify-between text-xs text-panel-foreground/50">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Pro tip: Double click any tool button to open its sub-menu.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
