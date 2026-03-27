import { db } from './db';
import { assertTenantAccess, listBranchesForTenant } from './reservas-data';
import { BRANCH_PERMISSIONS } from './cuentas-data';

export async function ensureUserTenantContextTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "UserTenantContext" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "activeBranchId" TEXT REFERENCES "Branch"(id) ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("userId", "tenantId")
    )
  `);
}

export async function listAccessibleBranchesForUser(input: { userId: string; tenantId: string }) {
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) return [];

  if (membership.role === 'OWNER') {
    return listBranchesForTenant(input.tenantId);
  }

  const { rows } = await db.query<{
    id: string;
    name: string;
    slug: string;
    timeZone: string;
    allowChooseEmployee: boolean;
    assignmentStrategy: 'ROTATIVE' | 'LOAD_BALANCE' | 'FIRST_AVAILABLE' | 'BEST_RATED';
    createdAt: Date;
  }>(
    `
      SELECT DISTINCT
        b.id, b.name, b.slug, b."timeZone", b."allowChooseEmployee", b."assignmentStrategy", b."createdAt"
      FROM "Branch" b
      INNER JOIN "BranchAccess" ba ON ba."branchId" = b.id
      WHERE b."tenantId" = $1
        AND ba."membershipId" = $2
      ORDER BY b."createdAt" ASC
    `,
    [input.tenantId, membership.id],
  );

  return rows.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
  }));
}

export async function getUserBranchContext(input: { userId: string; tenantId: string }) {
  await ensureUserTenantContextTable();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) {
    return {
      branches: [],
      activeBranchId: null as string | null,
      membershipRole: null as string | null,
      activeBranchPermissions: [] as string[],
    };
  }

  const branches = await listAccessibleBranchesForUser(input);

  const contextRes = await db.query<{ activeBranchId: string | null }>(
    `
      SELECT "activeBranchId"
      FROM "UserTenantContext"
      WHERE "userId" = $1 AND "tenantId" = $2
      LIMIT 1
    `,
    [input.userId, input.tenantId],
  );

  const saved = contextRes.rows[0]?.activeBranchId ?? null;
  let validSaved = saved && branches.some((branch) => branch.id === saved) ? saved : null;

  if (saved && !validSaved) {
    await db.query(
      `
        UPDATE "UserTenantContext"
        SET "activeBranchId" = NULL, "updatedAt" = NOW()
        WHERE "userId" = $1 AND "tenantId" = $2
      `,
      [input.userId, input.tenantId],
    );
  }

  if (!validSaved && branches.length === 1) {
    validSaved = branches[0].id;
    await db.query(
      `
        INSERT INTO "UserTenantContext" (id, "userId", "tenantId", "activeBranchId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
        ON CONFLICT ("userId", "tenantId")
        DO UPDATE SET "activeBranchId" = EXCLUDED."activeBranchId", "updatedAt" = NOW()
      `,
      [input.userId, input.tenantId, validSaved],
    );
  }

  let activeBranchPermissions: string[] = [];
  if (validSaved) {
    if (membership.role === 'OWNER') {
      activeBranchPermissions = [...BRANCH_PERMISSIONS];
    } else {
      const accessRes = await db.query<{ permissions: unknown }>(
        `
          SELECT permissions
          FROM "BranchAccess"
          WHERE "membershipId" = $1 AND "branchId" = $2
          LIMIT 1
        `,
        [membership.id, validSaved],
      );

      const raw = accessRes.rows[0]?.permissions;
      if (Array.isArray(raw)) {
        activeBranchPermissions = raw.filter((item): item is string => typeof item === 'string');
      } else if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            activeBranchPermissions = parsed.filter((item): item is string => typeof item === 'string');
          }
        } catch {
          activeBranchPermissions = [];
        }
      }
    }
  }

  return {
    branches,
    activeBranchId: validSaved,
    membershipRole: membership.role,
    activeBranchPermissions,
  };
}

export async function setUserActiveBranch(input: { userId: string; tenantId: string; branchId: string }) {
  await ensureUserTenantContextTable();
  const branches = await listAccessibleBranchesForUser({ userId: input.userId, tenantId: input.tenantId });
  const exists = branches.some((branch) => branch.id === input.branchId);
  if (!exists) {
    throw new Error('No tenés acceso a esa sucursal');
  }

  await db.query(
    `
      INSERT INTO "UserTenantContext" (id, "userId", "tenantId", "activeBranchId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
      ON CONFLICT ("userId", "tenantId")
      DO UPDATE SET "activeBranchId" = EXCLUDED."activeBranchId", "updatedAt" = NOW()
    `,
    [input.userId, input.tenantId, input.branchId],
  );

  return input.branchId;
}
