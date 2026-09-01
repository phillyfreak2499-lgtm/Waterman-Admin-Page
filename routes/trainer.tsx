import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAccess } from "@/components/access-provider";
import { AuthGate } from "@/components/auth-gate";
import { useCatalog } from "@/components/catalog-provider";
import { LessonLinksEditor } from "@/components/admin-lesson-links";
import { QuizEditor, QuizInbox } from "@/components/admin-quizzes";
import { Library } from "@/components/training-office/library";
import { TrainingEditor } from "@/components/training-office/training-editor";
import { Button } from "@/components/ui/button";
import { listTrainerNotes, markNoteReviewed, type TrainerNote } from "@/lib/ask-trainer";
import { Redirect } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getWeeklyDigest, type WeeklyDigest } from "@/lib/digest";
import { lessonLineKey, listAllLessonLinks, tagOfLine } from "@/lib/lesson-links";
import { pageHead } from "@/lib/page-title";
import { listTrainingAudit } from "@/lib/rbac";
import {
  listCampusEvals,
  listLearnerProgress,
  type CampusEvals,
  type LearnerRow,
} from "@/lib/training-office";
import { cn, errorMessage } from "@/lib/utils";

export const Route = createFileRoute("/trainer")({
  component: TrainerPage,
  head: () => pageHead("Trainer", "Courses, learners, and the questions waiting on you."),
});

const TABS = [
  { id: "desk", label: "Desk" },
  { id: "courses", label: "Courses" },
  { id: "links", label: "Academy links" },
  { id: "quizzes", label: "Quizzes" },
  { id: "media", label: "Media" },
  { id: "learners", label: "Learners" },
  { id: "evaluations", label: "Evaluations" },
  { id: "questions", label: "Questions" },
  { id: "log", label: "Log" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function TrainerPage() {
  return (
    <AuthGate>
      <Gate />
    </AuthGate>
  );
}

function Gate() {
  const { access, ready } = useAccess();
  if (!ready) {
    return <div className="grid min-h-dvh place-items-center bg-navy-deep text-brass-soft">Opening the room…</div>;
  }
  if (!access.canManageTraining) return <Redirect to="/" />;
  return <Room />;
}

function Room() {
  const { user } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("desk");
  return (
    <div className="min-h-dvh bg-navy-deep text-paper">
      <header className="border-b border-paper/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div>
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-brass-soft">
              Training office
            </p>
            <h1 className="font-display text-2xl leading-none sm:text-3xl">Trainer’s Room</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-brass-soft">{user?.displayName ?? "Professor"}</span>
            <Link to="/" className="text-paper/70 hover:text-paper">
              Campus
            </Link>
            <button type="button" className="text-paper/70 hover:text-paper" onClick={() => void signOut("/")}>
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 sm:px-8">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "relative h-11 shrink-0 px-4 text-xs font-medium uppercase tracking-[0.14em]",
                tab === item.id ? "text-paper" : "text-paper/50 hover:text-paper",
              )}
            >
              {item.label}
              <span className={cn("absolute inset-x-3 -bottom-px h-0.5", tab === item.id ? "bg-brass" : "bg-transparent")} />
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {tab === "desk" && <Desk onJump={setTab} />}
        {tab === "courses" && <CoursesDesk />}
        {tab === "links" && (
          <Sheet title="Academy links" blurb="Give every tagged lesson line a destination.">
            <LessonLinksEditor />
          </Sheet>
        )}
        {tab === "quizzes" && (
          <Sheet title="Quizzes" blurb="Write the questions, then read what came back.">
            <QuizEditor />
            <div className="mt-12 border-t border-line pt-10">
              <QuizInbox />
            </div>
          </Sheet>
        )}
        {tab === "media" && (
          <Sheet title="Media" blurb="Images you can use on a course or a lesson.">
            <Library />
          </Sheet>
        )}
        {tab === "learners" && <LearnersDesk />}
        {tab === "evaluations" && <EvaluationsDesk />}
        {tab === "questions" && <QuestionsDesk />}
        {tab === "log" && <LogDesk />}
      </main>
    </div>
  );
}

/**
 * The shared office editors are built for the light campus pages. Rather than
 * fork them for the dark room, they sit on a paper sheet inside it.
 */
function Sheet({ title, blurb, children }: { title: string; blurb: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mt-2 text-sm text-paper/60">{blurb}</p>
      <div className="mt-6 rounded-lg bg-paper p-5 text-ink sm:p-7">{children}</div>
    </div>
  );
}

function CoursesDesk() {
  const { catalog, replace } = useCatalog();
  return (
    <Sheet title="Courses" blurb="Add a course, edit its lessons, or take one down.">
      <TrainingEditor tracks={catalog.tracks} onSave={replace} />
    </Sheet>
  );
}

/** Tagged lesson lines across the catalog that still have no destination. */
function useUnlinkedLines() {
  const { catalog } = useCatalog();
  const [linked, setLinked] = useState<Set<string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    listAllLessonLinks()
      .then((rows) => {
        if (!cancelled) {
          setLinked(new Set(rows.map((row) => `${row.trackId}::${row.lessonSlug}::${row.lineKey}`)));
        }
      })
      .catch((reason) => toast.error(errorMessage(reason, "Could not load lesson links.")));
    return () => {
      cancelled = true;
    };
  }, []);
  return useMemo(() => {
    if (!linked) return null;
    const out: { trackTitle: string; lessonTitle: string; tag: string; text: string; key: string }[] = [];
    for (const track of catalog.tracks) {
      for (const lesson of track.lessons) {
        for (const line of lesson.body) {
          const tag = tagOfLine(line);
          const lineKey = lessonLineKey(line);
          if (!tag || !lineKey) continue;
          const id = `${track.id}::${lesson.slug}::${lineKey}`;
          if (linked.has(id)) continue;
          out.push({ trackTitle: track.title, lessonTitle: lesson.title, tag, text: line, key: id });
        }
      }
    }
    return out;
  }, [catalog, linked]);
}

function Desk({ onJump }: { onJump: (tab: Tab) => void }) {
  const [notes, setNotes] = useState<TrainerNote[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const unlinked = useUnlinkedLines();

  useEffect(() => {
    listTrainerNotes()
      .then(setNotes)
      .catch((reason) => toast.error(errorMessage(reason, "Could not load questions.")));
    listLearnerProgress()
      .then(setLearners)
      .catch((reason) => toast.error(errorMessage(reason, "Could not load learners.")));
    getWeeklyDigest()
      .then(setDigest)
      .catch((reason) => toast.error(errorMessage(reason, "Could not load the week.")));
  }, []);

  const unanswered = notes.filter((note) => !note.reviewedAt);
  const behind = learners.filter(
    (row) => row.overdue.length > 0 || (row.total > 0 && row.done < row.total && !row.lastActivity),
  );

  return (
    <div className="space-y-10">
      <div>
        <h2 className="font-display text-3xl">This week</h2>
        <p className="mt-2 text-sm text-paper/60">
          {digest ? `Week of ${digest.weekOf}.` : "Counting up the week…"} Four things usually want you.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Questions waiting" value={String(unanswered.length)} onClick={() => onJump("questions")} />
          <Stat label="Learners behind" value={String(behind.length)} onClick={() => onJump("learners")} />
          <Stat
            label="Lines with no link"
            value={unlinked ? String(unlinked.length) : "—"}
            onClick={() => onJump("links")}
          />
          <Stat label="Lessons finished" value={digest ? String(digest.finished.length) : "—"} />
        </div>
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl">Questions waiting</h2>
          <button type="button" className="text-sm text-brass-soft hover:text-paper" onClick={() => onJump("questions")}>
            The whole inbox
          </button>
        </div>
        {unanswered.length === 0 ? (
          <p className="mt-3 text-sm text-paper/60">Nothing unanswered.</p>
        ) : (
          <ul className="mt-4 divide-y divide-paper/10 border-t border-paper/10">
            {unanswered.slice(0, 5).map((note) => (
              <li key={note.id} className="py-3">
                <p className="text-sm text-brass-soft">
                  {note.userName}
                  {note.store ? ` · ${note.store}` : ""} · {note.lessonTitle}
                </p>
                <p className="mt-1 text-sm text-paper/80">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl">Behind</h2>
          <button type="button" className="text-sm text-brass-soft hover:text-paper" onClick={() => onJump("learners")}>
            Everyone
          </button>
        </div>
        {behind.length === 0 ? (
          <p className="mt-3 text-sm text-paper/60">Nobody is overdue or stalled.</p>
        ) : (
          <ul className="mt-4 divide-y divide-paper/10 border-t border-paper/10">
            {behind.slice(0, 8).map((row) => (
              <li key={row.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-sm text-paper/55">
                    {row.store || "No store"} · {row.done}/{row.total} lessons
                  </p>
                </div>
                <p className="text-sm text-paper/55">
                  {row.overdue.length
                    ? `${row.overdue[0].trackTitle} due ${row.overdue[0].dueOn}`
                    : "Never opened a lesson"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl">Lessons with no link</h2>
          <button type="button" className="text-sm text-brass-soft hover:text-paper" onClick={() => onJump("links")}>
            Attach links
          </button>
        </div>
        {!unlinked ? (
          <p className="mt-3 text-sm text-paper/60">Reading the catalog…</p>
        ) : unlinked.length === 0 ? (
          <p className="mt-3 text-sm text-paper/60">Every tagged line has a destination.</p>
        ) : (
          <ul className="mt-4 divide-y divide-paper/10 border-t border-paper/10">
            {unlinked.slice(0, 8).map((row) => (
              <li key={row.key} className="py-3">
                <p className="text-sm text-brass-soft">
                  {row.tag} · {row.trackTitle} · {row.lessonTitle}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-paper/70">{row.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-3xl">Finished this week</h2>
        {!digest ? (
          <p className="mt-3 text-sm text-paper/60">Counting…</p>
        ) : digest.finished.length === 0 ? (
          <p className="mt-3 text-sm text-paper/60">No lessons finished in the last seven days.</p>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-paper/70">
            {digest.finished.slice(0, 10).map((row, index) => (
              <li key={`${row.name}-${index}`}>
                <span className="text-brass-soft">{row.name}</span>
                {row.store ? ` · ${row.store}` : ""} — {row.detail}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LearnersDesk() {
  const [rows, setRows] = useState<LearnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [store, setStore] = useState("all");
  const [state, setState] = useState("all");

  useEffect(() => {
    listLearnerProgress()
      .then(setRows)
      .catch((reason) => toast.error(errorMessage(reason, "Could not load learners.")))
      .finally(() => setLoading(false));
  }, []);

  const stores = useMemo(() => {
    const set = new Set(rows.map((row) => row.store).filter(Boolean));
    return [...set].sort();
  }, [rows]);

  const shown = rows.filter((row) => {
    if (store !== "all" && row.store !== store) return false;
    if (state === "overdue" && row.overdue.length === 0) return false;
    if (state === "done" && !(row.total > 0 && row.done >= row.total)) return false;
    if (state === "not-started" && row.done !== 0) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${row.name} ${row.store} ${row.title}`.toLowerCase().includes(needle);
  });

  const byStore = useMemo(() => {
    const map = new Map<string, { done: number; total: number; people: number; overdue: number }>();
    for (const row of rows) {
      const key = row.store || "No store";
      const current = map.get(key) ?? { done: 0, total: 0, people: 0, overdue: 0 };
      current.done += row.done;
      current.total += row.total;
      current.people += 1;
      if (row.overdue.length) current.overdue += 1;
      map.set(key, current);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-3xl">By store</h2>
        <p className="mt-2 text-sm text-paper/60">Lessons finished out of lessons on the path.</p>
        {loading ? (
          <p className="mt-3 text-sm text-paper/60">Loading…</p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byStore.map(([name, stat]) => (
              <div key={name} className="rounded-lg border border-paper/15 bg-navy p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-brass-soft">{name}</p>
                <p className="mt-2 font-display text-3xl">
                  {stat.done}
                  <span className="text-lg text-paper/50">/{stat.total}</span>
                </p>
                <p className="mt-1 text-sm text-paper/55">
                  {stat.people} {stat.people === 1 ? "person" : "people"}
                  {stat.overdue ? ` · ${stat.overdue} overdue` : ""}
                </p>
              </div>
            ))}
            {!byStore.length && <p className="text-sm text-paper/55">No approved learners yet.</p>}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-3xl">By person</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            className={darkInput}
            placeholder="Search name, store, title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className={darkInput} value={store} onChange={(e) => setStore(e.target.value)}>
            <option value="all">All stores</option>
            {stores.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select className={darkInput} value={state} onChange={(e) => setState(e.target.value)}>
            <option value="all">Everyone</option>
            <option value="overdue">Overdue only</option>
            <option value="not-started">Not started</option>
            <option value="done">Finished the path</option>
          </select>
        </div>
        <ul className="mt-5 divide-y divide-paper/10 border-t border-paper/10">
          {shown.map((row) => (
            <li key={row.userId} className="grid gap-2 py-4 lg:grid-cols-[1.2fr_1fr_1fr] lg:items-center">
              <div>
                <p className="font-medium">{row.name}</p>
                <p className="text-sm text-paper/55">
                  {row.store || "No store"} · {row.title || "No title"}
                </p>
              </div>
              <div className="text-sm text-paper/70">
                <p>
                  {row.done}/{row.total} lessons
                </p>
                <p className="text-paper/50">
                  {row.completedCourses} done · {row.startedCourses} in progress · {row.untouchedCourses} not started
                </p>
              </div>
              <div className="text-sm text-paper/70">
                {row.overdue.length ? (
                  <p className="text-brass-soft">
                    Overdue: {row.overdue.map((item) => `${item.trackTitle} (${item.dueOn})`).join(", ")}
                  </p>
                ) : (
                  <p className="text-paper/50">
                    {row.lastActivity
                      ? `Last opened ${row.lastActivity.slice(0, 10)}`
                      : "No training activity"}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
        {!loading && !shown.length && <p className="mt-4 text-sm text-paper/55">Nobody matches.</p>}
      </section>
    </div>
  );
}

function EvaluationsDesk() {
  const [data, setData] = useState<CampusEvals | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCampusEvals()
      .then(setData)
      .catch((reason) => setError(errorMessage(reason, "Could not load evaluations.")));
  }, []);

  if (error) return <p className="text-sm text-paper/70">{error}</p>;
  if (!data) return <p className="text-sm text-paper/60">Loading evaluations…</p>;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-3xl">Scores by phase</h2>
        <p className="mt-2 text-sm text-paper/60">
          Across the last {data.evalCount} graded {data.evalCount === 1 ? "evaluation" : "evaluations"}. Averages are out of 10.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {data.byPhase.map((phase) => (
            <div key={phase.id} className="rounded-lg border border-paper/15 bg-navy p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-brass-soft">{phase.label}</p>
              <p className="mt-2 font-display text-3xl">{phase.avg == null ? "—" : phase.avg.toFixed(1)}</p>
              <p className="mt-1 text-xs text-paper/45">{phase.count} scored</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-paper/60">
          Campus average: {data.overall == null ? "not scored yet" : data.overall.toFixed(1)}
        </p>
      </section>

      <section>
        <h2 className="font-display text-3xl">Recent evaluations</h2>
        <ul className="mt-4 divide-y divide-paper/10 border-t border-paper/10">
          {data.recent.map((row) => (
            <li key={row.id} className="grid gap-2 py-4 lg:grid-cols-[1.2fr_1.6fr_auto] lg:items-center">
              <div>
                <p className="font-medium">{row.presenterName}</p>
                <p className="text-sm text-paper/55">
                  {row.store || "No store"} · {row.evalDate} · observed by {row.observerName}
                </p>
              </div>
              <p className="text-sm text-paper/70">
                {row.phases
                  .map((phase) => `${phase.label} ${phase.avg == null ? "—" : phase.avg}`)
                  .join(" · ")}
              </p>
              <div className="flex items-center gap-3">
                <span className="font-display text-2xl">{row.overall == null ? "—" : row.overall.toFixed(1)}</span>
                <Button size="sm" variant="brass" asChild>
                  <Link to="/team/evaluate/brief/$evalId" params={{ evalId: row.id }}>
                    Read
                  </Link>
                </Button>
              </div>
            </li>
          ))}
          {!data.recent.length && <li className="py-6 text-sm text-paper/55">No evaluations yet.</li>}
        </ul>
      </section>
    </div>
  );
}

function QuestionsDesk() {
  const [notes, setNotes] = useState<TrainerNote[]>([]);
  const [showReviewed, setShowReviewed] = useState(false);
  useEffect(() => {
    listTrainerNotes()
      .then(setNotes)
      .catch((reason) => toast.error(errorMessage(reason, "Could not load questions.")));
  }, []);
  const shown = showReviewed ? notes : notes.filter((note) => !note.reviewedAt);
  return (
    <div>
      <h2 className="font-display text-3xl">Ask the professor</h2>
      <p className="mt-2 text-sm text-paper/60">
        Questions asked from inside a lesson. Mark one reviewed once you have answered it on the floor.
      </p>
      <label className="mt-4 flex items-center gap-2 text-sm text-paper/70">
        <input
          type="checkbox"
          checked={showReviewed}
          onChange={(e) => setShowReviewed(e.target.checked)}
          className="size-4"
        />
        Include ones already reviewed
      </label>
      <ul className="mt-6 divide-y divide-paper/10 border-t border-paper/10">
        {shown.map((note) => (
          <li key={note.id} className="py-4">
            <p className="text-sm text-brass-soft">
              {note.userName}
              {note.store ? ` · ${note.store}` : ""} · {note.trackTitle} · {note.lessonTitle}
            </p>
            <p className="mt-2 text-sm leading-relaxed">{note.body}</p>
            <p className="mt-2 text-xs text-paper/40">
              {note.createdAt.slice(0, 16).replace("T", " ")}
              {note.reviewedAt ? " · reviewed" : ""}
            </p>
            {!note.reviewedAt && (
              <Button
                size="sm"
                variant="invert"
                className="mt-3"
                onClick={() => {
                  void markNoteReviewed({ data: note.id })
                    .then(setNotes)
                    .catch((reason) => toast.error(errorMessage(reason, "Could not update the question.")));
                }}
              >
                Mark reviewed
              </Button>
            )}
          </li>
        ))}
        {!shown.length && <li className="py-6 text-sm text-paper/55">Nothing waiting.</li>}
      </ul>
    </div>
  );
}

function LogDesk() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listTrainingAudit>>>([]);
  useEffect(() => {
    listTrainingAudit()
      .then(setRows)
      .catch((reason) => toast.error(errorMessage(reason, "Could not load the log.")));
  }, []);
  return (
    <div>
      <h2 className="font-display text-3xl">Training log</h2>
      <p className="mt-2 text-sm text-paper/60">
        Courses, lessons, and quizzes — who changed what. Account and site changes stay in the Chancellor’s log.
      </p>
      <ul className="mt-6 divide-y divide-paper/10 border-t border-paper/10">
        {rows.map((row) => (
          <li key={row.id} className="py-3">
            <p className="text-sm text-brass-soft">{row.action}</p>
            <p className="text-sm text-paper/80">{row.detail}</p>
            <p className="text-xs text-paper/40">
              {row.actorName} · {row.createdAt.slice(0, 19).replace("T", " ")}
            </p>
          </li>
        ))}
        {!rows.length && <li className="py-4 text-sm text-paper/55">Nothing logged yet.</li>}
      </ul>
    </div>
  );
}

function Stat({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-[0.16em] text-brass-soft">{label}</p>
      <p className="mt-2 font-display text-4xl">{value}</p>
    </>
  );
  if (!onClick) {
    return <div className="rounded-lg border border-paper/15 bg-navy p-5">{body}</div>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-paper/15 bg-navy p-5 text-left hover:border-brass-soft/60"
    >
      {body}
    </button>
  );
}

const darkInput =
  "h-11 w-full max-w-xs rounded-sm border border-paper/15 bg-navy-deep px-3 text-paper placeholder:text-paper/35 focus:outline-2 focus:outline-offset-1 focus:outline-brass";
