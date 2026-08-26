import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Board } from "@/components/ink/Board";
import { getNote } from "@/lib/notes";

export const Route = createFileRoute("/note/$id")({
  head: () => ({
    meta: [
      { title: "Canvas — Inkwell" },
      {
        name: "description",
        content:
          "Write and sketch on an infinite Inkwell canvas with a pressure pen, eraser, lasso and gradient inks.",
      },
      { property: "og:title", content: "Canvas — Inkwell" },
      {
        property: "og:description",
        content: "Infinite canvas note with pen, eraser, lasso and custom gradient inks.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotePage,
});

function NotePage() {
  const { id } = Route.useParams();
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    setState(getNote(id) ? "ok" : "missing");
  }, [id]);

  if (state === "loading") return <div className="h-dvh w-full bg-background" />;

  if (state === "missing") {
    return (
      <main className="grid h-dvh place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-foreground">This note is gone</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have been deleted from this device.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Back to notes
          </Link>
        </div>
      </main>
    );
  }

  return <Board noteId={id} />;
}
