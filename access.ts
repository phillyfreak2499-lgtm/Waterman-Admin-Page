import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isRoleId, type RoleId } from "@/lib/content";
import { getSql } from "@/lib/db";
import { ALL_OFF_PERMS, type Perms } from "@/lib/perms";

export type AccessRole =
  | "pending"
  | "new-hires"
  | "specialist"
  | "mit"
  | "managers"
  | "regional"
  | "trainer"
  | "sales-manager"
  | "ceo"
  | "admin";

export type AccessProfile = {
  userId: string;
  role: AccessRole;
  store: string | null;
  title: string | null;
  reportsTo: string | null;
  allowedTabs: RoleId[];
  assignedTrackIds: string[];
  isAdmin: boolean;
  isChancellor: boolean;
  canManagePeople: boolean;
  canSeeCompany: boolean;
  canManageTraining: boolean;
  perms: Perms;
  rbacRoleId: string | null;
  mustChangePassword: boolean;
};

export const ACCESS_ROLES: { id: AccessRole; label: string; blurb: string; rank: number }[] = [
  { id: "pending", label: "Awaiting assignment", blurb: "Signed in, not yet placed.", rank: 0 },
  { id: "new-hires", label: "New Hire", blurb: "First six weeks only.", rank: 1 },
  { id: "specialist", label: "Arch Support Specialist", blurb: "Onboarding plus Specialist Training.", rank: 1 },
  { id: "mit", label: "MIT", blurb: "Approved for the MIT path.", rank: 1 },
  { id: "managers", label: "Manager", blurb: "A store team and their training.", rank: 2 },
  { id: "regional", label: "Regional / DM", blurb: "Managers and every Specialist under them.", rank: 3 },
  { id: "trainer", label: "Professor", blurb: "The whole company.", rank: 4 },
  { id: "sales-manager", label: "Sales Manager", blurb: "The whole company.", rank: 4 },
  { id: "ceo", label: "CEO", blurb: "The whole company.", rank: 4 },
  { id: "admin", label: "Training office", blurb: "Campus, people, and the site.", rank: 5 },
];

const ACCESS_IDS: AccessRole[] = ACCESS_ROLES.map((r) => r.id);

export function isAccessRole(value: unknown): value is AccessRole {
  return typeof value === "string" && (ACCESS_IDS as string[]).includes(value);
}

export function accessLabel(role: AccessRole) {
  return ACCESS_ROLES.find((r) => r.id === role)?.label ?? role;
}

export function roleRank(role: AccessRole) {
  return ACCESS_ROLES.find((r) => r.id === role)?.rank ?? 0;
}

export function isContributor(role: AccessRole) {
  return role === "new-hires" || role === "specialist" || role === "mit" || role === "pending";
}

export function isLeader(role: AccessRole) {
  return roleRank(role) >= 2;
}

export function isOrgWide(role: AccessRole) {
  return roleRank(role) >= 4;
}

export function allowedTabs(role: AccessRole): RoleId[] {
  switch (role) {
    case "pending":
      return [];
    case "new-hires":
      return ["new-hires"];
    case "specialist":
      return ["new-hires", "specialist"];
    case "mit":
      return ["new-hires", "specialist", "mit"];
    case "managers":
    case "regional":
    case "trainer":
    case "sales-manager":
    case "ceo":
    case "admin":
      return ["new-hires", "specialist", "mit", "managers"];
  }
}

export function canAccessTab(role: AccessRole, tab: RoleId) {
  return allowedTabs(role).includes(tab);
}

export function tabsFromPerms(perms: Perms): RoleId[] {
  const tabs: RoleId[] = [];
  if (perms.trainNewHires) tabs.push("new-hires");
  if (perms.trainSpecialist) tabs.push("specialist");
  if (perms.trainMit) tabs.push("mit");
  if (perms.trainManagers) tabs.push("managers");
  return tabs;
}

export function canManagePeople(role: AccessRole) {
  return isLeader(role);
}

/**
 * Who may run the trainer room.
 *
 * A custom RBAC role decides for itself: the `manageTraining` permission is the
 * whole answer, so a role with nothing else ticked still gets in. Without a
 * custom role we fall back to the position — the Professor, the training
 * office, and anyone company-wide.
 *
 * Deliberately independent of `canSeeCompany`: managing training is not
 * managing people or the site, and must not drag those along with it.
 */
export function canManageTrainingFrom(role: AccessRole, perms?: Perms): boolean {
  if (perms) return perms.manageTraining;
  return role === "trainer" || role === "admin" || isOrgWide(role);
}

export function assignableRoles(actor: AccessRole): AccessRole[] {
  if (actor === "admin") return [...ACCESS_IDS];
  if (isOrgWide(actor)) {
    return ACCESS_IDS.filter((id) => id !== "admin");
  }
  if (actor === "regional") {
    return ["pending", "new-hires", "specialist", "mit", "managers"];
  }
  if (actor === "managers") {
    return ["pending", "new-hires", "specialist", "mit"];
  }
  return [];
}

export type DirectoryPerson = {
  id: string;
  name: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  title: string;
  accountStatus: "pending" | "approved" | "denied" | "deactivated";
  createdAt: string;
  lastLogin: string | null;
  role: AccessRole;
  rbacRoleId: string | null;
  store: string | null;
  reportsTo: string | null;
};

export async function ensureProfileTable() {
  // Compatibility shim. Migrations are the only schema source of truth.
  await getSql();
}

export async function readAccessRole(userId: string): Promise<AccessRole> {
  await ensureProfileTable();
  if (!userId || userId.length > 120) throw new Error("Invalid user.");
  const sql = await getSql();
  const rows = await sql<{ access_role: string }>`
    select access_role from user_profiles where user_id = ${userId}
  `;
  const role = rows[0]?.access_role;
  return isAccessRole(role) ? role : "pending";
}

export async function writeAccessRole(
  userId: string,
  role: AccessRole,
  opts?: { store?: string | null; assignedBy?: string; reportsTo?: string | null },
) {
  await ensureProfileTable();
  if (!userId || userId.length > 120) throw new Error("Invalid user.");
  if (!isAccessRole(role)) throw new Error("Unknown position.");
  const sql = await getSql();
  const reportsTo = opts?.reportsTo === undefined ? undefined : opts.reportsTo || null;
  const status = role === "pending" ? "pending" : "approved";
  if (reportsTo === undefined) {
    await sql`
      insert into user_profiles (user_id, access_role, store, assigned_by, assigned_at, account_status, created_at)
      values (
        ${userId}, ${role}, ${opts?.store ?? null}, ${opts?.assignedBy ?? null}, now(), ${status}, now()
      )
      on conflict (user_id) do update set
        access_role = excluded.access_role,
        store = coalesce(excluded.store, user_profiles.store),
        assigned_by = excluded.assigned_by,
        assigned_at = now(),
        account_status = excluded.account_status
    `;
    return;
  }
  await sql`
    insert into user_profiles (user_id, access_role, store, assigned_by, assigned_at, reports_to, account_status, created_at)
    values (
      ${userId}, ${role}, ${opts?.store ?? null}, ${opts?.assignedBy ?? null}, now(), ${reportsTo}, ${status}, now()
    )
    on conflict (user_id) do update set
      access_role = excluded.access_role,
      store = coalesce(excluded.store, user_profiles.store),
      assigned_by = excluded.assigned_by,
      assigned_at = now(),
      reports_to = excluded.reports_to,
      account_status = excluded.account_status
  `;
}

async function assignedTrackIdsFor(userId: string): Promise<string[]> {
  const sql = await getSql();
  const rows = await sql<{ track_id: string }>`
    select track_id from training_assignments where user_id = ${userId} limit 500
  `;
  return rows.map((r) => r.track_id);
}

function toProfile(
  userId: string,
  role: AccessRole,
  store: string | null,
  reportsTo: string | null,
  assignedTrackIds: string[],
  extra?: {
    title?: string | null;
    isChancellor?: boolean;
    perms?: Perms;
    rbacRoleId?: string | null;
    mustChangePassword?: boolean;
  },
): AccessProfile {
  const perms = extra?.perms ?? (role === "admin" ? { ...ALL_OFF_PERMS, chancellor: false } : ALL_OFF_PERMS);
  const fromPerms = extra?.perms ? tabsFromPerms(extra.perms) : allowedTabs(role);
  return {
    userId,
    role,
    store,
    title: extra?.title ?? null,
    reportsTo,
    allowedTabs: extra?.perms ? fromPerms : allowedTabs(role),
    assignedTrackIds,
    isAdmin: role === "admin" || Boolean(extra?.isChancellor),
    isChancellor: Boolean(extra?.isChancellor),
    canManagePeople: extra?.perms ? extra.perms.manageUsers : canManagePeople(role),
    canSeeCompany: extra?.perms ? extra.perms.manageUsers || extra.perms.editSite : isOrgWide(role) || role === "admin",
    canManageTraining: canManageTrainingFrom(role, extra?.perms),
    perms,
    rbacRoleId: extra?.rbacRoleId ?? null,
    mustChangePassword: Boolean(extra?.mustChangePassword),
  };
}

export async function readAccessProfile(userId: string): Promise<AccessProfile> {
  if (!userId || userId.length > 120) throw new Error("Invalid user.");
  const sql = await getSql();
  const rows = await sql<{
    access_role: string;
    store: string | null;
    reports_to: string | null;
    title: string | null;
    rbac_role: string | null;
    account_status: string | null;
    must_change_password: boolean;
  }>`
    select access_role, store, reports_to, title, rbac_role, account_status,
           must_change_password
    from user_profiles where user_id = ${userId} limit 1
  `;
  const row = rows[0];
  if (!row) {
    await sql`
      insert into user_profiles (user_id, access_role, account_status, created_at)
      values (${userId}, 'pending', 'pending', now())
      on conflict (user_id) do nothing
    `;
    return toProfile(userId, "pending", null, null, []);
  }
  const isChancellor = row.rbac_role === "super-admin";
  const blocked =
    !isChancellor &&
    (row.account_status === "pending" ||
      row.account_status === "denied" ||
      row.account_status === "deactivated");
  if (blocked) {
    return toProfile(userId, "pending", row.store, row.reports_to, [], {
      title: row.title,
      mustChangePassword: row.must_change_password,
    });
  }
  const role = isAccessRole(row.access_role) ? row.access_role : "pending";
  const { loadRole } = await import("@/lib/rbac");
  const rbac = await loadRole(isChancellor ? "super-admin" : row.rbac_role);
  return toProfile(
    userId,
    isChancellor ? "admin" : role,
    row.store,
    row.reports_to,
    await assignedTrackIdsFor(userId),
    {
      title: row.title,
      isChancellor,
      perms: rbac?.perms,
      rbacRoleId: rbac?.id ?? row.rbac_role,
      mustChangePassword: row.must_change_password,
    },
  );
}

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => readAccessProfile(context.userId));

export async function fetchPeople(): Promise<DirectoryPerson[]> {
  await ensureProfileTable();
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    email: string;
    created_at: unknown;
    access_role: string | null;
    store: string | null;
    reports_to: string | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    account_status: string | null;
    title: string | null;
    rbac_role: string | null;
    last_login_at: unknown;
  }>`
    select
      u.id,
      u.name,
      u.email,
      u."createdAt" as created_at,
      p.access_role,
      p.store,
      p.reports_to,
      p.username,
      p.first_name,
      p.last_name,
      p.account_status,
      p.title,
      p.rbac_role,
      p.last_login_at
    from "user" u
    left join user_profiles p on p.user_id = u.id
    order by
      case coalesce(p.account_status, case coalesce(p.access_role, 'pending') when 'pending' then 'pending' else 'approved' end)
        when 'pending' then 0
        when 'denied' then 1
        else 2
      end,
      u.name asc
    limit 2000
  `;
  return rows.map((row): DirectoryPerson => {
    const role = isAccessRole(row.access_role) ? row.access_role : "pending";
    const status =
      row.account_status === "approved" ||
      row.account_status === "denied" ||
      row.account_status === "pending" ||
      row.account_status === "deactivated"
        ? row.account_status
        : role === "pending"
          ? "pending"
          : "approved";
    const username =
      row.username?.trim() ||
      (row.email?.endsWith("@accounts.waterman") ? row.email.slice(0, -"@accounts.waterman".length) : "");
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      username,
      firstName: row.first_name?.trim() || row.name.split(" ")[0] || "",
      lastName: row.last_name?.trim() || row.name.split(" ").slice(1).join(" ") || "",
      title: row.title?.trim() || "",
      accountStatus: status,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at ?? ""),
      lastLogin:
        row.last_login_at instanceof Date
          ? row.last_login_at.toISOString()
          : row.last_login_at
            ? String(row.last_login_at)
            : null,
      role,
      rbacRoleId: row.rbac_role,
      store: row.store,
      reportsTo: row.reports_to,
    };
  });
}

export function childIdsOf(people: DirectoryPerson[], rootId: string): Set<string> {
  const byBoss = new Map<string, string[]>();
  for (const person of people) {
    if (!person.reportsTo) continue;
    const list = byBoss.get(person.reportsTo) ?? [];
    list.push(person.id);
    byBoss.set(person.reportsTo, list);
  }
  const out = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const child of byBoss.get(id) ?? []) {
      if (out.has(child)) continue;
      out.add(child);
      stack.push(child);
    }
  }
  return out;
}

export function visiblePeople(actorId: string, actorRole: AccessRole, people: DirectoryPerson[]) {
  if (isOrgWide(actorRole) || actorRole === "admin") return people;
  if (!isLeader(actorRole)) return people.filter((p) => p.id === actorId);
  const tree = childIdsOf(people, actorId);
  return people.filter(
    (p) =>
      p.id === actorId ||
      tree.has(p.id) ||
      p.role === "pending" ||
      (isContributor(p.role) && !p.reportsTo && actorRole === "managers") ||
      (roleRank(p.role) < roleRank(actorRole) && !p.reportsTo && actorRole === "regional"),
  );
}

export function wouldCycle(people: DirectoryPerson[], userId: string, reportsTo: string | null) {
  if (!reportsTo) return false;
  if (reportsTo === userId) return true;
  const kids = childIdsOf(people, userId);
  return kids.has(reportsTo);
}

export const listPeople = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const actor = await readAccessRole(context.userId);
    if (!canManagePeople(actor)) throw new Error("Forbidden");
    const people = await fetchPeople();
    return visiblePeople(context.userId, actor, people);
  });

export const assignAccess = createServerFn({ method: "POST" })
  .validator((input: { userId: string; role: AccessRole; store?: string; reportsTo?: string | null }) => {
    if (!input || typeof input !== "object") throw new Error("Assignment details are required.");
    if (typeof input.userId !== "string" || !input.userId || input.userId.length > 120) {
      throw new Error("Invalid user.");
    }
    if (!isAccessRole(input.role)) throw new Error("Unknown position.");
    if (input.store != null && (typeof input.store !== "string" || input.store.length > 120)) {
      throw new Error("Store name is too long.");
    }
    if (input.reportsTo != null && (typeof input.reportsTo !== "string" || input.reportsTo.length > 120)) {
      throw new Error("Invalid manager.");
    }
    return input;
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const actor = await readAccessRole(context.userId);
    const allowed = assignableRoles(actor);
    if (!allowed.includes(data.role)) throw new Error("You cannot assign that role");
    const people = await fetchPeople();
    const visible = visiblePeople(context.userId, actor, people);
    if (!visible.some((p) => p.id === data.userId) && !isOrgWide(actor) && actor !== "admin") {
      throw new Error("That person is not on your team");
    }
    let reportsTo = data.reportsTo === undefined ? undefined : data.reportsTo || null;
    if (reportsTo === undefined && isContributor(data.role) && actor === "managers") {
      reportsTo = context.userId;
    }
    if (reportsTo && wouldCycle(people, data.userId, reportsTo)) {
      throw new Error("That reporting line would loop");
    }
    await writeAccessRole(data.userId, data.role, {
      store: data.store?.trim() || null,
      assignedBy: context.userId,
      reportsTo,
    });
    return visiblePeople(context.userId, actor, await fetchPeople());
  });

/** True when this account may run the trainer room. Server-side source of truth. */
export async function canManageTrainingId(userId: string): Promise<boolean> {
  const profile = await readAccessProfile(userId);
  return profile.canManageTraining;
}

/**
 * Guard for anything the trainer room reads or writes. Hiding a tab is not a
 * permission check — every server function behind one calls this.
 */
export async function assertCanManageTraining(userId: string) {
  if (await canManageTrainingId(userId)) return;
  throw new Error("Only the training office can do that.");
}

export async function assertCanViewPerson(actorId: string, targetId: string) {
  if (actorId === targetId) return;
  const actor = await readAccessRole(actorId);
  if (isOrgWide(actor) || actor === "admin") return;
  if (await canManageTrainingId(actorId)) return;
  const people = await fetchPeople();
  const visible = visiblePeople(actorId, actor, people);
  if (!visible.some((p) => p.id === targetId)) throw new Error("Forbidden");
}

export async function assertTrackAccess(userId: string, trackId: string) {
  if (!trackId || trackId.length > 120) throw new Error("Invalid course.");
  const profile = await readAccessProfile(userId);
  const sql = await getSql();
  const assigned = await sql<{ track_id: string }>`
    select track_id from training_assignments
    where user_id = ${userId} and track_id = ${trackId}
    limit 1
  `;
  if (assigned.length) return;
  const rows = await sql<{ role: string; visible_to_all: boolean }>`
    select role, visible_to_all from cms_tracks where id = ${trackId} and archived = false limit 1
  `;
  if (rows[0]?.visible_to_all) return;
  const tab = rows[0]?.role;
  if (!tab || !isRoleId(tab) || !profile.allowedTabs.includes(tab)) {
    throw new Error("This course is not on your path");
  }
}
