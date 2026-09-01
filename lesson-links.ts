import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

/**
 * Resource links for tagged lesson lines.
 *
 * Lesson bodies carry tagged lines — `GFA · …`, `ROLEPLAY · …`, `SOLUTION · …`,
 * `VIDEO · …` — that named a resource but linked nowhere. This module lets the
 * training office attach a destination to an individual line, and lets the
 * lesson page render that line as a real link.
 */

/** Tags that may carry a resource link. Mirrors TAGS in the lesson route. */
export const LINKABLE_TAGS = [
  "VIDEO",
  "GFA",
  "PRACTICE",
  "ROLEPLAY",
  "FORM",
  "SOLUTION",
  "INTERVIEW",
  "ANALYSIS",
  "FITTING",
  "WELCOME",
  "NEW HIRE ONBOARDING",
] as const;

export type LinkableTag = (typeof LINKABLE_TAGS)[number];

export type LessonLink = {
  trackId: string;
  lessonSlug: string;
  lineKey: string;
  tag: string;
  label: string;
  url: string;
};

/** The tag at the start of a lesson line, or null when it carries none. */
export function tagOfLine(text: string): LinkableTag | null {
  return (
    LINKABLE_TAGS.find(
      (tag) => text.startsWith(`${tag} · `) || text.startsWith(`${tag} `),
    ) ?? null
  );
}

/**
 * Stable identifier for a tagged line within a lesson.
 *
 * Deliberately NOT the line's index: paragraphs get reordered and inserted by
 * the CMS editor, and an index-keyed link would silently re-attach itself to a
 * different line. Derived from the tag plus the first few normalised words, so
 * light copy edits later in the sentence keep the link attached.
 */
export function lessonLineKey(text: string): string | null {
  const tag = tagOfLine(text);
  if (!tag) return null;
  const rest = text.startsWith(`${tag} · `)
    ? text.slice(tag.length + 3)
    : text.slice(tag.length + 1);
  const words = rest
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join("-");
  return `${tag.toLowerCase().replace(/\s+/g, "-")}:${words}`.slice(0, 160);
}

/**
 * Accept only a plain http(s) destination.
 *
 * This value is written into an `href` that staff will click, so anything else
 * — `javascript:`, `data:`, `vbscript:`, a protocol-relative `//host` — is a
 * stored-XSS or off-site-redirect vector. Parse it properly rather than
 * pattern-matching, and re-serialise so the stored value is normalised.
 */
export function normalizeResourceUrl(raw: string): string {
  const value = String(raw ?? "").trim();
  if (!value) throw new Error("Add a link first.");
  if (value.length > 2048) throw new Error("That link is too long.");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("That does not look like a full web address (https://…).");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Links must start with https:// or http://");
  }
  return parsed.toString();
}

/** Pull the first usable URL out of a drop / paste payload. */
export function firstUrlFromText(raw: string): string | null {
  // `text/uri-list` is newline separated and allows `#` comment lines.
  for (const line of String(raw ?? "").split(/[\r\n]+/)) {
    const candidate = line.trim();
    if (!candidate || candidate.startsWith("#")) continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return parsed.toString();
      }
    } catch {
      /* not a URL — keep looking */
    }
  }
  return null;
}

async function assertOffice(userId: string) {
  const { canManageTrainingId, readAccessRole } = await import("@/lib/access");
  if (await canManageTrainingId(userId)) return;
  if ((await readAccessRole(userId)) === "admin") return;
  const { isChancellorId } = await import("@/lib/rbac");
  if (await isChancellorId(userId)) return;
  const sql = await getSql();
  const rows = await sql<{ user_id: string }>`
    select user_id from admin_unlocks
    where user_id = ${userId} and expires_at > now()
    limit 1
  `;
  if (!rows.length) throw new Error("Forbidden");
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function rowsToLinks(
  rows: { track_id: string; lesson_slug: string; line_key: string; tag: string; label: string; url: string }[],
): LessonLink[] {
  return rows.map((row) => ({
    trackId: row.track_id,
    lessonSlug: row.lesson_slug,
    lineKey: row.line_key,
    tag: row.tag,
    label: row.label ?? "",
    url: row.url,
  }));
}

/**
 * Links for one lesson. Read-only and safe for any signed-in learner: it
 * returns destinations for a lesson they are already permitted to open, and the
 * lesson body itself is gated upstream by the catalog redaction.
 */
export const listLessonLinks = createServerFn({ method: "GET" })
  .validator((input: { trackId: string; lessonSlug: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ data }) => {
    const trackId = cleanText(data?.trackId, 120);
    const lessonSlug = cleanText(data?.lessonSlug, 120);
    if (!trackId || !lessonSlug) return [];
    const sql = await getSql();
    const rows = await sql<{
      track_id: string;
      lesson_slug: string;
      line_key: string;
      tag: string;
      label: string;
      url: string;
    }>`
      select track_id, lesson_slug, line_key, tag, label, url
      from lesson_links
      where track_id = ${trackId} and lesson_slug = ${lessonSlug}
      limit 400
    `;
    return rowsToLinks(rows);
  });

/** Every link, for the office management screen. */
export const listAllLessonLinks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertOffice(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      track_id: string;
      lesson_slug: string;
      line_key: string;
      tag: string;
      label: string;
      url: string;
    }>`
      select track_id, lesson_slug, line_key, tag, label, url
      from lesson_links
      order by track_id asc, lesson_slug asc
      limit 2000
    `;
    return rowsToLinks(rows);
  });

export const saveLessonLink = createServerFn({ method: "POST" })
  .validator(
    (input: {
      trackId: string;
      lessonSlug: string;
      lineKey: string;
      tag: string;
      label: string;
      url: string;
    }) => input,
  )
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await assertOffice(context.userId);
    const trackId = cleanText(data?.trackId, 120);
    const lessonSlug = cleanText(data?.lessonSlug, 120);
    const lineKey = cleanText(data?.lineKey, 160);
    const tag = cleanText(data?.tag, 40);
    const label = cleanText(data?.label, 200);
    if (!trackId || !lessonSlug || !lineKey || !tag) {
      throw new Error("That line could not be identified. Reload and try again.");
    }
    const url = normalizeResourceUrl(data?.url);
    const sql = await getSql();
    await sql`
      insert into lesson_links (track_id, lesson_slug, line_key, tag, label, url, updated_by, updated_at)
      values (${trackId}, ${lessonSlug}, ${lineKey}, ${tag}, ${label}, ${url}, ${context.userId}, now())
      on conflict (track_id, lesson_slug, line_key) do update set
        tag = excluded.tag,
        label = excluded.label,
        url = excluded.url,
        updated_by = excluded.updated_by,
        updated_at = now()
    `;
    return { trackId, lessonSlug, lineKey, tag, label, url } satisfies LessonLink;
  });

export const deleteLessonLink = createServerFn({ method: "POST" })
  .validator((input: { trackId: string; lessonSlug: string; lineKey: string }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await assertOffice(context.userId);
    const trackId = cleanText(data?.trackId, 120);
    const lessonSlug = cleanText(data?.lessonSlug, 120);
    const lineKey = cleanText(data?.lineKey, 160);
    const sql = await getSql();
    await sql`
      delete from lesson_links
      where track_id = ${trackId} and lesson_slug = ${lessonSlug} and line_key = ${lineKey}
    `;
    return { ok: true as const };
  });
