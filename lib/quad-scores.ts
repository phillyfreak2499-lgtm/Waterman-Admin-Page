import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { QUAD_GAMES } from "@/lib/quad";

const GAME_SLUGS = new Set<string>(QUAD_GAMES.map((g) => g.slug));
const GAME_TITLE = new Map<string, string>(QUAD_GAMES.map((g) => [g.slug, g.title]));

export type GameScore = {
  slug: string;
  title: string;
  plays: number;
  bestScore: number | null;
  lastScore: number | null;
  lastPlayedAt: string;
};

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) return value;
  return new Date().toISOString();
}

/** Every game the user has opened, most recently played first. */
export const listMyGameScores = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<GameScore[]> => {
    const sql = await getSql();
    const rows = await sql<{
      game_slug: string;
      plays: number;
      best_score: number | null;
      last_score: number | null;
      last_played_at: unknown;
    }>`
      select game_slug, plays, best_score, last_score, last_played_at
      from user_game_scores
      where user_id = ${context.userId}
      order by last_played_at desc
      limit 50
    `;
    return rows
      .filter((r) => GAME_SLUGS.has(r.game_slug))
      .map((r) => ({
        slug: r.game_slug,
        title: GAME_TITLE.get(r.game_slug) ?? r.game_slug,
        plays: Number(r.plays) || 0,
        bestScore: r.best_score == null ? null : Number(r.best_score),
        lastScore: r.last_score == null ? null : Number(r.last_score),
        lastPlayedAt: iso(r.last_played_at),
      }));
  });

/**
 * Record activity for a Quad game. Two kinds of event, both upserted:
 *   - `opened: true`  → counts one play (fired when the game loads).
 *   - `score: <int>`  → updates last score and the running best.
 * The game slug is whitelisted; the score is bounded. Called by the parent
 * `GameFrame` in response to same-origin postMessages from `quad-bridge.js`.
 */
export const reportGameResult = createServerFn({ method: "POST" })
  .validator((input: { slug: string; score?: number | null; opened?: boolean }) => {
    if (!input || typeof input.slug !== "string" || !GAME_SLUGS.has(input.slug)) {
      throw new Error("Unknown game.");
    }
    let score: number | null = null;
    if (input.score != null) {
      const n = Number(input.score);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) throw new Error("Invalid score.");
      score = Math.round(n);
    }
    const opened = input.opened === true;
    if (!opened && score === null) throw new Error("Nothing to record.");
    return { slug: input.slug, score, opened };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const id = `${context.userId}:${data.slug}`;
    const playInc = data.opened ? 1 : 0;
    await sql`
      insert into user_game_scores
        (id, user_id, game_slug, plays, best_score, last_score, last_played_at, created_at)
      values (
        ${id}, ${context.userId}, ${data.slug},
        ${playInc}, ${data.score}, ${data.score}, now(), now()
      )
      on conflict (user_id, game_slug) do update set
        plays = user_game_scores.plays + ${playInc},
        best_score = case
          when ${data.score}::int is null then user_game_scores.best_score
          else greatest(coalesce(user_game_scores.best_score, ${data.score}::int), ${data.score}::int)
        end,
        last_score = coalesce(${data.score}::int, user_game_scores.last_score),
        last_played_at = now()
    `;
    return { ok: true };
  });

export type TeamQuadActivity = {
  plays: number;
  games: number;
  lastPlayedAt: string | null;
  lastTitle: string | null;
  bestTitle: string | null;
  bestScore: number | null;
};

/**
 * Quad activity for the people a leader can see.
 *
 * The practice games are the only place on the campus where a learner
 * demonstrates a skill rather than self-attesting it — lesson completion is a
 * checkbox the learner ticks, and quiz responses are free text with no correct
 * answer. Until now `user_game_scores` was written by every learner and read
 * only by that learner's own Locker, so none of it reached a manager.
 */
export const listTeamQuadActivity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ byPerson: Record<string, TeamQuadActivity> }> => {
    const { readAccessRole, isLeader, fetchPeople, visiblePeople } = await import("@/lib/access");
    const actor = await readAccessRole(context.userId);
    const byPerson: Record<string, TeamQuadActivity> = {};
    if (!isLeader(actor) && actor !== "admin") return { byPerson };

    const all = await fetchPeople();
    const visible = visiblePeople(context.userId, actor, all).filter(
      (p) => p.id !== context.userId && p.role !== "pending" && p.role !== "admin",
    );
    if (!visible.length) return { byPerson };

    const sql = await getSql();
    const ids = visible.map((p) => p.id);
    const rows = await sql<{
      user_id: string;
      game_slug: string;
      plays: number;
      best_score: number | null;
      last_played_at: unknown;
    }>`
      select user_id, game_slug, plays, best_score, last_played_at
      from user_game_scores
      where user_id = any(${ids}::text[])
      order by last_played_at desc
    `;

    for (const r of rows) {
      if (!GAME_SLUGS.has(r.game_slug)) continue;
      const title = GAME_TITLE.get(r.game_slug) ?? r.game_slug;
      const entry = (byPerson[r.user_id] ??= {
        plays: 0,
        games: 0,
        lastPlayedAt: null,
        lastTitle: null,
        bestTitle: null,
        bestScore: null,
      });
      entry.plays += Number(r.plays) || 0;
      entry.games += 1;
      // rows arrive newest-first, so the first one we see is the latest play
      if (!entry.lastPlayedAt) {
        entry.lastPlayedAt = iso(r.last_played_at);
        entry.lastTitle = title;
      }
      const best = r.best_score == null ? null : Number(r.best_score);
      if (best != null && (entry.bestScore == null || best > entry.bestScore)) {
        entry.bestScore = best;
        entry.bestTitle = title;
      }
    }
    return { byPerson };
  });
