import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  allowedTabs,
  assertCanManageTraining,
  isAccessRole,
  type AccessRole,
} from "@/lib/access";
import { readCatalog } from "@/lib/cms";
import { getSql } from "@/lib/db";
import {
  averagePhaseScores,
  type EvalAnswers,
} from "@/lib/presentation-eval";
import type { ProgressRow } from "@/lib/progress";
import { trackStats } from "@/lib/progress-stats";

/**
 * Reads for the trainer room's Learners and Evaluations screens.
 *
 * Every handler here calls `assertCanManageTraining` first. Hiding a tab is not
 * a permission check — a Specialist who calls these endpoints directly is
 * refused the same way.
 */

export type LearnerRow = {
  userId: string;
  name: string;
  store: string;
  title: string;
  role: AccessRole;
  /** Lessons finished across every course on this person's path. */
  done: number;
  /** Lessons on their path in total. */
  total: number;
  /** Courses they have finished / started / not opened. */
  completedCourses: number;
  startedCourses: number;
  untouchedCourses: number;
  /** Last time they opened any lesson, or "" when they never have. */
  lastActivity: string;
  /** Courses past their assigned due date and still unfinished. */
  overdue: { trackTitle: string; dueOn: string }[];
};

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return "";
}

function chicagoDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/** Progress for every approved learner, one row per person. */
export const listLearnerProgress = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertCanManageTraining(context.userId);
    const [sql, catalog] = await Promise.all([getSql(), readCatalog()]);

    const people = await sql<{
      user_id: string;
      name: string;
      store: string | null;
      title: string | null;
      access_role: string | null;
    }>`
      select u.id as user_id, u.name, p.store, p.title, p.access_role
      from "user" u
      join user_profiles p on p.user_id = u.id
      where p.account_status = 'approved' and coalesce(p.rbac_role, '') <> 'super-admin'
      order by u.name asc
      limit 2000
    `;

    const progress = await sql<{
      user_id: string;
      lesson_key: string;
      completed_at: unknown;
      last_viewed_at: unknown;
    }>`
      select lp.user_id, lp.lesson_key, lp.completed_at, lp.last_viewed_at
      from lesson_progress lp
      join user_profiles p on p.user_id = lp.user_id
      where p.account_status = 'approved'
      limit 50000
    `;

    const assignments = await sql<{
      user_id: string;
      track_id: string;
      due_on: string | null;
    }>`
      select a.user_id, a.track_id, a.due_on
      from training_assignments a
      join user_profiles p on p.user_id = a.user_id
      where p.account_status = 'approved'
      limit 10000
    `;

    const rowsByUser = new Map<string, ProgressRow[]>();
    for (const row of progress) {
      const list = rowsByUser.get(row.user_id) ?? [];
      list.push({
        lessonKey: row.lesson_key,
        startedAt: iso(row.last_viewed_at),
        lastViewedAt: iso(row.last_viewed_at),
        completedAt: row.completed_at ? iso(row.completed_at) : null,
      });
      rowsByUser.set(row.user_id, list);
    }

    const assignedByUser = new Map<string, Map<string, string | null>>();
    for (const row of assignments) {
      const map = assignedByUser.get(row.user_id) ?? new Map<string, string | null>();
      map.set(row.track_id, row.due_on);
      assignedByUser.set(row.user_id, map);
    }

    const today = chicagoDate();

    return people.map((person): LearnerRow => {
      const role = isAccessRole(person.access_role) ? person.access_role : "pending";
      const rows = rowsByUser.get(person.user_id) ?? [];
      const assigned = assignedByUser.get(person.user_id) ?? new Map<string, string | null>();
      const tabs = allowedTabs(role);
      const onPath = catalog.tracks.filter(
        (track) => track.visibleToAll || tabs.includes(track.role) || assigned.has(track.id),
      );

      let done = 0;
      let total = 0;
      let completedCourses = 0;
      let startedCourses = 0;
      let untouchedCourses = 0;
      const overdue: { trackTitle: string; dueOn: string }[] = [];

      for (const track of onPath) {
        const stats = trackStats(rows, track);
        done += stats.done;
        total += stats.total;
        if (stats.total > 0 && stats.done >= stats.total) completedCourses += 1;
        else if (stats.done > 0 || stats.started > 0) startedCourses += 1;
        else untouchedCourses += 1;
        const dueOn = assigned.get(track.id);
        if (dueOn && dueOn < today && !(stats.total > 0 && stats.done >= stats.total)) {
          overdue.push({ trackTitle: track.title, dueOn });
        }
      }

      const last = rows.reduce(
        (latest, row) => Math.max(latest, new Date(row.lastViewedAt).getTime() || 0),
        0,
      );

      return {
        userId: person.user_id,
        name: person.name,
        store: person.store ?? "",
        title: person.title ?? "",
        role,
        done,
        total,
        completedCourses,
        startedCourses,
        untouchedCourses,
        lastActivity: last ? new Date(last).toISOString() : "",
        overdue,
      };
    });
  });

export type CampusEvalRow = {
  id: string;
  presenterId: string;
  presenterName: string;
  observerName: string;
  store: string;
  evalDate: string;
  overall: number | null;
  phases: { id: string; label: string; avg: number | null }[];
};

export type CampusEvals = {
  recent: CampusEvalRow[];
  /** Campus-wide average per phase, across everything below. */
  byPhase: { id: string; label: string; avg: number | null; count: number }[];
  overall: number | null;
  evalCount: number;
};

/** Recent presentation evaluations across the whole company, plus phase averages. */
export const listCampusEvals = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertCanManageTraining(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      presenter_id: string;
      store: string | null;
      eval_date: string;
      answers: unknown;
      presenter_name: string | null;
      observer_name: string | null;
    }>`
      select e.id, e.presenter_id, e.store, e.eval_date, e.answers,
             p.name as presenter_name, o.name as observer_name
      from presentation_evaluations e
      left join "user" p on p.id = e.presenter_id
      left join "user" o on o.id = e.observer_id
      order by e.eval_date desc, e.created_at desc
      limit 200
    `;
    const parsed = rows.map((row) => ({
      row,
      answers: (typeof row.answers === "object" && row.answers ? row.answers : {}) as EvalAnswers,
    }));
    const campus = averagePhaseScores(parsed.map((item) => ({ answers: item.answers })));
    return {
      recent: parsed.map(({ row, answers }): CampusEvalRow => {
        const one = averagePhaseScores([{ answers }]);
        return {
          id: row.id,
          presenterId: row.presenter_id,
          presenterName: row.presenter_name || "Specialist",
          observerName: row.observer_name || "Observer",
          store: row.store ?? "",
          evalDate: String(row.eval_date).slice(0, 10),
          overall: one.overall,
          phases: one.byPhase.map((phase) => ({ id: phase.id, label: phase.label, avg: phase.avg })),
        };
      }),
      byPhase: campus.byPhase,
      overall: campus.overall,
      evalCount: campus.evalCount,
    } satisfies CampusEvals;
  });
