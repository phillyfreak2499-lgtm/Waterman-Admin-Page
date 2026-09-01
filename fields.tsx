import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { uploadMedia, type MediaItem } from "@/lib/cms";

/**
 * Form furniture shared by the office editors.
 *
 * Lifted out of `/admin` unchanged so the trainer room and the admin room run
 * the same course, uploads, and image controls rather than two drifting copies.
 */

export const inputClass =
  "h-11 w-full rounded-sm border border-line bg-paper px-3 text-ink focus:outline-2 focus:outline-offset-1 focus:outline-navy";
export const areaClass =
  "min-h-28 w-full rounded-sm border border-line bg-paper px-3 py-2 text-ink focus:outline-2 focus:outline-offset-1 focus:outline-navy";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ImageField({
  label,
  value,
  onChange,
  onUploaded,
  allowClear,
  clearTo,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onUploaded?: (item: MediaItem) => void;
  allowClear?: boolean;
  clearTo?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const payload = await fileToPayload(file);
      const uploaded = await uploadMedia({ data: payload });
      onChange(uploaded.url);
      onUploaded?.({
        id: uploaded.id,
        filename: uploaded.filename,
        mime: file.type,
        data: uploaded.url,
      });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      {value && (
        <img src={value} alt="" className="mb-3 h-28 w-full rounded-sm border border-line object-cover" />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept="image/*"
          className="block min-w-0 flex-1 text-sm"
          disabled={busy}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {allowClear && value && value !== clearTo && (
          <button
            type="button"
            className="h-11 shrink-0 text-sm text-muted hover:text-navy"
            onClick={() => onChange(clearTo ?? "")}
          >
            Use default
          </button>
        )}
      </div>
    </div>
  );
}

function fileToPayload(file: File) {
  return new Promise<{ filename: string; mime: string; data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const data = result.includes(",") ? result.split(",")[1] : result;
      resolve({ filename: file.name, mime: file.type || "image/jpeg", data: data ?? "" });
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}
