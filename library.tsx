import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ImageField } from "@/components/training-office/fields";
import { deleteMedia, listMedia, type MediaItem } from "@/lib/cms";

/** Uploaded images, used on courses, posts, and the home page. */
export function Library() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listMedia()
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load uploads");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div>
      <h2 className="font-display text-3xl">Uploads</h2>
      <p className="mt-2 text-sm text-muted">
        Add photos here, then use them on a course, a news post, or the home page. Keep images under 1.5 MB.
      </p>
      {error && (
        <div className="mt-4 rounded-md border border-line bg-surface p-4">
          <p role="alert" className="text-sm text-muted">{error}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </Button>
        </div>
      )}
      <div className="mt-5">
        <ImageField
          label="Upload an image"
          value=""
          onChange={() => {
            listMedia()
              .then(setItems)
              .catch((reason) =>
                toast.error(reason instanceof Error ? reason.message : "Could not refresh uploads"),
              );
          }}
          onUploaded={(item) => setItems((prev) => [item, ...prev])}
        />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {items.map((item) => (
          <figure key={item.id} className="overflow-hidden rounded-md border border-line bg-surface">
            <img src={item.data} alt="" className="aspect-[4/3] w-full object-cover" />
            <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted">
              <span className="truncate">{item.filename}</span>
              <button
                type="button"
                className="shrink-0 text-navy hover:underline"
                onClick={() => {
                  if (!confirm(`Delete ${item.filename}? Existing pages using it will show a missing image.`)) return;
                  void deleteMedia({ data: item.id })
                    .then(() => {
                      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
                      toast.success("Upload removed");
                    })
                    .catch((reason) =>
                      toast.error(reason instanceof Error ? reason.message : "Could not remove the upload"),
                    );
                }}
              >
                Delete
              </button>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
