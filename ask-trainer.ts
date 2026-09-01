import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export type TrainerNote = {
  id: string;
  userId: string;
  userName: string;
  store: string;
  lessonKey: string;
  trackTitle: string;
  lessonTitle: string;
  body: string;
  createdAt: string;
  reviewedAt: string | null;
};

async function requireOffice(userId: string) {
  const { isChancellorId } = await import("@/lib/rbac");
  if (await isChancellorId(userId)) return;
  const { canManageTrainingId, isLeader, readAccessRole } = await import("@/lib/access");
  if (isLeader(await readAccessRole(userId))) return;
  if (await canManageTrainingId(userId)) return;
  throw new Error("Only the training office can read these notes.");
}

async function ensureNotes() {
  await getSql();
}

async function loadNotes(): Promise<TrainerNote[]> {
  await ensureNotes();
  const sql = await getSql();
  const { readCatalog } = await import("@/lib/cms");
  const catalog = await readCatalog();
  const rows = await sql<{
    id: string;
    user_id: string;
    name: string | null;
    store: string | null;
    lesson_key: string;
    body: string;
    created_at: string | Date | null;
    reviewed_at: string | Date | null;
  }>`
    select
      n.id, n.user_id, u.name, p.store, n.lesson_key, n.body,
      n.created_at, n.reviewed_at
    from trainer_notes n
    left join "user" u on u.id = n.user_id
    left join user_profiles p on p.user_id = n.user_id
    order by n.created_at desc
    limit 80
  `;
  return rows.map((row): TrainerNote => {
    const [trackId, slug] = row.lesson_key.split("/");
    const track = catalog.tracks.find((t) => t.id === trackId);
    const lesson = track?.lessons.find((l) => l.slug === slug);
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.name ?? "Unknown",
      store: row.store ?? "",
      lessonKey: row.lesson_key,
      trackTitle: track?.title ?? trackId ?? "",
      lessonTitle: lesson?.title ?? slug ?? row.lesson_key,
      body: row.body,
      createdAt: row.created_at ? String(row.created_at) : "",
      reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    };
  });
}

export const sendTrainerNote = createServerFn({ method: "POST" })
  .validator((input: { lessonKey: string; body: string }) => {
    if (!input || typeof input.lessonKey !== "string" ||
        !/^[a-z0-9:_-]+\/[a-z0-9:_-]+$/i.test(input.lessonKey) ||
        input.lessonKey.length > 180) throw new Error("Unknown lesson.");
    if (typeof input.body !== "string") throw new Error("Write a note for the professor.");
    return { lessonKey: input.lessonKey.trim(), body: input.body };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const body = data.body.trim();
    if (body.length < 4) throw new Error("Write a little more so the professor can help.");
    if (body.length > 2000) throw new Error("Keep it under 2,000 characters.");
    const [trackId, slug] = data.lessonKey.split("/");
    const { assertTrackAccess } = await import("@/lib/access");
    await assertTrackAccess(context.userId, trackId);
    await ensureNotes();
    const sql = await getSql();
    const lessons = await sql<{ id: string }>`
      select id from cms_lessons where track_id = ${trackId} and slug = ${slug} limit 1
    `;
    if (!lessons.length) throw new Error("That lesson is no longer available.");
    const id = globalThis.crypto.randomUUID();
    await sql`
      insert into trainer_notes (id, user_id, lesson_key, body)
      values (${id}, ${context.userId}, ${data.lessonKey.trim()}, ${body})
    `;
    return { ok: true as const };
  });

export const listTrainerNotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireOffice(context.userId);
    return loadNotes();
  });

export const markNoteReviewed = createServerFn({ method: "POST" })
  .validator((id: string) => {
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Unknown note.");
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }) => {
    await requireOffice(context.userId);
    await ensureNotes();
    const sql = await getSql();
    await sql`update trainer_notes set reviewed_at = now() where id = ${id}`;
    return loadNotes();
  });
