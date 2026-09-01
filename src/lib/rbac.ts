import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { isAccessRole, type AccessRole } from "@/lib/access";
import { getSql } from "@/lib/db";
import { ALL_OFF_PERMS, parsePerms, SUPER_PERMS, type Perms } from "@/lib/perms";

export type { Perms };
export { ALL_OFF_PERMS, parsePerms, SUPER_PERMS };

export type RbacRole = {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  accessRole: AccessRole;
  perms: Perms;
};

const MAX_ROLES = 100;

function cleanText(value: unknown, label: string, max: number, required = true) {
  if (typeof value !== "string") throw new Error(`${label} is required.`);
  const cleaned = value.trim();
  if (required && !cleaned) throw new Error(`${label} is required.`);
  if (cleaned.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return cleaned;
}

function cleanId(value: unknown, label = "Identifier") {
  const id = cleanText(value, label, 80);
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) throw new Error(`${label} is invalid.`);
  return id;
}

function safePerms(value: unknown): Perms {
  if (typeof value !== "string") return parsePerms({});
  try {
    return parsePerms(JSON.parse(value));
  } catch {
    return parsePerms({});
  }
}

export function slugifyRole(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || `role-${globalThis.crypto.randomUUID().slice(0, 8)}`
  );
}

/** Schema and default roles are installed by migrations, never on a request. */
export async function ensureRbac() {
  await getSql();
}

/** The old HTTP bootstrap was intentionally removed. Use the token-protected setup script. */
export async function seedSuperAdmin(): Promise<never> {
  throw new Error("Provision the Chancellor with npm run provision:chancellor.");
}

export async function writeAudit(
  actorId: string,
  _actorName: string,
  action: string,
  detail: string,
) {
  cleanText(actorId, "Actor", 120);
  const safeAction = cleanText(action, "Action", 120);
  const safeDetail = cleanText(detail, "Detail", 2_000, false);
  const sql = await getSql();
  const actor = await sql<{ actor_name: string | null }>`
    select coalesce(
      nullif(trim(concat_ws(' ', first_name, last_name)), ''),
      nullif(username, ''),
      'Unknown'
    ) as actor_name
    from user_profiles
    where user_id = ${actorId}
    limit 1
  `;
  await sql`
    insert into audit_log (id, actor_id, actor_name, action, detail)
    values (
      ${globalThis.crypto.randomUUID()}, ${actorId},
      ${actor[0]?.actor_name ?? "Unknown"}, ${safeAction}, ${safeDetail}
    )
  `;
}

export async function isChancellorId(userId: string) {
  const id = cleanText(userId, "User", 120);
  const sql = await getSql();
  const rows = await sql<{ rbac_role: string | null }>`
    select rbac_role
    from user_profiles
    where user_id = ${id} and account_status = 'approved'
    limit 1
  `;
  return rows[0]?.rbac_role === "super-admin";
}

export async function requireChancellor(userId: string) {
  if (!(await isChancellorId(userId))) {
    throw new Error("The Chancellor’s Office is closed to you.");
  }
}

export async function loadRoles(): Promise<RbacRole[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    description: string;
    locked: boolean;
    access_role: string;
    perms: string;
  }>`
    select id, name, description, locked, access_role, perms
    from rbac_roles
    order by name asc
    limit ${MAX_ROLES}
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    locked: row.locked,
    accessRole: isAccessRole(row.access_role) ? row.access_role : "specialist",
    perms: safePerms(row.perms),
  }));
}

export async function loadRole(id: string | null | undefined): Promise<RbacRole | null> {
  if (!id) return null;
  const safeId = cleanId(id, "Role");
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    description: string;
    locked: boolean;
    access_role: string;
    perms: string;
  }>`
    select id, name, description, locked, access_role, perms
    from rbac_roles
    where id = ${safeId}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    locked: row.locked,
    accessRole: isAccessRole(row.access_role) ? row.access_role : "specialist",
    perms: safePerms(row.perms),
  };
}

type SaveRoleInput = {
  id?: string;
  name: string;
  description: string;
  accessRole: AccessRole;
  perms: Perms;
};

function validateRoleInput(input: SaveRoleInput): SaveRoleInput {
  if (!input || typeof input !== "object") throw new Error("Role details are required.");
  const name = cleanText(input.name, "Role name", 80);
  const description = cleanText(input.description, "Description", 500, false);
  if (!isAccessRole(input.accessRole)) throw new Error("Choose a valid access role.");
  return {
    id: input.id ? cleanId(input.id, "Role") : undefined,
    name,
    description,
    accessRole: input.accessRole,
    perms: parsePerms(input.perms),
  };
}

export const listRbacRoles = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireChancellor(context.userId);
    return loadRoles();
  });

export const saveRbacRole = createServerFn({ method: "POST" })
  .validator(validateRoleInput)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await requireChancellor(context.userId);
    const sql = await getSql();
    const id = data.id || slugifyRole(data.name);
    if (id === "super-admin") {
      await sql`
        update rbac_roles
        set name = ${data.name}, description = ${data.description}
        where id = 'super-admin'
      `;
    } else {
      const perms = { ...parsePerms(data.perms), chancellor: false };
      await sql`
        insert into rbac_roles (id, name, description, locked, access_role, perms)
        values (
          ${id}, ${data.name}, ${data.description}, false,
          ${data.accessRole}, ${JSON.stringify(perms)}
        )
        on conflict (id) do update set
          name = excluded.name,
          description = excluded.description,
          access_role = excluded.access_role,
          perms = excluded.perms
      `;
    }
    await writeAudit(context.userId, "", "role.saved", data.name);
    return loadRoles();
  });

export const deleteRbacRole = createServerFn({ method: "POST" })
  .validator((value: string) => cleanId(value, "Role"))
  .middleware([authMiddleware])
  .handler(async ({ context, data: id }) => {
    await requireChancellor(context.userId);
    const sql = await getSql();
    await sql.transaction(async (tx) => {
      const role = await tx<{ locked: boolean }>`
        select locked from rbac_roles where id = ${id} for update
      `;
      if (!role[0]) throw new Error("That role no longer exists.");
      if (role[0].locked) throw new Error("Locked roles cannot be removed.");
      await tx`update user_profiles set rbac_role = 'viewer' where rbac_role = ${id}`;
      await tx`delete from rbac_roles where id = ${id}`;
    });
    await writeAudit(context.userId, "", "role.deleted", id);
    return loadRoles();
  });

/**
 * The training slice of the audit log, for the trainer room.
 *
 * Deliberately not `listAudit`: that one is the Chancellor's whole log,
 * including account approvals, password resets, and role changes. Someone whose
 * only permission is `manageTraining` has no business reading those, so this
 * returns course, lesson, and quiz actions only.
 */
export const listTrainingAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { assertCanManageTraining } = await import("@/lib/access");
    await assertCanManageTraining(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      actor_name: string | null;
      action: string;
      detail: string;
      created_at: string | Date | null;
    }>`
      select id, actor_name, action, detail, created_at
      from audit_log
      where action like 'training.%' or action like 'lesson.%' or action like 'quiz.%'
      order by created_at desc
      limit 100
    `;
    return rows.map((row) => ({
      id: row.id,
      actorName: row.actor_name,
      action: row.action,
      detail: row.detail,
      createdAt: row.created_at ? String(row.created_at) : "",
    }));
  });

export const listAudit = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireChancellor(context.userId);
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      actor_name: string | null;
      action: string;
      detail: string;
      created_at: string | Date | null;
    }>`
      select id, actor_name, action, detail, created_at
      from audit_log
      order by created_at desc
      limit 100
    `;
    return rows.map((row) => ({
      id: row.id,
      actorName: row.actor_name,
      action: row.action,
      detail: row.detail,
      createdAt: row.created_at ? String(row.created_at) : "",
    }));
  });
