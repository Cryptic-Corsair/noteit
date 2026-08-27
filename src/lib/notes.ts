import type { Camera, Stroke } from "@/lib/ink";
import { uid } from "@/lib/ink";
import type { ThemeId, PaperPatternId } from "@/components/ink/palette";

export type Note = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  theme: ThemeId;
  pattern?: PaperPatternId;
  cam: Camera;
  strokes: Stroke[];
};

const KEY = "inkwell.notes.v1";
const LEGACY_KEY = "inkwell.board.v1";

export type NoteMeta = Omit<Note, "strokes" | "cam"> & { strokeCount: number };

function safeRead(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Note[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* corrupted */
  }
  // migrate the single-board store from the first version
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = JSON.parse(legacy) as { strokes: Stroke[]; cam: Camera; theme: ThemeId };
      const note: Note = {
        id: uid(),
        title: "My first note",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        favorite: false,
        theme: data.theme ?? "graphite",
        pattern: "dots",
        cam: data.cam ?? { x: 0, y: 0, k: 1 },
        strokes: Array.isArray(data.strokes) ? data.strokes : [],
      };
      localStorage.removeItem(LEGACY_KEY);
      writeAll([note]);
      return [note];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function writeAll(notes: Note[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    /* quota */
  }
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
export function subscribeNotes(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function listNotes(): NoteMeta[] {
  return safeRead()
    .map(({ strokes, ...rest }) => ({ ...rest, strokeCount: strokes.length }))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
}

export function getNote(id: string): Note | null {
  return safeRead().find((n) => n.id === id) ?? null;
}

export function createNote(
  title = "Untitled note",
  theme: ThemeId = "graphite",
  pattern: PaperPatternId = "dots",
): Note {
  const note: Note = {
    id: uid(),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false,
    theme,
    pattern,
    cam: { x: 0, y: 0, k: 1 },
    strokes: [],
  };
  writeAll([note, ...safeRead()]);
  return note;
}

export function updateNote(id: string, patch: Partial<Omit<Note, "id">>, touch = true) {
  const notes = safeRead();
  const i = notes.findIndex((n) => n.id === id);
  if (i === -1) return;
  notes[i] = { ...notes[i]!, ...patch, ...(touch ? { updatedAt: Date.now() } : {}) };
  writeAll(notes);
}

export function deleteNote(id: string) {
  writeAll(safeRead().filter((n) => n.id !== id));
}

export function duplicateNote(id: string): Note | null {
  const src = safeRead().find((n) => n.id === id);
  if (!src) return null;
  const copy: Note = {
    ...src,
    id: uid(),
    title: `${src.title || "Untitled"} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    favorite: false,
  };
  writeAll([copy, ...safeRead()]);
  return copy;
}

export function batchDeleteNotes(ids: string[]) {
  const set = new Set(ids);
  writeAll(safeRead().filter((n) => !set.has(n.id)));
}

export function batchFavoriteNotes(ids: string[], favorite: boolean) {
  const set = new Set(ids);
  const notes = safeRead().map((n) => (set.has(n.id) ? { ...n, favorite } : n));
  writeAll(notes);
}

export function exportNoteAsJson(id: string) {
  const note = getNote(id);
  if (!note) return;
  const blob = new Blob([JSON.stringify(note, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(note.title || "note").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.inkwell.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importNoteFromJson(jsonString: string): Note | null {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== "object") return null;
    const note: Note = {
      id: uid(),
      title: typeof data.title === "string" ? `${data.title} (Imported)` : "Imported note",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      favorite: false,
      theme: data.theme || "graphite",
      pattern: data.pattern || "dots",
      cam: data.cam || { x: 0, y: 0, k: 1 },
      strokes: Array.isArray(data.strokes) ? data.strokes : [],
    };
    writeAll([note, ...safeRead()]);
    return note;
  } catch {
    return null;
  }
}

/** Latest strokes for a note, used to render thumbnails. */
export function getStrokes(id: string): Stroke[] {
  return getNote(id)?.strokes ?? [];
}
