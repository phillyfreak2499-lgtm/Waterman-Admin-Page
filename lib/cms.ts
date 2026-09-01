import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  isRoleId,
  roles as defaultRoles,
  SITE as defaultSite,
  tips as defaultTips,
  tracks as defaultTracks,
  type RoleId,
  type Track,
} from "@/lib/content";
import { getSql } from "@/lib/db";
import { getDeckSlides } from "@/lib/decks";
import { SLIDE_TRACKS } from "@/lib/slide-tracks";

export type SiteSettings = {
  name: string;
  short: string;
  tagline: string;
  company: string;
  stores: number;
  adminEmail: string;
};

export type RoleCopy = {
  id: RoleId;
  label: string;
  kicker: string;
  title: string;
  summary: string;
};

export type NewsItem = {
  id: string;
  slug: string;
  title: string;
  date: string;
  body: string;
  image: string | null;
};

export type PageContent = {
  homeHeroBody: string;
  homeHeroImage: string;
  homeStandardTitle: string;
  homeStandardBody: string;
  homeTeachTitle: string;
  homeTeachBody: string;
  homeTeachImage: string;
  homeOnboardTitle: string;
  homeOnboardBody: string;
  homeOnboardImage: string;
  howKicker: string;
  howTitle: string;
  howIntro: string;
};

export type MediaItem = {
  id: string;
  filename: string;
  mime: string;
  data: string;
};

export type Catalog = {
  site: SiteSettings;
  roles: RoleCopy[];
  tracks: Track[];
  news: NewsItem[];
  pages: PageContent;
};

export const DEFAULT_PAGES: PageContent = {
  homeHeroBody:
    "You are the first thing our Clients experience. COGS — the College of Getting Smarter — trains Specialists and managers to own the relationship, not just the sale.",
  homeHeroImage: "/media/campus-night.jpg",
  homeStandardTitle: "We don’t train Specialists to fill a role. We train them to own a relationship.",
  homeStandardBody:
    "Before any product changes hands, a Specialist changes the room. The way you greet, listen, guide, and serve determines whether a Client leaves with the right solution — or leaves at all.",
  homeTeachTitle: "Teaching is what we do to others. Training is what we do with others.",
  homeTeachBody:
    "This is a training ground, not a lecture hall. Practice, be observed, try again. If you leave a session only knowing something, we failed. If you leave able to do something with a Client tomorrow, we did our job.",
  homeTeachImage: "/media/teaching-vs-training.jpg",
  homeOnboardTitle: "Your first six weeks, on purpose.",
  homeOnboardBody:
    "New Specialists follow a six-week path from belonging to advising — Client Experience, Flow, Product, and Culture — with a professor in earshot, not in the chair.",
  homeOnboardImage: "/media/home-onboarding.jpg",
  howKicker: "Admission",
  howTitle: "How it works",
  howIntro: "COGS — the College of Getting Smarter — is a private training ground. Four steps from hire to the chair.",
};

export function withPageDefaults(pages: Partial<PageContent> | null | undefined): PageContent {
  const next = { ...DEFAULT_PAGES, ...(pages ?? {}) };
  if (
    !next.homeHeroImage ||
    next.homeHeroImage.includes("campus-front") ||
    next.homeHeroImage.includes("campus-cogs")
  ) {
    // Upgrade the previous default hero (campus-front, then campus-cogs) to the
    // current one. A hero explicitly set to any other image is left untouched.
    next.homeHeroImage = DEFAULT_PAGES.homeHeroImage;
  }
  if (!next.homeTeachImage || next.homeTeachImage.includes("campus-front")) {
    next.homeTeachImage = DEFAULT_PAGES.homeTeachImage;
  }
  if (
    !next.homeOnboardImage ||
    next.homeOnboardImage.includes("campus-front") ||
    next.homeOnboardImage === "/media/classroom.jpg"
  ) {
    // Upgrade off the old onboarding default: classroom.jpg is now a Good Feet
    // store photo used on interior pages, so the home section keeps the
    // preserved image (home-onboarding.jpg) instead.
    next.homeOnboardImage = DEFAULT_PAGES.homeOnboardImage;
  }
  if (next.homeHeroBody.includes("Waterman College trains")) {
    next.homeHeroBody = DEFAULT_PAGES.homeHeroBody;
  }
  if (next.howIntro.includes("Waterman College is a private")) {
    next.howIntro = DEFAULT_PAGES.howIntro;
  }
  if (next.homeOnboardBody.includes("a trainer in earshot")) {
    next.homeOnboardBody = next.homeOnboardBody.replace("a trainer in earshot", "a professor in earshot");
  }
  return next;
}

export const DEFAULT_SITE: SiteSettings = {
  name: defaultSite.name,
  short: defaultSite.short,
  tagline: defaultSite.tagline,
  company: defaultSite.company,
  stores: defaultSite.stores,
  adminEmail: defaultSite.adminEmail,
};

export function withSiteDefaults(site: Partial<SiteSettings> | null | undefined): SiteSettings {
  const next = { ...DEFAULT_SITE, ...(site ?? {}) };
  if (next.name === "Waterman College" || next.name === "Waterman College of Getting Smarter") {
    next.name = DEFAULT_SITE.name;
  }
  if (next.short === "WCOGS" || next.short === "Waterman") {
    next.short = DEFAULT_SITE.short;
  }
  return next;
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `item-${globalThis.crypto.randomUUID().slice(0, 8)}`;
}

function cleanText(value: unknown, label: string, max: number, required = true) {
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error(`${label} is required.`);
  if (cleaned.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return cleaned;
}

function cleanId(value: unknown, label = "Identifier") {
  const id = cleanText(value, label, 120);
  if (!/^[a-z0-9][a-z0-9:_-]*$/i.test(id)) throw new Error(`${label} is invalid.`);
  return id;
}

function safeImage(value: unknown, fallback: string | null = null): string | null {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string" || value.length > 500 || value.includes("..")) return fallback;
  if (/^\/media\/[a-z0-9_./-]+$/i.test(value)) return value;
  if (/^\/api\/media\/[0-9a-f-]{36}$/i.test(value)) return value;
  return fallback;
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function assertAdmin(userId: string) {
  const { readAccessRole } = await import("@/lib/access");
  const role = await readAccessRole(userId);
  if (role === "admin") return;
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

/**
 * Guard for the course, lesson, and uploads endpoints.
 *
 * Wider than `assertAdmin` by exactly one thing: a role that carries
 * `manageTraining` runs the trainer room and must be able to save what it edits
 * there. Site settings, pages, news, and roles stay on `assertAdmin` — managing
 * training is not editing the college.
 */
async function assertTrainingOffice(userId: string) {
  const { canManageTrainingId } = await import("@/lib/access");
  if (await canManageTrainingId(userId)) return;
  await assertAdmin(userId);
}

async function ensureTables() {
  // Compatibility shim. Schema changes belong exclusively in migrations/.
  await getSql();
}

async function seedCatalog() {
  const sql = await getSql();
  await ensureTables();
  const flag = await sql<{ value: string }>`
    select value from cms_settings where key = 'seeded'
  `;
  if (flag.length) {
    await refreshOnboardingPlan();
    await refreshSlideTracks();
    await retireStorefrontPhoto();
    return;
  }

  await sql`
    insert into cms_settings (key, value)
    values ('site', ${JSON.stringify(DEFAULT_SITE)})
    on conflict (key) do nothing
  `;
  await sql`
    insert into cms_settings (key, value)
    values ('pages', ${JSON.stringify(DEFAULT_PAGES)})
    on conflict (key) do nothing
  `;

  for (const [i, role] of defaultRoles.entries()) {
    await sql`
      insert into cms_roles (id, label, kicker, title, summary, sort_order)
      values (${role.id}, ${role.label}, ${role.kicker}, ${role.title}, ${role.summary}, ${i})
      on conflict (id) do nothing
    `;
  }

  for (const [i, track] of defaultTracks.entries()) {
    await sql`
      insert into cms_tracks (id, role, title, nav, image, audience, summary, sort_order)
      values (
        ${track.id}, ${track.role}, ${track.title}, ${track.nav}, ${track.image},
        ${track.audience}, ${track.summary}, ${i}
      )
      on conflict (id) do nothing
    `;
    for (const [j, lesson] of track.lessons.entries()) {
      const id = `${track.id}:${lesson.slug}`;
      await sql`
        insert into cms_lessons (id, track_id, slug, title, minutes, kicker, body, takeaway, sort_order)
        values (
          ${id}, ${track.id}, ${lesson.slug}, ${lesson.title}, ${lesson.minutes},
          ${lesson.kicker ?? null}, ${lesson.body.join("\n\n")}, ${lesson.takeaway ?? null}, ${j}
        )
        on conflict (id) do nothing
      `;
    }
  }

  for (const [i, tip] of defaultTips.entries()) {
    await sql`
      insert into cms_news (id, slug, title, date, body, image, sort_order)
      values (${tip.slug}, ${tip.slug}, ${tip.title}, ${tip.date}, ${tip.body}, ${null}, ${i})
      on conflict (id) do nothing
    `;
  }

  await sql`
    insert into cms_settings (key, value) values ('seeded', '1')
    on conflict (key) do nothing
  `;

  await refreshOnboardingPlan();
  await refreshSlideTracks();
  await retireStorefrontPhoto();
}

const cmsGlobal = globalThis as typeof globalThis & {
  __watermanCmsSeed__?: Promise<void>;
};

async function seedIfNeeded() {
  cmsGlobal.__watermanCmsSeed__ ??= seedCatalog().catch((error) => {
    cmsGlobal.__watermanCmsSeed__ = undefined;
    throw error;
  });
  await cmsGlobal.__watermanCmsSeed__;
}

async function refreshOnboardingPlan() {
  const sql = await getSql();
  const flag = await sql<{ value: string }>`
    select value from cms_settings where key = 'onboarding_v2'
  `;
  if (flag.length) return;
  const { ONBOARDING_TRACK } = await import("@/lib/onboarding");
  const track = ONBOARDING_TRACK;
  await sql.transaction(async (tx) => {
    const current = await tx<{ value: string }>`
      select value from cms_settings where key = 'onboarding_v2'
    `;
    if (current.length) return;
    await tx`
      update cms_tracks
      set title = ${track.title},
          nav = ${track.nav},
          audience = ${track.audience},
          summary = ${track.summary},
          role = ${track.role}
      where id = 'onboarding'
    `;
    await tx`delete from cms_lessons where track_id = 'onboarding'`;
    for (const [j, lesson] of track.lessons.entries()) {
      const id = `${track.id}:${lesson.slug}`;
      await tx`
        insert into cms_lessons (id, track_id, slug, title, minutes, kicker, body, takeaway, sort_order)
        values (
          ${id}, ${track.id}, ${lesson.slug}, ${lesson.title}, ${lesson.minutes},
          ${lesson.kicker ?? null}, ${lesson.body.join("\n\n")}, ${lesson.takeaway ?? null}, ${j}
        )
        on conflict (id) do update set
          title = excluded.title,
          minutes = excluded.minutes,
          kicker = excluded.kicker,
          body = excluded.body,
          takeaway = excluded.takeaway,
          sort_order = excluded.sort_order
      `;
    }
    await tx`
      insert into cms_settings (key, value) values ('onboarding_v2', '1')
      on conflict (key) do nothing
    `;
  });
}

async function refreshSlideTracks() {
  const sql = await getSql();
  const flag = await sql<{ value: string }>`
    select value from cms_settings where key = 'slide_tracks_v1'
  `;
  if (flag.length) return;

  const count = await sql<{ n: number }>`select count(*)::int as n from cms_tracks`;
  let order = count[0]?.n ?? 0;

  for (const track of SLIDE_TRACKS) {
    await sql`
      insert into cms_tracks (id, role, title, nav, image, audience, summary, sort_order, updated_at)
      values (
        ${track.id}, ${track.role}, ${track.title}, ${track.nav}, ${track.image},
        ${track.audience}, ${track.summary}, ${order}, now()
      )
      on conflict (id) do update set
        role = excluded.role,
        title = excluded.title,
        nav = excluded.nav,
        image = excluded.image,
        audience = excluded.audience,
        summary = excluded.summary,
        updated_at = now()
    `;
    order += 1;
    for (const [j, item] of track.lessons.entries()) {
      const id = `${track.id}:${item.slug}`;
      await sql`
        insert into cms_lessons (id, track_id, slug, title, minutes, kicker, body, takeaway, sort_order)
        values (
          ${id}, ${track.id}, ${item.slug}, ${item.title}, ${item.minutes},
          ${item.kicker ?? null}, ${item.body.join("\n\n")}, ${item.takeaway ?? null}, ${j}
        )
        on conflict (id) do update set
          title = excluded.title,
          minutes = excluded.minutes,
          kicker = excluded.kicker,
          body = excluded.body,
          takeaway = excluded.takeaway,
          sort_order = excluded.sort_order
      `;
    }
  }

  await sql`
    insert into cms_settings (key, value) values ('slide_tracks_v1', '1')
    on conflict (key) do nothing
  `;
}

async function retireStorefrontPhoto() {
  const sql = await getSql();
  const flag = await sql<{ value: string }>`
    select value from cms_settings where key = 'retire_storefront_v1'
  `;
  if (flag.length) return;

  await sql`
    update cms_tracks
    set image = '/media/campus-cogs.jpg', updated_at = now()
    where image like '%campus-front%'
  `;
  await sql`
    update cms_news
    set image = null
    where image like '%campus-front%'
  `;

  const rows = await sql<{ value: string }>`
    select value from cms_settings where key = 'pages'
  `;
  const current = parseJson<Partial<PageContent>>(rows[0]?.value, DEFAULT_PAGES);
  const next = withPageDefaults(current);
  await sql`
    insert into cms_settings (key, value) values ('pages', ${JSON.stringify(next)})
    on conflict (key) do update set value = excluded.value
  `;

  await sql`
    insert into cms_settings (key, value) values ('retire_storefront_v1', '1')
    on conflict (key) do nothing
  `;
}

export async function readCatalog(): Promise<Catalog> {
  await seedIfNeeded();
  const sql = await getSql();

  const settings = await sql<{ key: string; value: string }>`
    select key, value from cms_settings limit 50
  `;
  const map = Object.fromEntries(settings.map((r) => [r.key, r.value]));

  const roleRows = await sql<RoleCopy & { sort_order: number }>`
    select id, label, kicker, title, summary, sort_order
    from cms_roles
    order by sort_order asc, label asc
    limit 20
  `;

  const trackRows = await sql<{
    id: string;
    role: RoleId;
    title: string;
    nav: string;
    image: string;
    audience: string;
    summary: string;
    visible_to_all: boolean;
  }>`
    select id, role, title, nav, image, audience, summary, visible_to_all
    from cms_tracks
    where archived = false
    order by sort_order asc, title asc
    limit 500
  `;

  const lessonRows = await sql<{
    track_id: string;
    slug: string;
    title: string;
    minutes: number;
    kicker: string | null;
    body: string;
    takeaway: string | null;
    eval_phases: string[] | null;
  }>`
    select track_id, slug, title, minutes, kicker, body, takeaway, eval_phases
    from cms_lessons
    order by sort_order asc, title asc
    limit 10000
  `;

  const newsRows = await sql<NewsItem>`
    select id, slug, title, date, body, image
    from cms_news
    order by sort_order asc, date desc
    limit 500
  `;

  const tracks: Track[] = trackRows.map((track) => ({
    ...track,
    href: `/training/${track.id}`,
    visibleToAll: track.visible_to_all === true,
    lessons: lessonRows
      .filter((l) => l.track_id === track.id)
      .map((l) => ({
        slug: l.slug,
        title: l.title,
        minutes: Number(l.minutes) || 8,
        kicker: l.kicker || undefined,
        body: l.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
        takeaway: l.takeaway || undefined,
        slides: getDeckSlides(track.id, l.slug),
        evalPhases: Array.isArray(l.eval_phases) ? l.eval_phases.filter(Boolean) : [],
      })),
  }));

  return {
    site: withSiteDefaults(parseJson(map.site, DEFAULT_SITE)),
    roles: roleRows.length ? roleRows.map(({ ...r }) => r) : defaultRoles,
    tracks,
    news: newsRows,
    pages: withPageDefaults(parseJson(map.pages, DEFAULT_PAGES)),
  };
}

export const getPublicCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const catalog = await readCatalog();
  return {
    ...catalog,
    tracks: catalog.tracks.map((track) => ({ ...track, lessons: [] })),
  };
});

export const getCatalog = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const [{ readAccessProfile }, catalog] = await Promise.all([
      import("@/lib/access"),
      readCatalog(),
    ]);
    const profile = await readAccessProfile(context.userId);
    const assigned = new Set(profile.assignedTrackIds);
    // Whoever edits the catalog has to be able to see all of it, not just the
    // paths their own position is on.
    if (profile.canManageTraining) return catalog;
    return {
      ...catalog,
      tracks: catalog.tracks.filter(
        (track) =>
          track.visibleToAll ||
          profile.allowedTabs.includes(track.role) ||
          assigned.has(track.id),
      ),
    };
  });

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureTables();
    const { readAccessRole } = await import("@/lib/access");
    if ((await readAccessRole(context.userId)) === "admin") return true;
    const sql = await getSql();
    const rows = await sql<{ user_id: string }>`
      select user_id from admin_unlocks
      where user_id = ${context.userId} and expires_at > now()
      limit 1
    `;
    return rows.length > 0;
  });

export const unlockAdmin = createServerFn({ method: "POST" })
  .validator((value: string) => {
    if (typeof value !== "string" || value.length > 256) throw new Error("Invalid password.");
    return value;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: password }) => {
    const { assertRateLimit } = await import("@/lib/rate-limit.server");
    assertRateLimit("admin-unlock", context.userId, { max: 5, windowMs: 15 * 60_000 });
    const { verifyAdminPassword } = await import("./admin-secret.server");
    if (!verifyAdminPassword(password)) throw new Error("Wrong password");
    await ensureTables();
    const sql = await getSql();
    await sql`
      insert into admin_unlocks (user_id, unlocked_at, expires_at)
      values (${context.userId}, now(), now() + interval '15 minutes')
      on conflict (user_id) do update set
        unlocked_at = now(), expires_at = now() + interval '15 minutes'
    `;
    return true;
  });

export const lockAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`delete from admin_unlocks where user_id = ${context.userId}`;
    return true;
  });

export const saveSite = createServerFn({ method: "POST" })
  .validator((site: SiteSettings) => {
    if (!site || typeof site !== "object") throw new Error("Site settings are required.");
    return {
      name: cleanText(site.name, "Site name", 120),
      short: cleanText(site.short, "Short name", 40),
      tagline: cleanText(site.tagline ?? "", "Tagline", 240, false),
      company: cleanText(site.company ?? "", "Company", 120, false),
      stores: Math.max(0, Math.min(10_000, Number(site.stores) || 0)),
      adminEmail: cleanText(site.adminEmail ?? "", "Admin email", 254, false),
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: site }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    const next: SiteSettings = {
      name: site.name,
      short: site.short,
      tagline: site.tagline,
      company: site.company,
      stores: site.stores,
      adminEmail: site.adminEmail,
    };
    await sql`
      insert into cms_settings (key, value) values ('site', ${JSON.stringify(next)})
      on conflict (key) do update set value = excluded.value
    `;
    return readCatalog();
  });

export const saveRoles = createServerFn({ method: "POST" })
  .validator((items: RoleCopy[]) => {
    if (!Array.isArray(items) || items.length > 20) throw new Error("Invalid role copy.");
    return items.map((role) => {
      if (!isRoleId(role?.id)) throw new Error("Unknown training path.");
      return {
        id: role.id,
        label: cleanText(role.label, "Label", 80),
        kicker: cleanText(role.kicker ?? "", "Kicker", 120, false),
        title: cleanText(role.title, "Title", 180),
        summary: cleanText(role.summary ?? "", "Summary", 2_000, false),
      };
    });
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: items }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    for (const [i, role] of items.entries()) {
      await sql`
        insert into cms_roles (id, label, kicker, title, summary, sort_order)
        values (${role.id}, ${role.label}, ${role.kicker}, ${role.title}, ${role.summary}, ${i})
        on conflict (id) do update set
          label = excluded.label,
          kicker = excluded.kicker,
          title = excluded.title,
          summary = excluded.summary,
          sort_order = excluded.sort_order
      `;
    }
    return readCatalog();
  });

export const savePages = createServerFn({ method: "POST" })
  .validator((pages: PageContent) => {
    if (!pages || typeof pages !== "object") throw new Error("Page copy is required.");
    const next = withPageDefaults(pages);
    return {
      homeHeroBody: cleanText(next.homeHeroBody, "Hero paragraph", 5_000),
      homeHeroImage: safeImage(next.homeHeroImage, DEFAULT_PAGES.homeHeroImage)!,
      homeStandardTitle: cleanText(next.homeStandardTitle, "Standard title", 300),
      homeStandardBody: cleanText(next.homeStandardBody, "Standard body", 5_000),
      homeTeachTitle: cleanText(next.homeTeachTitle, "Teaching title", 300),
      homeTeachBody: cleanText(next.homeTeachBody, "Teaching body", 5_000),
      homeTeachImage: safeImage(next.homeTeachImage, DEFAULT_PAGES.homeTeachImage)!,
      homeOnboardTitle: cleanText(next.homeOnboardTitle, "Onboarding title", 300),
      homeOnboardBody: cleanText(next.homeOnboardBody, "Onboarding body", 5_000),
      homeOnboardImage: safeImage(next.homeOnboardImage, DEFAULT_PAGES.homeOnboardImage)!,
      howKicker: cleanText(next.howKicker, "How kicker", 120),
      howTitle: cleanText(next.howTitle, "How title", 300),
      howIntro: cleanText(next.howIntro, "How intro", 5_000),
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: pages }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    await sql`
      insert into cms_settings (key, value) values ('pages', ${JSON.stringify(withPageDefaults(pages))})
      on conflict (key) do update set value = excluded.value
    `;
    return readCatalog();
  });

export const saveNews = createServerFn({ method: "POST" })
  .validator((item: NewsItem) => {
    if (!item || typeof item !== "object") throw new Error("Post details are required.");
    return {
      id: item.id ? cleanId(item.id, "Post") : "",
      slug: item.slug ? cleanId(item.slug, "Post slug") : "",
      title: cleanText(item.title, "Post title", 240),
      date: cleanText(item.date, "Post date", 40),
      body: cleanText(item.body, "Post body", 50_000),
      image: safeImage(item.image),
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: item }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    const id = item.id || slugify(item.title);
    const slug = item.slug || id;
    await sql`
      insert into cms_news (id, slug, title, date, body, image, sort_order, updated_at)
      values (
        ${id}, ${slug}, ${item.title}, ${item.date}, ${item.body},
        ${item.image || null}, ${0}, now()
      )
      on conflict (id) do update set
        slug = excluded.slug,
        title = excluded.title,
        date = excluded.date,
        body = excluded.body,
        image = excluded.image,
        updated_at = now()
    `;
    void import("@/lib/notify")
      .then(({ dispatchNotice }) =>
        dispatchNotice({
          kind: "remarkable",
          title: item.title,
          body: item.body.slice(0, 200),
          href: "/remarkable",
          exceptUserId: context.userId,
        }),
      )
      .catch(() => undefined);
    return readCatalog();
  });

export const deleteNews = createServerFn({ method: "POST" })
  .validator((id: string) => cleanId(id, "Post"))
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }) => {
    await assertAdmin(context.userId);
    const sql = await getSql();
    await sql`delete from cms_news where id = ${id}`;
    return readCatalog();
  });

export type TrackInput = {
  id: string;
  role: RoleId;
  title: string;
  nav: string;
  image: string;
  audience: string;
  summary: string;
  visibleToAll?: boolean;
};

export const saveTrack = createServerFn({ method: "POST" })
  .validator((track: TrackInput) => {
    if (!track || typeof track !== "object") throw new Error("Course details are required.");
    if (!isRoleId(track.role)) throw new Error("Choose a valid training path.");
    const title = cleanText(track.title, "Course title", 240);
    return {
      id: track.id ? cleanId(track.id, "Course") : "",
      role: track.role,
      title,
      nav: cleanText(track.nav || title, "Navigation label", 120),
      image: safeImage(track.image, "/media/3-step-open.jpg")!,
      audience: cleanText(track.audience ?? "", "Audience", 500, false),
      summary: cleanText(track.summary ?? "", "Summary", 5_000, false),
      visibleToAll: track.visibleToAll === true,
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: track }) => {
    await assertTrainingOffice(context.userId);
    const sql = await getSql();
    const id = track.id || slugify(track.title);
    const count = await sql<{ n: number }>`select count(*)::int as n from cms_tracks`;
    await sql`
      insert into cms_tracks (id, role, title, nav, image, audience, summary, sort_order, updated_at, visible_to_all)
      values (
        ${id}, ${track.role}, ${track.title}, ${track.nav},
        ${track.image}, ${track.audience}, ${track.summary}, ${count[0]?.n ?? 0}, now(), ${track.visibleToAll}
      )
      on conflict (id) do update set
        role = excluded.role,
        title = excluded.title,
        nav = excluded.nav,
        image = excluded.image,
        audience = excluded.audience,
        summary = excluded.summary,
        visible_to_all = excluded.visible_to_all,
        updated_at = now()
    `;
    const { writeAudit } = await import("@/lib/rbac");
    await writeAudit(context.userId, "", "training.saved", `${track.title} (${id})`);
    return readCatalog();
  });

export const deleteTrack = createServerFn({ method: "POST" })
  .validator((id: string) => cleanId(id, "Course"))
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }) => {
    await assertTrainingOffice(context.userId);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      await tx`delete from cms_lessons where track_id = ${id}`;
      await tx`delete from cms_tracks where id = ${id}`;
    });
    const { writeAudit } = await import("@/lib/rbac");
    await writeAudit(context.userId, "Chancellor", "training.removed", id);
    return readCatalog();
  });

export const archiveTrack = createServerFn({ method: "POST" })
  .validator((input: { id: string; archived: boolean }) => ({
    id: cleanId(input?.id, "Course"),
    archived: Boolean(input?.archived),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await assertTrainingOffice(context.userId);
    const sql = await getSql();
    await sql`
      update cms_tracks set archived = ${data.archived}, updated_at = now() where id = ${data.id}
    `;
    const { writeAudit } = await import("@/lib/rbac");
    await writeAudit(context.userId, "Chancellor", data.archived ? "training.archived" : "training.restored", data.id);
    return readCatalog();
  });

export const listOfficeTracks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertTrainingOffice(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      role: RoleId;
      title: string;
      summary: string;
      archived: boolean;
      updated_at: string | Date | null;
      lessons: number;
      visible_to_all: boolean;
    }>`
      select
        t.id, t.role, t.title, t.summary, t.archived, t.updated_at, t.visible_to_all,
        (select count(*)::int from cms_lessons l where l.track_id = t.id) as lessons
      from cms_tracks t
      order by t.archived asc, t.sort_order asc, t.title asc
      limit 1000
    `;
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      title: row.title,
      summary: row.summary,
      archived: row.archived,
      updatedAt: row.updated_at ? String(row.updated_at).slice(0, 10) : "",
      lessons: row.lessons,
      visibleToAll: row.visible_to_all === true,
    }));
  });

export type LessonInput = {
  trackId: string;
  slug: string;
  title: string;
  minutes: number;
  kicker: string;
  body: string;
  takeaway: string;
  /** Presentation phases this lesson maps to for auto-suggestions. */
  evalPhases?: string[];
};

export const saveLesson = createServerFn({ method: "POST" })
  .validator((lesson: LessonInput) => {
    if (!lesson || typeof lesson !== "object") throw new Error("Lesson details are required.");
    const title = cleanText(lesson.title, "Lesson title", 240);
    const minutes = Number(lesson.minutes);
    return {
      trackId: cleanId(lesson.trackId, "Course"),
      slug: lesson.slug ? cleanId(lesson.slug, "Lesson slug") : "",
      title,
      minutes: Number.isFinite(minutes) ? Math.max(1, Math.min(480, Math.round(minutes))) : 8,
      kicker: cleanText(lesson.kicker ?? "", "Kicker", 240, false),
      body: cleanText(lesson.body, "Lesson body", 100_000),
      takeaway: cleanText(lesson.takeaway ?? "", "Takeaway", 5_000, false),
      evalPhases: Array.isArray(lesson.evalPhases)
        ? lesson.evalPhases
            .map((p) => String(p).trim().toLowerCase())
            .filter((p) =>
              ["welcome", "interview", "analysis", "fitting", "solution", "close"].includes(p),
            )
            .slice(0, 6)
        : [],
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: lesson }) => {
    await assertTrainingOffice(context.userId);
    const sql = await getSql();
    const slug = lesson.slug || slugify(lesson.title);
    const id = `${lesson.trackId}:${slug}`;
    const count = await sql<{ n: number }>`
      select count(*)::int as n from cms_lessons where track_id = ${lesson.trackId}
    `;
    const phases = lesson.evalPhases ?? [];
    await sql`
      insert into cms_lessons (id, track_id, slug, title, minutes, kicker, body, takeaway, sort_order, eval_phases)
      values (
        ${id}, ${lesson.trackId}, ${slug}, ${lesson.title},
        ${lesson.minutes}, ${lesson.kicker || null},
        ${lesson.body}, ${lesson.takeaway || null}, ${count[0]?.n ?? 0},
        ${phases}
      )
      on conflict (id) do update set
        title = excluded.title,
        minutes = excluded.minutes,
        kicker = excluded.kicker,
        body = excluded.body,
        takeaway = excluded.takeaway,
        eval_phases = excluded.eval_phases
    `;
    const { writeAudit } = await import("@/lib/rbac");
    await writeAudit(context.userId, "", "lesson.saved", `${lesson.trackId}/${slug} — ${lesson.title}`);
    return readCatalog();
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .validator((input: { trackId: string; slug: string }) => ({
    trackId: cleanId(input?.trackId, "Course"),
    slug: cleanId(input?.slug, "Lesson"),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await assertTrainingOffice(context.userId);
    const sql = await getSql();
    await sql`delete from cms_lessons where track_id = ${data.trackId} and slug = ${data.slug}`;
    const { writeAudit } = await import("@/lib/rbac");
    await writeAudit(context.userId, "", "lesson.removed", `${data.trackId}/${data.slug}`);
    return readCatalog();
  });

function detectedImageMime(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    )
  ) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const head = String.fromCharCode(...bytes.slice(0, 12));
  if (head.startsWith("GIF87a") || head.startsWith("GIF89a")) return "image/gif";
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

export const uploadMedia = createServerFn({ method: "POST" })
  .validator((input: { filename: string; mime: string; data: string }) => ({
    filename: cleanText(input?.filename, "Filename", 255),
    mime: cleanText(input?.mime, "Image type", 80),
    data: cleanText(input?.data, "Image data", 2_100_000),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data: input }) => {
    await assertTrainingOffice(context.userId);
    const raw = input.data.includes(",") ? input.data.slice(input.data.indexOf(",") + 1) : input.data;
    if (!/^[a-z0-9+/]+={0,2}$/i.test(raw) || raw.length % 4 !== 0) {
      throw new Error("The image data is invalid.");
    }
    const { Buffer } = await import("node:buffer");
    const bytes = Buffer.from(raw, "base64");
    if (!bytes.length || bytes.length > 1_500_000) {
      throw new Error("Image is too large (keep under 1.5 MB).");
    }
    const mime = detectedImageMime(bytes);
    if (!mime || mime !== input.mime.toLowerCase()) {
      throw new Error("The file must be a valid PNG, JPEG, GIF, or WebP image.");
    }
    const sql = await getSql();
    const id = globalThis.crypto.randomUUID();
    await sql`
      insert into cms_media (id, filename, mime, data)
      values (${id}, ${input.filename}, ${mime}, ${raw})
    `;
    return { id, url: `/api/media/${id}`, filename: input.filename };
  });

/**
 * Any signed-in user may set their own profile photo (no admin needed). Same
 * validation as uploadMedia — base64, size cap, magic-byte MIME check — then
 * store it and point the account's image at it.
 */
export const setMyProfilePhoto = createServerFn({ method: "POST" })
  .validator((input: { filename: string; mime: string; data: string }) => ({
    filename: cleanText(input?.filename, "Filename", 255),
    mime: cleanText(input?.mime, "Image type", 80),
    data: cleanText(input?.data, "Image data", 2_100_000),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data: input }) => {
    const raw = input.data.includes(",") ? input.data.slice(input.data.indexOf(",") + 1) : input.data;
    if (!/^[a-z0-9+/]+={0,2}$/i.test(raw) || raw.length % 4 !== 0) {
      throw new Error("The image data is invalid.");
    }
    const { Buffer } = await import("node:buffer");
    const bytes = Buffer.from(raw, "base64");
    if (!bytes.length || bytes.length > 1_500_000) {
      throw new Error("Image is too large (keep under 1.5 MB).");
    }
    const mime = detectedImageMime(bytes);
    if (!mime || mime !== input.mime.toLowerCase()) {
      throw new Error("The file must be a valid PNG, JPEG, GIF, or WebP image.");
    }
    const sql = await getSql();
    const id = globalThis.crypto.randomUUID();
    const url = `/api/media/${id}`;
    await sql`insert into cms_media (id, filename, mime, data) values (${id}, ${input.filename}, ${mime}, ${raw})`;
    await sql`update "user" set image = ${url}, "updatedAt" = now() where id = ${context.userId}`;
    return { url };
  });

export const removeMyProfilePhoto = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update "user" set image = null, "updatedAt" = now() where id = ${context.userId}`;
    return { ok: true };
  });

export const listMedia = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertTrainingOffice(context.userId);
    const sql = await getSql();
    const rows = await sql<Omit<MediaItem, "data">>`
      select id, filename, mime from cms_media
      order by created_at desc
      limit 100
    `;
    return rows.map((row): MediaItem => ({ ...row, data: `/api/media/${row.id}` }));
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .validator((id: string) => {
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
      throw new Error("Invalid media item.");
    }
    return id;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }) => {
    await assertTrainingOffice(context.userId);
    const sql = await getSql();
    await sql`delete from cms_media where id = ${id}`;
    return true;
  });
