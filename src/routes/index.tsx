import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Star,
  Copy,
  Trash2,
  PenLine,
  Sparkles,
  LayoutGrid,
  List,
  Download,
  Upload,
  ArrowUpDown,
  FileText,
  Clock,
  Pencil,
  Check,
  X,
  Layers,
  Palette,
  ChevronDown,
  Eraser,
  SlidersHorizontal,
  Flame,
} from "lucide-react";
import {
  createNote,
  deleteNote,
  duplicateNote,
  listNotes,
  getStrokes,
  subscribeNotes,
  updateNote,
  batchDeleteNotes,
  batchFavoriteNotes,
  exportNoteAsJson,
  importNoteFromJson,
  type NoteMeta,
} from "@/lib/notes";
import { NoteThumb } from "@/components/ink/NoteThumb";
import {
  THEMES,
  PAPER_PATTERNS,
  type ThemeId,
  type PaperPatternId,
  SOLID_COLORS,
  GRADIENTS,
} from "@/components/ink/palette";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NOTE_IT — Handwritten Notes on an Infinite Canvas" },
      {
        name: "description",
        content:
          "NOTE_IT is a fast handwriting studio: infinite canvas, pressure pen, precision eraser, lasso, rich colors, and custom paper textures. Your notebook, all in one place.",
      },
      { property: "og:title", content: "NOTE_IT — Handwritten Notes on an Infinite Canvas" },
      {
        property: "og:description",
        content:
          "Create notebooks, sketch with pressure-aware ink, and organize everything on an infinite canvas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const formatTimeAgo = (t: number) => {
  const d = Date.now() - t;
  const m = Math.floor(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

type ViewMode = "grid" | "list";
type SortOption = "updated" | "created" | "title" | "strokes";
type FilterTab = "all" | "favorites" | "recent" | ThemeId;

const QUICK_TEMPLATES: {
  title: string;
  desc: string;
  theme: ThemeId;
  pattern: PaperPatternId;
  badge: string;
  iconBg: string;
}[] = [
  {
    title: "Blank Canvas",
    desc: "Infinite freehand sketch",
    theme: "graphite",
    pattern: "blank",
    badge: "Plain",
    iconBg: "bg-zinc-800 text-zinc-100",
  },
  {
    title: "Ruled Journal",
    desc: "Lined paper with margin",
    theme: "paper",
    pattern: "ruled",
    badge: "Lined",
    iconBg: "bg-amber-800/80 text-amber-100",
  },
  {
    title: "Dot Grid Planner",
    desc: "Matrix for UI & diagrams",
    theme: "graphite",
    pattern: "dots",
    badge: "Dot Matrix",
    iconBg: "bg-indigo-900/80 text-indigo-200",
  },
  {
    title: "Blueprint Draft",
    desc: "Architectural square grid",
    theme: "blueprint",
    pattern: "graph",
    badge: "Square Grid",
    iconBg: "bg-blue-900/80 text-blue-200",
  },
  {
    title: "Botanical Sage",
    desc: "Calm green paper journal",
    theme: "sage",
    pattern: "ruled",
    badge: "Sage",
    iconBg: "bg-emerald-900/80 text-emerald-200",
  },
  {
    title: "Midnight Matrix",
    desc: "Deep sapphire dark mode",
    theme: "midnight",
    pattern: "dots",
    badge: "Night",
    iconBg: "bg-purple-950 text-purple-200",
  },
];

function Home() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NoteMeta[] | null>(null);
  const [q, setQ] = useState("");
  const [activeTheme, setActiveTheme] = useState<ThemeId>("graphite");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showScratchpad, setShowScratchpad] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setNotes(listNotes()), []);

  useEffect(() => {
    refresh();
    return subscribeNotes(refresh);
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset["theme"] = activeTheme;
  }, [activeTheme]);

  const handleCreateNote = useCallback(
    (title = "Untitled note", theme: ThemeId = activeTheme, pattern: PaperPatternId = "dots") => {
      const n = createNote(title, theme, pattern);
      navigate({ to: "/note/$id", params: { id: n.id } });
    },
    [activeTheme, navigate],
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          setEditingNoteId(null);
          setDeleteConfirmId(null);
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleCreateNote();
      } else if (e.key === "Escape") {
        setSelectedIds(new Set());
        setDeleteConfirmId(null);
        setIsTemplateMenuOpen(false);
        setIsThemeMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCreateNote]);

  // Total workspace stats
  const stats = useMemo(() => {
    if (!notes) return { count: 0, favorites: 0, totalStrokes: 0, latestNote: null };
    const count = notes.length;
    const favorites = notes.filter((n) => n.favorite).length;
    const totalStrokes = notes.reduce((acc, n) => acc + (n.strokeCount || 0), 0);
    const latestNote = notes.length > 0 ? notes[0] : null;
    return { count, favorites, totalStrokes, latestNote };
  }, [notes]);

  // Filter & Sort Logic
  const filtered = useMemo(() => {
    if (!notes) return [];
    let list = [...notes];

    // Filter Tab
    if (activeTab === "favorites") {
      list = list.filter((n) => n.favorite);
    } else if (activeTab === "recent") {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      list = list.filter((n) => n.updatedAt >= oneWeekAgo);
    } else if (activeTab !== "all") {
      list = list.filter((n) => n.theme === activeTab);
    }

    // Search Query
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter((n) => (n.title || "Untitled note").toLowerCase().includes(s));
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "updated") return b.updatedAt - a.updatedAt;
      if (sortBy === "created") return b.createdAt - a.createdAt;
      if (sortBy === "title") return (a.title || "").localeCompare(b.title || "");
      if (sortBy === "strokes") return (b.strokeCount || 0) - (a.strokeCount || 0);
      return 0;
    });

    return list;
  }, [notes, activeTab, q, sortBy]);

  const handleSelectNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((n) => n.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} selected note(s)?`)) {
      batchDeleteNotes(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleBatchFavorite = (fav: boolean) => {
    if (selectedIds.size === 0) return;
    batchFavoriteNotes(Array.from(selectedIds), fav);
    setSelectedIds(new Set());
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        const imported = importNoteFromJson(text);
        if (imported) {
          navigate({ to: "/note/$id", params: { id: imported.id } });
        } else {
          alert("Invalid note format. Please select a valid .inkwell.json file.");
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleStartRename = (n: NoteMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingNoteId(n.id);
    setEditTitleValue(n.title || "Untitled note");
  };

  const handleSaveRename = (id: string) => {
    if (editTitleValue.trim()) {
      updateNote(id, { title: editTitleValue.trim() }, false);
    }
    setEditingNoteId(null);
  };

  return (
    <div className="min-h-dvh bg-background text-foreground transition-colors duration-200">
      {/* Hidden file upload input for importing notes */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        accept=".json,.inkwell.json"
        className="hidden"
      />

      {/* ================= STICKY APP BAR ================= */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl transition-colors">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Brand & Workspace Name */}
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="group flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
                <PenLine className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-lg font-semibold tracking-tight">NOTE_IT</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Studio
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">Infinite handwritten notes</p>
              </div>
            </Link>
          </div>

          {/* Center Search Input */}
          <div className="hidden max-w-md flex-1 px-4 md:block">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search notes by title... (Press / to search)"
                aria-label="Search notes"
                className="h-10 w-full rounded-2xl border border-border/80 bg-card/60 pl-10 pr-20 text-sm outline-none transition-all placeholder:text-muted-foreground/60 focus:border-ring focus:bg-card focus:ring-1 focus:ring-ring"
              />
              <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {q ? (
                  <button
                    onClick={() => setQ("")}
                    className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                    /
                  </kbd>
                )}
              </div>
            </label>
          </div>

          {/* Actions & New Note Menu */}
          <div className="flex items-center gap-2">
            {/* Theme Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="flex h-10 items-center gap-2 rounded-xl border border-border/80 bg-card/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent focus:outline-none"
                title="Change theme palette"
              >
                <div
                  className="h-4 w-4 rounded-full border border-border/60 shadow-inner"
                  style={{ background: "var(--canvas-accent)" }}
                />
                <span className="hidden sm:inline">
                  {THEMES.find((t) => t.id === activeTheme)?.name || "Graphite"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {isThemeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsThemeMenuOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-border bg-card p-2 shadow-xl animate-in fade-in zoom-in-95">
                    <div className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Canvas & Workspace Theme
                    </div>
                    {THEMES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setActiveTheme(t.id);
                          setIsThemeMenuOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors",
                          activeTheme === t.id
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-foreground hover:bg-accent",
                        )}
                      >
                        <div
                          data-theme={t.id}
                          className="h-4 w-4 shrink-0 rounded-full border border-border"
                          style={{ background: "var(--canvas-paper)" }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{t.name}</p>
                          <p
                            className={cn(
                              "truncate text-[10px]",
                              activeTheme === t.id
                                ? "text-primary-foreground/80"
                                : "text-muted-foreground",
                            )}
                          >
                            {t.desc}
                          </p>
                        </div>
                        {activeTheme === t.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Import Note Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="hidden h-10 items-center gap-1.5 rounded-xl border border-border/80 bg-card/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent sm:flex"
              title="Import note from JSON file"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import</span>
            </button>

            {/* Quick Scratchpad Toggle */}
            <button
              onClick={() => setShowScratchpad(!showScratchpad)}
              className={cn(
                "hidden h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors md:flex",
                showScratchpad
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/80 bg-card/60 text-foreground hover:bg-accent",
              )}
              title="Toggle interactive pen tester"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Scratchpad</span>
            </button>

            {/* New Note Button with Template Dropdown */}
            <div className="relative">
              <div className="flex items-center">
                <button
                  onClick={() => handleCreateNote()}
                  className="inline-flex h-10 items-center gap-2 rounded-l-xl bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  <span>New note</span>
                </button>
                <button
                  onClick={() => setIsTemplateMenuOpen(!isTemplateMenuOpen)}
                  aria-label="More templates"
                  className="grid h-10 w-8 place-items-center rounded-r-xl border-l border-primary-foreground/20 bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {isTemplateMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsTemplateMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-border bg-card p-2 shadow-2xl animate-in fade-in zoom-in-95">
                    <div className="px-2.5 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Start from Template
                    </div>
                    <div className="space-y-1">
                      {QUICK_TEMPLATES.map((tmpl, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setIsTemplateMenuOpen(false);
                            handleCreateNote(tmpl.title, tmpl.theme, tmpl.pattern);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl p-2 text-left text-xs transition-colors hover:bg-accent"
                        >
                          <span
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold",
                              tmpl.iconBg,
                            )}
                          >
                            <FileText className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-semibold text-foreground">{tmpl.title}</p>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                                {tmpl.badge}
                              </span>
                            </div>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {tmpl.desc}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT CONTAINER ================= */}
      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6">
        {/* Mobile Search Field */}
        <div className="mb-6 block md:hidden">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notes..."
              aria-label="Search notes"
              className="h-10 w-full rounded-2xl border border-border bg-card pl-10 pr-9 text-sm outline-none focus:border-ring"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
        </div>

        {/* ================= INTERACTIVE PEN SCRATCHPAD (OPTIONAL COLLAPSIBLE) ================= */}
        {showScratchpad && (
          <section className="mb-8 overflow-hidden rounded-3xl border border-primary/30 bg-card p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-display text-sm font-semibold tracking-tight">
                    Quick Pen Scratchpad
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Try drawing strokes, test pressure and ink feel right here
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScratchpad(false)}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <MiniScratchpad theme={activeTheme} />
          </section>
        )}

        {/* ================= STUDIO HERO & QUICK STARTERS ================= */}
        <section className="mb-8 rounded-3xl border border-border/80 bg-card p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            {/* Headline and Description */}
            <div className="max-w-2xl">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  <Flame className="h-3 w-3" /> Infinite Vector Canvas
                </span>
                <span className="text-xs text-muted-foreground">
                  Sub-pixel smoothing & pressure pen
                </span>
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                Express thoughts with natural digital ink.
              </h2>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                Pressure-aware vector pens, precision eraser, freehand lasso, custom gradients, and
                textured paper grids. Everything stays saved on your device.
              </p>
            </div>

            {/* Quick Stats Pill Badges */}
            <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border/60 bg-background/50 p-3 sm:gap-4 sm:p-4">
              <div className="text-center sm:text-left">
                <p className="text-[11px] font-medium text-muted-foreground">Notes</p>
                <p className="font-display text-lg font-bold sm:text-xl">{stats.count}</p>
              </div>
              <div className="border-x border-border/60 px-3 text-center sm:px-4 sm:text-left">
                <p className="text-[11px] font-medium text-muted-foreground">Starred</p>
                <p className="font-display text-lg font-bold sm:text-xl">{stats.favorites}</p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[11px] font-medium text-muted-foreground">Strokes</p>
                <p className="font-display text-lg font-bold sm:text-xl">
                  {stats.totalStrokes.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Starter Presets Bar */}
          <div className="mt-6 border-t border-border/60 pt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Start Canvas
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {QUICK_TEMPLATES.map((tmpl, i) => (
                <button
                  key={i}
                  onClick={() => handleCreateNote(tmpl.title, tmpl.theme, tmpl.pattern)}
                  className="group relative flex flex-col items-start rounded-2xl border border-border/70 bg-background/60 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary hover:bg-card hover:shadow-sm"
                >
                  <div
                    className={cn(
                      "mb-2.5 grid h-8 w-8 place-items-center rounded-xl transition-transform group-hover:scale-110",
                      tmpl.iconBg,
                    )}
                  >
                    <Plus className="h-4 w-4" />
                  </div>
                  <span className="truncate font-display text-xs font-semibold text-foreground">
                    {tmpl.title}
                  </span>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">{tmpl.badge}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ================= FILTER, SORT & VIEW CONTROLS ================= */}
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-center">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === "all"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              All Notes {notes && `(${notes.length})`}
            </button>
            <button
              onClick={() => setActiveTab("favorites")}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === "favorites"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Star className="h-3 w-3 fill-current" />
              <span>Starred</span>
              {stats.favorites > 0 && <span>({stats.favorites})</span>}
            </button>
            <button
              onClick={() => setActiveTab("recent")}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === "recent"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Clock className="h-3 w-3" />
              <span>Recent</span>
            </button>
          </div>

          {/* Secondary Actions: Sort, Batch Actions, View Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Batch Actions Bar (when notes selected) */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1 rounded-xl bg-accent px-2 py-1 text-xs text-foreground">
                <span className="font-semibold">{selectedIds.size}</span> selected
                <button
                  onClick={() => handleBatchFavorite(true)}
                  className="ml-1.5 grid h-7 w-7 place-items-center rounded-lg hover:bg-background text-muted-foreground hover:text-foreground"
                  title="Star selected"
                >
                  <Star className="h-3.5 w-3.5 fill-current text-primary" />
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="grid h-7 w-7 place-items-center rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  title="Delete selected"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="grid h-7 w-7 place-items-center rounded-lg hover:bg-background text-muted-foreground hover:text-foreground"
                  title="Cancel selection"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-card/60 px-2.5 py-1 text-xs">
              <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort notes"
                className="bg-transparent font-medium text-foreground outline-none cursor-pointer"
              >
                <option value="updated">Recently Edited</option>
                <option value="created">Date Created</option>
                <option value="title">Alphabetical (A-Z)</option>
                <option value="strokes">Stroke Count</option>
              </select>
            </div>

            {/* View Mode Toggle (Grid vs List) */}
            <div className="flex items-center rounded-xl border border-border/80 bg-card/60 p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-lg transition-colors",
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Grid view"
                aria-label="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-lg transition-colors",
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="List view"
                aria-label="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ================= NOTES LIST / GRID ================= */}
        {notes === null ? (
          /* Loading Skeleton */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-3xl border border-border bg-card"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <PenLine className="h-7 w-7" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {q ? "No matching notebooks found" : "Your canvas is clean and ready"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {q
                ? `No notes matched "${q}". Try another keyword or clear the search filter.`
                : "Create your first notebook to begin drawing, journaling, and ideating freely."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {q ? (
                <button
                  onClick={() => setQ("")}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-accent"
                >
                  Clear search
                </button>
              ) : (
                <button
                  onClick={() => handleCreateNote()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Create new note
                </button>
              )}
            </div>
          </div>
        ) : viewMode === "grid" ? (
          /* ================= GRID VIEW ================= */
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((n) => {
              const isSelected = selectedIds.has(n.id);
              const isEditing = editingNoteId === n.id;

              return (
                <li
                  key={n.id}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
                    isSelected
                      ? "border-primary ring-2 ring-primary bg-card"
                      : "border-border/80 bg-card hover:border-primary/50",
                  )}
                >
                  {/* Selection Checkbox (Appears on Hover or When Selected) */}
                  <button
                    onClick={(e) => handleSelectNote(n.id, e)}
                    className={cn(
                      "absolute left-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-lg border backdrop-blur-md transition-opacity",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground opacity-100"
                        : "border-border/60 bg-background/80 text-transparent opacity-0 group-hover:opacity-100 hover:border-primary",
                    )}
                    title="Select note"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>

                  {/* Favorite Quick Button */}
                  <button
                    aria-label={n.favorite ? "Unstar note" : "Star note"}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      updateNote(n.id, { favorite: !n.favorite }, false);
                    }}
                    className={cn(
                      "absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center rounded-xl backdrop-blur-md transition-all",
                      n.favorite
                        ? "bg-background/85 text-amber-500 shadow-sm opacity-100"
                        : "bg-background/70 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground",
                    )}
                  >
                    <Star className={cn("h-4 w-4", n.favorite && "fill-current")} />
                  </button>

                  {/* Paper Card Preview */}
                  <Link
                    to="/note/$id"
                    params={{ id: n.id }}
                    className="relative block aspect-[16/10] w-full overflow-hidden border-b border-border/70 bg-muted/20"
                  >
                    {n.strokeCount > 0 ? (
                      <NoteThumb strokes={getStrokes(n.id)} theme={n.theme} pattern={n.pattern} />
                    ) : (
                      <div
                        data-theme={n.theme}
                        className="grid h-full w-full place-items-center text-xs text-muted-foreground"
                        style={{ background: "var(--canvas-paper)" }}
                      >
                        <div className="text-center">
                          <PenLine className="mx-auto mb-1 h-5 w-5 opacity-40" />
                          <span>Empty canvas</span>
                        </div>
                      </div>
                    )}
                  </Link>

                  {/* Note Information & Actions Footer */}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editTitleValue}
                            onChange={(e) => setEditTitleValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveRename(n.id);
                              if (e.key === "Escape") setEditingNoteId(null);
                            }}
                            autoFocus
                            className="h-8 flex-1 rounded-lg border border-primary bg-background px-2 text-sm font-semibold outline-none"
                          />
                          <button
                            onClick={() => handleSaveRename(n.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            to="/note/$id"
                            params={{ id: n.id }}
                            className="min-w-0 flex-1 hover:text-primary transition-colors"
                          >
                            <h4 className="truncate font-display text-sm font-bold tracking-tight text-foreground">
                              {n.title || "Untitled note"}
                            </h4>
                          </Link>
                          <button
                            onClick={(e) => handleStartRename(n, e)}
                            className="grid h-6 w-6 place-items-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground"
                            title="Rename"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(n.updatedAt)}
                        </span>
                        <span>•</span>
                        <span>{n.strokeCount} strokes</span>
                        <span>•</span>
                        <span className="capitalize">{n.theme}</span>
                      </div>
                    </div>

                    {/* Bottom Action Icons */}
                    <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3">
                      <Link
                        to="/note/$id"
                        params={{ id: n.id }}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Open canvas →
                      </Link>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => exportNoteAsJson(n.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Export note to JSON"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => duplicateNote(n.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Duplicate note"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${n.title || "Untitled note"}"?`)) {
                              deleteNote(n.id);
                            }
                          }}
                          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                          title="Delete note"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          /* ================= LIST VIEW ================= */
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="grid grid-cols-12 items-center border-b border-border/80 bg-muted/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="col-span-1 flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="grid h-4 w-4 place-items-center rounded border border-border"
                >
                  {selectedIds.size === filtered.length && filtered.length > 0 && (
                    <Check className="h-3 w-3" />
                  )}
                </button>
              </div>
              <div className="col-span-5">Notebook Title</div>
              <div className="col-span-2">Theme & Pattern</div>
              <div className="col-span-2">Last Edited</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <ul className="divide-y divide-border/60">
              {filtered.map((n) => {
                const isSelected = selectedIds.has(n.id);
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "group grid grid-cols-12 items-center px-4 py-3 transition-colors hover:bg-accent/50",
                      isSelected && "bg-primary/5",
                    )}
                  >
                    <div className="col-span-1 flex items-center gap-2">
                      <button
                        onClick={(e) => handleSelectNote(n.id, e)}
                        className={cn(
                          "grid h-4 w-4 place-items-center rounded border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border",
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={() => updateNote(n.id, { favorite: !n.favorite }, false)}
                        className={cn(
                          "text-muted-foreground hover:text-foreground",
                          n.favorite && "text-amber-500",
                        )}
                      >
                        <Star className={cn("h-3.5 w-3.5", n.favorite && "fill-current")} />
                      </button>
                    </div>

                    <div className="col-span-5 flex items-center gap-3 pr-4">
                      <div className="h-9 w-12 shrink-0 overflow-hidden rounded-lg border border-border">
                        <NoteThumb strokes={getStrokes(n.id)} theme={n.theme} pattern={n.pattern} />
                      </div>
                      <Link
                        to="/note/$id"
                        params={{ id: n.id }}
                        className="min-w-0 flex-1 hover:text-primary"
                      >
                        <p className="truncate text-sm font-semibold text-foreground">
                          {n.title || "Untitled note"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {n.strokeCount} strokes drawn
                        </p>
                      </Link>
                    </div>

                    <div className="col-span-2 text-xs text-muted-foreground capitalize">
                      <span className="rounded-md bg-muted px-2 py-0.5 font-medium">
                        {n.theme} · {n.pattern || "dots"}
                      </span>
                    </div>

                    <div className="col-span-2 text-xs text-muted-foreground">
                      {formatTimeAgo(n.updatedAt)}
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <button
                        onClick={() => exportNoteAsJson(n.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Export JSON"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => duplicateNote(n.id)}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Duplicate"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${n.title || "Untitled note"}"?`)) {
                            deleteNote(n.id);
                          }
                        }}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

/** Interactive Mini Scratchpad for instant ink testing right on the homepage */
function MiniScratchpad({ theme }: { theme: ThemeId }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState("#111318");
  const [lineWidth, setLineWidth] = useState(4);
  const isDrawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Set high-dpi resolution
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    isDrawingRef.current = true;
    lastPtRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPtRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth * (e.pointerType === "pen" ? Math.max(0.3, e.pressure * 1.5) : 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
    ctx.lineTo(curX, curY);
    ctx.stroke();

    lastPtRef.current = { x: curX, y: curY };
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
    lastPtRef.current = null;
  };

  return (
    <div className="space-y-3">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {["#111318", "#e7422f", "#3b82f6", "#10b981", "#8b5cf6"].map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "h-6 w-6 rounded-full border border-border shadow-sm transition-transform hover:scale-110",
                color === c && "ring-2 ring-primary ring-offset-2 ring-offset-card",
              )}
              style={{ background: c }}
            />
          ))}
          <div className="ml-2 flex items-center gap-1.5 border-l border-border pl-2">
            {[2, 5, 9].map((w) => (
              <button
                key={w}
                onClick={() => setLineWidth(w)}
                className={cn(
                  "grid h-6 w-6 place-items-center rounded-md text-xs font-semibold",
                  lineWidth === w
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={clearCanvas}
          className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Eraser className="h-3.5 w-3.5" />
          <span>Clear Scratchpad</span>
        </button>
      </div>

      {/* Drawing Canvas */}
      <div
        data-theme={theme}
        className="relative h-44 w-full overflow-hidden rounded-2xl border border-border shadow-inner"
        style={{ background: "var(--canvas-paper)" }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="h-full w-full touch-none cursor-crosshair"
        />
        <div className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-muted-foreground/60">
          Draw freely to test smoothness
        </div>
      </div>
    </div>
  );
}
