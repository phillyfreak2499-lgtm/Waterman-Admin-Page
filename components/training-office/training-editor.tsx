import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { areaClass, Field, ImageField, inputClass } from "@/components/training-office/fields";
import {
  deleteLesson,
  deleteTrack,
  saveLesson,
  saveTrack,
  slugify,
  type LessonInput,
  type TrackInput,
} from "@/lib/cms";
import { isRoleId } from "@/lib/content";
import { cn } from "@/lib/utils";

/** Courses and their lessons: add, edit, delete. Shared by /admin and /trainer. */
export function TrainingEditor({
  tracks,
  onSave,
}: {
  tracks: Awaited<ReturnType<typeof saveTrack>>["tracks"];
  onSave: (c: Awaited<ReturnType<typeof saveTrack>>) => void;
}) {
  const emptyTrack = (): TrackInput => ({
    id: "",
    role: "specialist",
    title: "",
    nav: "",
    image: "/media/campus-cogs.jpg",
    audience: "",
    summary: "",
  });
  const emptyLesson = (trackId: string): LessonInput => ({
    trackId,
    slug: "",
    title: "",
    minutes: 8,
    kicker: "",
    body: "",
    takeaway: "",
    evalPhases: [],
  });

  const [trackForm, setTrackForm] = useState<TrackInput>(emptyTrack());
  const [lessonForm, setLessonForm] = useState<LessonInput>(emptyLesson(""));
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = tracks.find((t) => t.id === selected);

  async function saveCurrentTrack(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const next = await saveTrack({
        data: {
          ...trackForm,
          id: trackForm.id || slugify(trackForm.title),
          nav: trackForm.nav || trackForm.title,
        },
      });
      onSave(next);
      const id = trackForm.id || slugify(trackForm.title);
      setSelected(id);
      setTrackForm({ ...trackForm, id });
      toast.success("Course saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function saveCurrentLesson(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const next = await saveLesson({
        data: {
          ...lessonForm,
          trackId: selected,
          slug: lessonForm.slug || slugify(lessonForm.title),
        },
      });
      onSave(next);
      toast.success("Lesson saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
      <div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            setSelected(null);
            setTrackForm(emptyTrack());
            setLessonForm(emptyLesson(""));
          }}
        >
          Add a course
        </Button>
        <ul className="mt-4 space-y-1">
          {tracks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(t.id);
                  setTrackForm({
                    id: t.id,
                    role: t.role,
                    title: t.title,
                    nav: t.nav,
                    image: t.image,
                    audience: t.audience,
                    summary: t.summary,
                    visibleToAll: t.visibleToAll,
                  });
                  setLessonForm(emptyLesson(t.id));
                }}
                className={cn(
                  "flex min-h-11 w-full items-center justify-between rounded-sm px-3 text-left text-sm",
                  selected === t.id ? "bg-navy text-paper" : "hover:bg-paper-2",
                )}
              >
                <span className="truncate">{t.title}</span>
                <span className="ml-2 tabular-nums opacity-70">{t.lessons.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-10">
        <form onSubmit={(e) => void saveCurrentTrack(e)} className="space-y-4 rounded-lg border border-line bg-surface p-5">
          <h2 className="font-display text-3xl">{trackForm.id ? "Edit course" : "New course"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input className={inputClass} value={trackForm.title} onChange={(e) => setTrackForm({ ...trackForm, title: e.target.value })} required />
            </Field>
            <Field label="Audience">
              <input className={inputClass} value={trackForm.audience} onChange={(e) => setTrackForm({ ...trackForm, audience: e.target.value })} placeholder="Every Specialist" />
            </Field>
            <Field label="Who can view">
              <select
                className={inputClass}
                value={trackForm.visibleToAll ? "all" : trackForm.role}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "all") setTrackForm({ ...trackForm, visibleToAll: true });
                  else if (isRoleId(value))
                    setTrackForm({ ...trackForm, role: value, visibleToAll: false });
                }}
              >
                <option value="new-hires">New Hires</option>
                <option value="specialist">Arch Support Specialist</option>
                <option value="mit">MIT</option>
                <option value="managers">Managers</option>
                <option value="all">All (everyone)</option>
              </select>
            </Field>
            <Field label="Short nav name">
              <input className={inputClass} value={trackForm.nav} onChange={(e) => setTrackForm({ ...trackForm, nav: e.target.value })} />
            </Field>
          </div>
          <Field label="Summary">
            <textarea className={areaClass} value={trackForm.summary} onChange={(e) => setTrackForm({ ...trackForm, summary: e.target.value })} />
          </Field>
          <ImageField label="Course image" value={trackForm.image} onChange={(url) => setTrackForm({ ...trackForm, image: url })} />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save course"}
            </Button>
            {trackForm.id && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (!confirm("Delete this course and its lessons?")) return;
                  void deleteTrack({ data: trackForm.id }).then((c) => {
                    onSave(c);
                    setSelected(null);
                    setTrackForm(emptyTrack());
                    toast.success("Course removed");
                  }).catch((error) =>
                    toast.error(error instanceof Error ? error.message : "Could not remove the course"),
                  );
                }}
              >
                Delete course
              </Button>
            )}
          </div>
        </form>

        {current && (
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="font-display text-2xl">Lessons</h3>
              <ul className="mt-3 space-y-2">
                {current.lessons.map((lesson) => (
                  <li key={lesson.slug}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center justify-between rounded-sm border border-line bg-paper px-3 text-left text-sm hover:border-navy/30"
                      onClick={() =>
                        setLessonForm({
                          trackId: current.id,
                          slug: lesson.slug,
                          title: lesson.title,
                          minutes: lesson.minutes,
                          kicker: lesson.kicker ?? "",
                          body: lesson.body.join("\n\n"),
                          takeaway: lesson.takeaway ?? "",
                          evalPhases: lesson.evalPhases ?? [],
                        })
                      }
                    >
                      <span className="truncate">{lesson.title}</span>
                      <span className="ml-2 text-muted">{lesson.minutes}m</span>
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => setLessonForm(emptyLesson(current.id))}
              >
                Add a lesson
              </Button>
            </div>
            <form onSubmit={(e) => void saveCurrentLesson(e)} className="space-y-4 rounded-lg border border-line bg-surface p-5">
              <h3 className="font-display text-2xl">{lessonForm.slug ? "Edit lesson" : "New lesson"}</h3>
              <Field label="Title">
                <input className={inputClass} value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Minutes">
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    value={lessonForm.minutes}
                    onChange={(e) => setLessonForm({ ...lessonForm, minutes: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Kicker">
                  <input className={inputClass} value={lessonForm.kicker} onChange={(e) => setLessonForm({ ...lessonForm, kicker: e.target.value })} />
                </Field>
              </div>
              <Field label="Lesson text" hint="Blank line between paragraphs.">
                <textarea
                  className={areaClass}
                  rows={8}
                  value={lessonForm.body}
                  onChange={(e) => setLessonForm({ ...lessonForm, body: e.target.value })}
                  required
                />
              </Field>
              <Field label="Takeaway">
                <input className={inputClass} value={lessonForm.takeaway} onChange={(e) => setLessonForm({ ...lessonForm, takeaway: e.target.value })} />
              </Field>
              <fieldset className="rounded-md border border-line bg-paper px-4 py-3">
                <legend className="px-1 text-sm font-medium text-ink">
                  Presentation phases this lesson strengthens
                </legend>
                <p className="mt-1 text-xs text-muted">
                  When a Specialist scores under 7 on a phase, tagged lessons from{" "}
                  <strong>this course&apos;s door</strong> are suggested in their Locker.
                  Leave blank if this lesson should not auto-suggest.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["welcome", "Welcome"],
                      ["interview", "Interview"],
                      ["analysis", "Analysis"],
                      ["fitting", "Fitting"],
                      ["solution", "Solution"],
                      ["close", "Close"],
                    ] as const
                  ).map(([id, label]) => {
                    const selected = (lessonForm.evalPhases || []).includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          const cur = lessonForm.evalPhases || [];
                          setLessonForm({
                            ...lessonForm,
                            evalPhases: selected
                              ? cur.filter((p) => p !== id)
                              : [...cur, id],
                          });
                        }}
                        className={
                          selected
                            ? "rounded-sm border border-navy bg-navy px-3 py-1.5 text-xs font-medium text-paper"
                            : "rounded-sm border border-line bg-surface px-3 py-1.5 text-xs font-medium text-navy hover:border-navy/30"
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save lesson"}
                </Button>
                {lessonForm.slug && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (!confirm("Remove this lesson?")) return;
                      void deleteLesson({ data: { trackId: current.id, slug: lessonForm.slug } }).then((c) => {
                        onSave(c);
                        setLessonForm(emptyLesson(current.id));
                        toast.success("Lesson removed");
                      }).catch((error) =>
                        toast.error(error instanceof Error ? error.message : "Could not remove the lesson"),
                      );
                    }}
                  >
                    Delete lesson
                  </Button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
