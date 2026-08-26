import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Star, Copy, Trash2, PenLine, Sparkles } from "lucide-react";
import {
  createNote,
  deleteNote,
  duplicateNote,
  listNotes,
  getStrokes,
  subscribeNotes,
  updateNote,
  type NoteMeta,
} from "@/lib/notes";
import { NoteThumb } from "@/components/ink/NoteThumb";
import { THEMES, type ThemeId } from "@/components/ink/palette";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inkwell — Handwritten Notes on an Infinite Canvas" },
      {
        name: "description",
        content:
          "Inkwell is a fast handwriting app: infinite canvas, pressure pen, eraser, lasso, rich colors and custom gradient inks. Your notebook, all in one place.",
      },
      { property: "og:title", content: "Inkwell — Handwritten Notes on an Infinite Canvas" },
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

const fmt = (t: number) => {
  const d = Date.now() - t;
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString();
};

function Home() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NoteMeta[] | null>(null);
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState<ThemeId>("graphite");

  const refresh = useCallback(() => setNotes(listNotes()), []);

  useEffect(() => {
    refresh();
    return subscribeNotes(refresh);
  }, [refresh]);

  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);

  const filtered = useMemo(() => {
    if (!notes) return [];
    const s = q.trim().toLowerCase();
    return s ? notes.filter((n) => n.title.toLowerCase().includes(s)) : notes;
  }, [notes, q]);

  const newNote = () => {
    const n = createNote("Untitled note", theme);
    navigate({ to: "/note/$id", params: { id: n.id } });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <div className="mr-auto flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <PenLine className="h-[18px] w-[18px]" />
            </span>
            <div className="leading-tight">
              <h1 className="font-display text-lg tracking-tight">Inkwell</h1>
              <p className="text-[11px] text-muted-foreground">infinite canvas notes</p>
            </div>
          </div>

          <label className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
              className="h-10 w-56 rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring"
            />
          </label>

          <button
            onClick={newNote}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> New note
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <section className="mb-8 overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10">
          <h2 className="max-w-xl font-display text-2xl leading-tight tracking-tight sm:text-4xl">
            Handwriting that feels like paper, on a canvas without edges.
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            Pressure-aware pen, precise eraser, lasso select and move, twelve inks, six gradients
            and your own custom blends. Everything saves as you write.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={newNote}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Start writing
            </button>
            <div className="flex items-center gap-1 rounded-xl border border-border p-1">
              <Sparkles className="mx-2 h-4 w-4 text-muted-foreground" />
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  title={t.name}
                  aria-label={`${t.name} theme`}
                  className={cn(
                    "h-7 w-7 rounded-lg border border-border transition-transform hover:scale-105",
                    theme === t.id && "ring-2 ring-ring",
                  )}
                  data-theme={t.id}
                  style={{ background: "var(--canvas-paper)" }}
                />
              ))}
            </div>
          </div>
        </section>

        <label className="relative mb-4 block sm:hidden">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
            className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-ring"
          />
        </label>

        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Your notes
          </h3>
          {notes && (
            <span className="text-xs text-muted-foreground">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </span>
          )}
        </div>

        {notes === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-56 animate-pulse rounded-2xl border border-border bg-card"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">
              {q ? "No notes match that search." : "No notes yet — your canvas is waiting."}
            </p>
            {!q && (
              <button
                onClick={newNote}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> Create your first note
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((n) => (
              <li
                key={n.id}
                className="group overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-float"
              >
                <Link
                  to="/note/$id"
                  params={{ id: n.id }}
                  className="block aspect-[4/3] overflow-hidden border-b border-border"
                >
                  {n.strokeCount ? (
                    <NoteThumb strokes={getStrokes(n.id)} theme={n.theme} />
                  ) : (
                    <div
                      data-theme={n.theme}
                      className="grid h-full w-full place-items-center text-xs text-muted-foreground"
                      style={{ background: "var(--canvas-paper)" }}
                    >
                      Empty canvas
                    </div>
                  )}
                </Link>
                <div className="flex items-center gap-2 p-3">
                  <Link
                    to="/note/$id"
                    params={{ id: n.id }}
                    className="mr-auto min-w-0 leading-tight"
                  >
                    <p className="truncate text-sm font-medium">{n.title || "Untitled note"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {fmt(n.updatedAt)} · {n.strokeCount} strokes
                    </p>
                  </Link>
                  <button
                    aria-label={n.favorite ? "Unstar note" : "Star note"}
                    onClick={() => updateNote(n.id, { favorite: !n.favorite }, false)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Star className={cn("h-4 w-4", n.favorite && "fill-current text-primary")} />
                  </button>
                  <button
                    aria-label="Duplicate note"
                    onClick={() => duplicateNote(n.id)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="Delete note"
                    onClick={() => {
                      if (confirm(`Delete "${n.title || "Untitled note"}"?`)) deleteNote(n.id);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
