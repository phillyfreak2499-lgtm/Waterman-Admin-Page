import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { allowedTabs, canManageTrainingId, isAccessRole, type AccessRole } from "@/lib/access";
import { readCatalog } from "@/lib/cms";
import { getSql } from "@/lib/db";
import { trackStats } from "@/lib/progress-stats";
import type { ProgressRow } from "@/lib/progress";
import { requireChancellor } from "@/lib/rbac";

export type DigestRow = {
  name: string;
  store: string;
  title: string;
  detail: string;
};

export type WeeklyDigest = {
  weekOf: string;
  pending: DigestRow[];
  overdue: DigestRow[];
  finished: DigestRow[];
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

function weekLabel() {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export const getWeeklyDigest = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // The Chancellor and the trainer room read the same week.
    if (!(await canManageTrainingId(context.userId))) {
      await requireChancellor(context.userId);
    }
    const [sql, catalog] = await Promise.all([getSql(), readCatalog()]);

    const pendingRows = await sql<{
      name: string;
      store: string | null;
      title: string | null;
    }>`
      select u.name, p.store, p.title
      from "user" u
      join user_profiles p on p.user_id = u.id
      where p.account_status = 'pending'
      order by u.name asc
      limit 1000
    `;

    const people = await sql<{
      user_id: string;
      name: string;
      store: string | null;
      title: string | null;
      access_role: string | null;
      created_at: unknown;
    }>`
      select u.id as user_id, u.name, p.store, p.title, p.access_role, p.created_at
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
      order by a.created_at desc
      limit 10000
    `;

    const meta = new Map(
      people.map((person) => [
        person.user_id,
        {
          name: person.name,
          store: person.store ?? "",
          title: person.title ?? "",
          role: isAccessRole(person.access_role) ? person.access_role : ("pending" as AccessRole),
          createdAt: new Date(iso(person.created_at)).getTime() || Date.now(),
        },
      ]),
    );
    const byUser = new Map<string, ProgressRow[]>(people.map((person) => [person.user_id, []]));
    const assignedByUser = new Map<string, Set<string>>();
    for (const row of assignments) {
      const set = assignedByUser.get(row.user_id) ?? new Set<string>();
      set.add(row.track_id);
      assignedByUser.set(row.user_id, set);
    }

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const staleBefore = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const finished: DigestRow[] = [];
    for (const row of progress) {
      if (!meta.has(row.user_id)) continue;
      const list = byUser.get(row.user_id) ?? [];
      list.push({
        lessonKey: row.lesson_key,
        startedAt: iso(row.last_viewed_at),
        lastViewedAt: iso(row.last_viewed_at),
        completedAt: row.completed_at ? iso(row.completed_at) : null,
      });
      byUser.set(row.user_id, list);
      const person = meta.get(row.user_id)!;
      if (row.completed_at && new Date(iso(row.completed_at)).getTime() >= weekAgo) {
        const [trackId, slug] = row.lesson_key.split("/");
        const track = catalog.tracks.find((item) => item.id === trackId);
        const lesson = track?.lessons.find((item) => item.slug === slug);
        finished.push({
          name: person.name,
          store: person.store,
          title: person.title,
          detail: lesson?.title ?? row.lesson_key,
        });
      }
    }

    const overdue: DigestRow[] = [];
    for (const [id, person] of meta) {
      const rows = byUser.get(id) ?? [];
      const assignmentsForUser = assignedByUser.get(id) ?? new Set<string>();
      const tabs = allowedTabs(person.role);
      const allowed = catalog.tracks.filter(
        (track) => track.visibleToAll || tabs.includes(track.role) || assignmentsForUser.has(track.id),
      );
      const stats = allowed.reduce(
        (total, track) => {
          const current = trackStats(rows, track);
          return { done: total.done + current.done, total: total.total + current.total };
        },
        { done: 0, total: 0 },
      );
      if (!stats.total || stats.done >= stats.total) continue;
      const last = rows.reduce(
        (latest, row) => Math.max(latest, new Date(row.lastViewedAt).getTime() || 0),
        0,
      );
      if ((last && last < staleBefore) || (!last && person.createdAt < staleBefore)) {
        overdue.push({
          name: person.name,
          store: person.store,
          title: person.title,
          detail: last
            ? `${stats.done}/${stats.total} lessons · quiet since ${new Date(last).toLocaleDateString()}`
            : `0/${stats.total} lessons · no training activity`,
        });
      }
    }

    const today = chicagoDate();
    for (const row of assignments) {
      if (!row.due_on || row.due_on >= today) continue;
      const person = meta.get(row.user_id);
      const track = catalog.tracks.find((item) => item.id === row.track_id);
      if (!person || !track) continue;
      const stats = trackStats(byUser.get(row.user_id) ?? [], track);
      if (stats.total > 0 && stats.done >= stats.total) continue;
      overdue.push({
        name: person.name,
        store: person.store,
        title: person.title,
        detail: `${track.title} due ${row.due_on}`,
      });
    }

    return {
      weekOf: weekLabel(),
      pending: pendingRows.map((row) => ({
        name: row.name,
        store: row.store ?? "",
        title: row.title ?? "",
        detail: "Waiting for approval",
      })),
      overdue,
      finished: finished.slice(0, 100),
    } satisfies WeeklyDigest;
  });
