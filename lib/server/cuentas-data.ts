import crypto from 'crypto';
import { db } from './db';

export const BRANCH_PERMISSIONS = [
  'BRANCH_READ',
  'BRANCH_WRITE',
  'POS_READ',
  'POS_WRITE',
  'WALKINS_READ',
  'WALKINS_WRITE',
  'APPOINTMENTS_READ',
  'APPOINTMENTS_WRITE',
  'CUSTOMERS_READ',
  'CUSTOMERS_WRITE',
  'SERVICES_READ',
  'SERVICES_WRITE',
  'EMPLOYEES_READ',
  'EMPLOYEES_WRITE',
  'CAMPAIGNS_READ',
  'CAMPAIGNS_WRITE',
  'DASHBOARD_READ',
  'INVENTORY_READ',
  'INVENTORY_WRITE',
] as const;

export type BranchPermission = (typeof BRANCH_PERMISSIONS)[number];

export type WorkerType = 'OWNER' | 'TOTAL_POWER' | 'ADMIN_GENERAL' | 'ADMIN_BRANCH' | 'WORKER';

function uuid() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function isPermission(value: string): value is BranchPermission {
  return (BRANCH_PERMISSIONS as readonly string[]).includes(value);
}

function normalizePermissions(input: unknown): BranchPermission[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const next = input
    .map((value) => String(value))
    .filter((value): value is BranchPermission => isPermission(value));

  return [...new Set(next)];
}

function normalizeText(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const value = input.trim();
  return value ? value : null;
}

function normalizeEmail(input: unknown): string | null {
  const value = normalizeText(input);
  return value ? value.toLowerCase() : null;
}

function normalizePercentOrNull(input: unknown, fieldName: string): number | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }

  const value = Number(input);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${fieldName} debe ser un número entre 0 y 100`);
  }
  return Math.round(value * 100) / 100;
}

function normalizeNonNegativeIntOrNull(input: unknown, fieldName: string): number | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }

  const value = Number(input);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} debe ser un valor positivo`);
  }
  return Math.round(value);
}

function deriveWorkerType(
  role: string,
  branchAccesses: Array<{ branchId: string; permissions: BranchPermission[] }>,
  branchCount: number,
): WorkerType {
  if (role === 'OWNER') return 'OWNER';
  if (role === 'EMPLOYEE') return 'WORKER';
  if (
    branchCount > 0 &&
    branchAccesses.length === branchCount &&
    branchAccesses.every((access) => BRANCH_PERMISSIONS.every((permission) => access.permissions.includes(permission)))
  ) {
    return 'TOTAL_POWER';
  }
  if (branchAccesses.length <= 1) return 'ADMIN_BRANCH';
  return 'ADMIN_GENERAL';
}

export async function ensureCuentasTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "StaffProfile" (
      "membershipId" TEXT PRIMARY KEY REFERENCES "Membership"(id) ON DELETE CASCADE,
      "instagram" TEXT,
      "bio" TEXT,
      "personalPhone" TEXT,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "ExternalEmployeeProfile" (
      "employeeId" TEXT PRIMARY KEY REFERENCES "Employee"(id) ON DELETE CASCADE,
      "instagram" TEXT,
      "bio" TEXT,
      "personalPhone" TEXT,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "StaffInvitation" (
      "id" TEXT PRIMARY KEY,
      "token" TEXT UNIQUE NOT NULL,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "createdByUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      "invitedEmail" TEXT,
      "role" TEXT NOT NULL,
      "workerType" TEXT NOT NULL,
      "branchAccesses" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "usedAt" TIMESTAMPTZ,
      "usedByUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "StaffInvitation_role_check" CHECK ("role" IN ('MANAGER','EMPLOYEE')),
      CONSTRAINT "StaffInvitation_workerType_check" CHECK ("workerType" IN ('TOTAL_POWER','ADMIN_GENERAL','ADMIN_BRANCH','WORKER'))
    )
  `);

  await db.query('CREATE INDEX IF NOT EXISTS "StaffInvitation_tenant_idx" ON "StaffInvitation" ("tenantId", "createdAt" DESC)');

  await db.query(`
    DO $$
    BEGIN
      BEGIN
        ALTER TABLE "StaffInvitation" DROP CONSTRAINT IF EXISTS "StaffInvitation_workerType_check";
      EXCEPTION
        WHEN undefined_table OR undefined_object THEN
          NULL;
      END;

      BEGIN
        ALTER TABLE "StaffInvitation"
        ADD CONSTRAINT "StaffInvitation_workerType_check"
        CHECK ("workerType" IN ('TOTAL_POWER','ADMIN_GENERAL','ADMIN_BRANCH','WORKER'));
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END;
    END
    $$;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "TenantCommissionConfig" (
      "tenantId" TEXT PRIMARY KEY REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "inventoryPercent" DOUBLE PRECISION,
      "fixedCents" INTEGER,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "TenantCommissionConfig_inventoryPercent_check" CHECK ("inventoryPercent" IS NULL OR ("inventoryPercent" >= 0 AND "inventoryPercent" <= 100)),
      CONSTRAINT "TenantCommissionConfig_fixedCents_check" CHECK ("fixedCents" IS NULL OR "fixedCents" >= 0)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "TenantCommissionCategoryRule" (
      id TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "serviceCategoryId" TEXT NOT NULL,
      "percent" DOUBLE PRECISION NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "TenantCommissionCategoryRule_percent_check" CHECK ("percent" >= 0 AND "percent" <= 100),
      CONSTRAINT "TenantCommissionCategoryRule_unique" UNIQUE ("tenantId", "serviceCategoryId")
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS "TenantCommissionCategoryRule_tenant_idx" ON "TenantCommissionCategoryRule" ("tenantId", "serviceCategoryId")`,
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS "MembershipCommissionConfig" (
      "membershipId" TEXT PRIMARY KEY REFERENCES "Membership"(id) ON DELETE CASCADE,
      "inventoryPercent" DOUBLE PRECISION,
      "fixedCents" INTEGER,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "MembershipCommissionConfig_inventoryPercent_check" CHECK ("inventoryPercent" IS NULL OR ("inventoryPercent" >= 0 AND "inventoryPercent" <= 100)),
      CONSTRAINT "MembershipCommissionConfig_fixedCents_check" CHECK ("fixedCents" IS NULL OR "fixedCents" >= 0)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "MembershipCommissionCategoryRule" (
      id TEXT PRIMARY KEY,
      "membershipId" TEXT NOT NULL REFERENCES "Membership"(id) ON DELETE CASCADE,
      "serviceCategoryId" TEXT NOT NULL,
      "percent" DOUBLE PRECISION NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "MembershipCommissionCategoryRule_percent_check" CHECK ("percent" >= 0 AND "percent" <= 100),
      CONSTRAINT "MembershipCommissionCategoryRule_unique" UNIQUE ("membershipId", "serviceCategoryId")
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS "MembershipCommissionCategoryRule_membership_idx" ON "MembershipCommissionCategoryRule" ("membershipId", "serviceCategoryId")`,
  );
}

export async function getActorMembership(userId: string, tenantId: string) {
  const result = await db.query<{ id: string; role: 'OWNER' | 'MANAGER' | 'EMPLOYEE' }>(
    `
      SELECT id, role
      FROM "Membership"
      WHERE "tenantId" = $1 AND "userId" = $2
      LIMIT 1
    `,
    [tenantId, userId],
  );

  return result.rows[0] ?? null;
}

async function getMembershipBranchAccesses(membershipId: string) {
  const result = await db.query<{ branchId: string; permissions: unknown }>(
    `
      SELECT "branchId", permissions
      FROM "BranchAccess"
      WHERE "membershipId" = $1
    `,
    [membershipId],
  );

  return result.rows.map((row) => ({
    branchId: row.branchId,
    permissions: normalizePermissions(row.permissions as unknown[]),
  }));
}

async function getManageScope(input: { userId: string; tenantId: string }) {
  const actor = await getActorMembership(input.userId, input.tenantId);
  if (!actor) {
    return null;
  }

  if (actor.role === 'OWNER') {
    return {
      actor,
      canManageAccounts: true,
      manageableBranchIds: null as Set<string> | null,
    };
  }

  if (actor.role !== 'MANAGER') {
    return {
      actor,
      canManageAccounts: false,
      manageableBranchIds: new Set<string>(),
    };
  }

  const accesses = await getMembershipBranchAccesses(actor.id);
  const manageableBranchIds = new Set(
    accesses
      .filter((access) => access.permissions.includes('EMPLOYEES_WRITE'))
      .map((access) => access.branchId),
  );

  return {
    actor,
    canManageAccounts: manageableBranchIds.size > 0,
    manageableBranchIds,
  };
}

function hasBranchIntersection(
  branchIds: Set<string>,
  accesses: Array<{ branchId: string; permissions: string[] }>,
) {
  for (const access of accesses) {
    if (branchIds.has(access.branchId)) {
      return true;
    }
  }
  return false;
}

export async function getCuentasContext(input: { userId: string; tenantId: string }) {
  await ensureCuentasTables();

  const scope = await getManageScope(input);
  if (!scope) {
    return null;
  }

  const actor = scope.actor;
  const canManageAccounts = scope.canManageAccounts;

  const tenantRes = await db.query<{ id: string; slug: string; name: string }>(
    `SELECT id, slug, name FROM "Tenant" WHERE id = $1 LIMIT 1`,
    [input.tenantId],
  );

  const branchesRes = await db.query<{ id: string; name: string; slug: string }>(
    `SELECT id, name, slug FROM "Branch" WHERE "tenantId" = $1 ORDER BY name ASC`,
    [input.tenantId],
  );

  const servicesRes = await db.query<{
    id: string;
    branchId: string;
    name: string;
    isActive: boolean;
    categoryId: string | null;
    categoryName: string | null;
  }>(
    `
      SELECT
        s.id,
        s."branchId",
        s.name,
        s."isActive",
        s."categoryId" as "categoryId",
        sc.name as "categoryName"
      FROM "Service" s
      LEFT JOIN "ServiceCategory" sc ON sc.id = s."categoryId"
      WHERE s."tenantId" = $1
      ORDER BY s."branchId" ASC, s.name ASC
    `,
    [input.tenantId],
  );

  const categoriesRes = await db.query<{
    id: string;
    branchId: string;
    branchName: string;
    name: string;
    sortOrder: number;
  }>(
    `
      SELECT
        sc.id,
        sc."branchId",
        b.name as "branchName",
        sc.name,
        sc."sortOrder"
      FROM "ServiceCategory" sc
      INNER JOIN "Branch" b ON b.id = sc."branchId"
      WHERE sc."tenantId" = $1
      ORDER BY b.name ASC, sc."sortOrder" ASC, sc.name ASC
    `,
    [input.tenantId],
  );

  const externalEmployeesRes = await db.query<{
    employeeId: string;
    branchId: string;
    branchName: string;
    fullName: string;
    isActive: boolean;
    instagram: string | null;
    bio: string | null;
    personalPhone: string | null;
    serviceIds: unknown;
    schedules: unknown;
  }>(
    `
      SELECT
        e.id as "employeeId",
        e."branchId",
        b.name as "branchName",
        e."fullName",
        e."isActive",
        ep.instagram,
        ep.bio,
        ep."personalPhone",
        COALESCE((
          SELECT json_agg(sa."serviceId")
          FROM "ServiceAssignment" sa
          WHERE sa."employeeId" = e.id
        ), '[]'::json) as "serviceIds",
        COALESCE((
          SELECT json_agg(json_build_object(
            'dayOfWeek', es."dayOfWeek",
            'startTimeMin', es."startTimeMin",
            'endTimeMin', es."endTimeMin"
          ) ORDER BY es."dayOfWeek", es."startTimeMin")
          FROM "EmployeeSchedule" es
          WHERE es."employeeId" = e.id
        ), '[]'::json) as "schedules"
      FROM "Employee" e
      INNER JOIN "Branch" b ON b.id = e."branchId"
      LEFT JOIN "ExternalEmployeeProfile" ep ON ep."employeeId" = e.id
      WHERE e."tenantId" = $1
        AND e."membershipId" IS NULL
      ORDER BY b.name ASC, e."fullName" ASC
    `,
    [input.tenantId],
  );

  const membersRes = await db.query<{
    membershipId: string;
    role: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
    userId: string;
    email: string;
    fullName: string | null;
    instagram: string | null;
    bio: string | null;
    personalPhone: string | null;
    branchAccesses: unknown;
    schedules: unknown;
  }>(
    `
      SELECT
        m.id as "membershipId",
        m.role,
        u.id as "userId",
        u.email,
        u."fullName",
        sp.instagram,
        sp.bio,
        sp."personalPhone",
        COALESCE((
          SELECT json_agg(json_build_object(
            'branchId', ba."branchId",
            'permissions', ba.permissions
          ) ORDER BY ba."branchId")
          FROM "BranchAccess" ba
          WHERE ba."membershipId" = m.id
        ), '[]'::json) as "branchAccesses",
        COALESCE((
          SELECT json_agg(json_build_object(
            'branchId', e."branchId",
            'employeeId', e.id,
            'fullName', e."fullName",
            'serviceIds', COALESCE((
              SELECT json_agg(sa."serviceId")
              FROM "ServiceAssignment" sa
              WHERE sa."employeeId" = e.id
            ), '[]'::json),
            'schedules', COALESCE((
              SELECT json_agg(json_build_object(
                'dayOfWeek', es."dayOfWeek",
                'startTimeMin', es."startTimeMin",
                'endTimeMin', es."endTimeMin"
              ) ORDER BY es."dayOfWeek", es."startTimeMin")
              FROM "EmployeeSchedule" es
              WHERE es."employeeId" = e.id
            ), '[]'::json)
          ) ORDER BY e."branchId")
          FROM "Employee" e
          WHERE e."membershipId" = m.id
        ), '[]'::json) as schedules
      FROM "Membership" m
      INNER JOIN "User" u ON u.id = m."userId"
      LEFT JOIN "StaffProfile" sp ON sp."membershipId" = m.id
      WHERE m."tenantId" = $1
      ORDER BY
        CASE m.role WHEN 'OWNER' THEN 1 WHEN 'MANAGER' THEN 2 ELSE 3 END,
        u.email ASC
    `,
    [input.tenantId],
  );

  const visibleMembers = membersRes.rows.filter((row) => {
    if (actor.role === 'OWNER') return true;
    if (row.membershipId === actor.id) return true;
    if (!canManageAccounts || !scope.manageableBranchIds) return false;
    if (row.role === 'OWNER') return false;

    const rowAccesses = parseBranchAccesses(row.branchAccesses);
    return hasBranchIntersection(scope.manageableBranchIds, rowAccesses);
  });

  const visibleExternalEmployees = externalEmployeesRes.rows.filter((row) => {
    if (actor.role === 'OWNER') return true;
    if (!canManageAccounts || !scope.manageableBranchIds) return false;
    return scope.manageableBranchIds.has(row.branchId);
  });

  const globalCommissionRes = await db.query<{ inventoryPercent: number | null; fixedCents: number | null }>(
    `
      SELECT "inventoryPercent", "fixedCents"
      FROM "TenantCommissionConfig"
      WHERE "tenantId" = $1
      LIMIT 1
    `,
    [input.tenantId],
  );

  const globalCategoryCommissionRes = await db.query<{ serviceCategoryId: string; percent: number }>(
    `
      SELECT "serviceCategoryId", "percent"
      FROM "TenantCommissionCategoryRule"
      WHERE "tenantId" = $1
      ORDER BY "serviceCategoryId" ASC
    `,
    [input.tenantId],
  );

  const visibleMemberIds = visibleMembers.map((row) => row.membershipId);
  const memberCommissionConfigRes = visibleMemberIds.length
    ? await db.query<{ membershipId: string; inventoryPercent: number | null; fixedCents: number | null }>(
        `
          SELECT "membershipId", "inventoryPercent", "fixedCents"
          FROM "MembershipCommissionConfig"
          WHERE "membershipId" = ANY($1::text[])
        `,
        [visibleMemberIds],
      )
    : { rows: [] as Array<{ membershipId: string; inventoryPercent: number | null; fixedCents: number | null }> };

  const memberCategoryCommissionRes = visibleMemberIds.length
    ? await db.query<{ membershipId: string; serviceCategoryId: string; percent: number }>(
        `
          SELECT "membershipId", "serviceCategoryId", "percent"
          FROM "MembershipCommissionCategoryRule"
          WHERE "membershipId" = ANY($1::text[])
          ORDER BY "membershipId" ASC, "serviceCategoryId" ASC
        `,
        [visibleMemberIds],
      )
    : { rows: [] as Array<{ membershipId: string; serviceCategoryId: string; percent: number }> };

  const memberCommissionByMembership = new Map(
    memberCommissionConfigRes.rows.map((row) => [
      row.membershipId,
      {
        inventoryPercent: row.inventoryPercent === null ? null : Number(row.inventoryPercent),
        fixedCents: row.fixedCents === null ? null : Number(row.fixedCents),
      },
    ]),
  );

  const memberCategoryCommissionByMembership = new Map<string, Array<{ categoryId: string; percent: number }>>();
  for (const row of memberCategoryCommissionRes.rows) {
    const current = memberCategoryCommissionByMembership.get(row.membershipId) ?? [];
    current.push({
      categoryId: row.serviceCategoryId,
      percent: Number(row.percent),
    });
    memberCategoryCommissionByMembership.set(row.membershipId, current);
  }

  const invitationsRes = canManageAccounts
    ? await db.query<{
        id: string;
        token: string;
        invitedEmail: string | null;
        role: 'MANAGER' | 'EMPLOYEE';
        workerType: WorkerType;
        branchAccesses: unknown;
        expiresAt: Date;
        createdAt: Date;
        usedAt: Date | null;
      }>(
        `
          SELECT id, token, "invitedEmail", role, "workerType", "branchAccesses", "expiresAt", "createdAt", "usedAt"
          FROM "StaffInvitation"
          WHERE "tenantId" = $1
          ORDER BY "createdAt" DESC
          LIMIT 5
        `,
        [input.tenantId],
      )
    : { rows: [] as any[] };

  const visibleInvitations = invitationsRes.rows.filter((row) => {
    if (actor.role === 'OWNER') return true;
    if (!scope.manageableBranchIds) return false;
    const rowAccesses = parseBranchAccesses(row.branchAccesses);
    return hasBranchIntersection(scope.manageableBranchIds, rowAccesses);
  });

  return {
    tenant: tenantRes.rows[0] ?? null,
    actor: {
      membershipId: actor.id,
      role: actor.role,
      canManageAccounts,
    },
    branches: branchesRes.rows,
    serviceCatalog: servicesRes.rows,
    serviceCategories: categoriesRes.rows.map((row) => ({
      id: row.id,
      branchId: row.branchId,
      branchName: row.branchName,
      name: row.name,
      sortOrder: Number(row.sortOrder ?? 0),
    })),
    commissions: {
      global: {
        inventoryPercent:
          globalCommissionRes.rows[0]?.inventoryPercent === null || globalCommissionRes.rows[0]?.inventoryPercent === undefined
            ? null
            : Number(globalCommissionRes.rows[0]?.inventoryPercent),
        fixedCents:
          globalCommissionRes.rows[0]?.fixedCents === null || globalCommissionRes.rows[0]?.fixedCents === undefined
            ? null
            : Number(globalCommissionRes.rows[0]?.fixedCents),
        categoryPercents: globalCategoryCommissionRes.rows.map((row) => ({
          categoryId: row.serviceCategoryId,
          percent: Number(row.percent),
        })),
      },
    },
    permissionsCatalog: [...BRANCH_PERMISSIONS],
    members: visibleMembers.map((row) => {
      const branchAccesses = parseBranchAccesses(row.branchAccesses);
      const commissionConfig = memberCommissionByMembership.get(row.membershipId) ?? {
        inventoryPercent: null,
        fixedCents: null,
      };
      return {
        membershipId: row.membershipId,
        role: row.role,
        workerType: deriveWorkerType(row.role, branchAccesses, branchesRes.rows.length),
        userId: row.userId,
        email: row.email,
        fullName: row.fullName,
        profile: {
          instagram: row.instagram,
          bio: row.bio,
          personalPhone: row.personalPhone,
        },
        commissions: {
          inventoryPercent: commissionConfig.inventoryPercent,
          fixedCents: commissionConfig.fixedCents,
          categoryPercents: memberCategoryCommissionByMembership.get(row.membershipId) ?? [],
        },
        branchAccesses,
        schedules: parseSchedules(row.schedules),
      };
    }),
    externalEmployees: visibleExternalEmployees.map((row) => ({
      employeeId: row.employeeId,
      branchId: row.branchId,
      branchName: row.branchName,
      fullName: row.fullName,
      isActive: Boolean(row.isActive),
      profile: {
        instagram: row.instagram,
        bio: row.bio,
        personalPhone: row.personalPhone,
      },
      serviceIds: parseIdList(row.serviceIds),
      schedules: parseSchedules([
        {
          branchId: row.branchId,
          employeeId: row.employeeId,
          fullName: row.fullName,
          serviceIds: parseIdList(row.serviceIds),
          schedules: row.schedules,
        },
      ]),
    })),
    invitations: visibleInvitations.map((row) => ({
      id: row.id,
      token: row.token,
      invitedEmail: row.invitedEmail,
      role: row.role,
      workerType: row.workerType,
      branchAccesses: parseBranchAccesses(row.branchAccesses),
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      usedAt: row.usedAt ? row.usedAt.toISOString() : null,
    })),
  };
}

export async function updateTenantCommissionConfig(input: {
  actorUserId: string;
  tenantId: string;
  config: {
    inventoryPercent?: unknown;
    fixedCents?: unknown;
    categoryCommissions?: Array<{ categoryId?: unknown; percent?: unknown }>;
  };
}) {
  await ensureCuentasTables();

  const scope = await getManageScope({ userId: input.actorUserId, tenantId: input.tenantId });
  if (!scope || !scope.canManageAccounts) {
    throw new Error('No tenés permisos para configurar comisiones');
  }

  const inventoryPercent = normalizePercentOrNull(input.config.inventoryPercent, 'La comisión de inventario');
  const fixedCents = normalizeNonNegativeIntOrNull(input.config.fixedCents, 'El fijo');

  const validCategoryIdsRes = await db.query<{ id: string }>(
    `
      SELECT id
      FROM "ServiceCategory"
      WHERE "tenantId" = $1
    `,
    [input.tenantId],
  );
  const validCategoryIds = new Set(validCategoryIdsRes.rows.map((row) => row.id));

  const categoryCommissions = (Array.isArray(input.config.categoryCommissions) ? input.config.categoryCommissions : [])
    .map((row) => {
      const categoryId = String(row?.categoryId ?? '').trim();
      if (!categoryId || !validCategoryIds.has(categoryId)) return null;
      const percent = normalizePercentOrNull(row?.percent, 'La comisión por categoría');
      if (percent === null) return null;
      return { categoryId, percent };
    })
    .filter((row): row is { categoryId: string; percent: number } => Boolean(row));

  await db.query('BEGIN');
  try {
    await db.query(
      `
        DELETE FROM "TenantCommissionCategoryRule"
        WHERE "tenantId" = $1
      `,
      [input.tenantId],
    );

    for (const row of categoryCommissions) {
      await db.query(
        `
          INSERT INTO "TenantCommissionCategoryRule" (
            id, "tenantId", "serviceCategoryId", "percent", "createdAt", "updatedAt"
          )
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT ("tenantId", "serviceCategoryId")
          DO UPDATE SET "percent" = EXCLUDED."percent", "updatedAt" = NOW()
        `,
        [uuid(), input.tenantId, row.categoryId, row.percent],
      );
    }

    if (inventoryPercent === null && fixedCents === null && categoryCommissions.length === 0) {
      await db.query(`DELETE FROM "TenantCommissionConfig" WHERE "tenantId" = $1`, [input.tenantId]);
    } else {
      await db.query(
        `
          INSERT INTO "TenantCommissionConfig" ("tenantId", "inventoryPercent", "fixedCents", "updatedAt")
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT ("tenantId")
          DO UPDATE
          SET "inventoryPercent" = EXCLUDED."inventoryPercent",
              "fixedCents" = EXCLUDED."fixedCents",
              "updatedAt" = NOW()
        `,
        [input.tenantId, inventoryPercent, fixedCents],
      );
    }

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function createInvitation(input: {
  actorUserId: string;
  tenantId: string;
  invitedEmail?: string | null;
  role: 'MANAGER' | 'EMPLOYEE';
  workerType: Exclude<WorkerType, 'OWNER'>;
  branchAccesses: Array<{ branchId: string; permissions: string[] }>;
  origin: string;
}) {
  await ensureCuentasTables();

  const scope = await getManageScope({ userId: input.actorUserId, tenantId: input.tenantId });
  if (!scope) {
    throw new Error('Sin acceso al tenant');
  }

  if (!scope.canManageAccounts) {
    throw new Error('No tenés permisos para invitar usuarios');
  }

  if (input.workerType === 'TOTAL_POWER' && scope.actor.role !== 'OWNER') {
    throw new Error('Solo el Owner puede asignar Total Power');
  }

  const validBranches = await db.query<{ id: string }>(
    `SELECT id FROM "Branch" WHERE "tenantId" = $1`,
    [input.tenantId],
  );
  const validIds = new Set(validBranches.rows.map((row) => row.id));

  const normalizedAccesses = input.branchAccesses
    .filter((entry) => validIds.has(entry.branchId))
    .map((entry) => ({
      branchId: entry.branchId,
      permissions: normalizePermissions(entry.permissions),
    }))
    .filter((entry) => entry.permissions.length > 0);

  if (scope.actor.role === 'MANAGER' && scope.manageableBranchIds) {
    const outOfScope = normalizedAccesses.some((entry) => !scope.manageableBranchIds?.has(entry.branchId));
    if (outOfScope) {
      throw new Error('Solo podés invitar en sucursales donde tenés permisos de gestión');
    }
  }

  if (scope.actor.role !== 'OWNER') {
    const actorAccesses = await getMembershipBranchAccesses(scope.actor.id);
    const actorPermissionsByBranch = new Map(actorAccesses.map((access) => [access.branchId, new Set(access.permissions)]));

    for (const access of normalizedAccesses) {
      const actorPermissions = actorPermissionsByBranch.get(access.branchId);
      if (!actorPermissions) {
        throw new Error('No podés invitar en una sucursal fuera de tus permisos');
      }

      for (const permission of access.permissions) {
        if (!actorPermissions.has(permission)) {
          throw new Error('No podés delegar permisos que no tenés');
        }
      }
    }
  }

  if (normalizedAccesses.length === 0) {
    throw new Error('Definí al menos un acceso por sucursal con permisos');
  }

  if (input.workerType === 'ADMIN_BRANCH' && normalizedAccesses.length !== 1) {
    throw new Error('Administrador de sucursal debe tener exactamente una sucursal');
  }

  const id = uuid();
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

  await db.query(
    `
      INSERT INTO "StaffInvitation" (
        id, token, "tenantId", "createdByUserId", "invitedEmail", role, "workerType", "branchAccesses", "expiresAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
    `,
    [
      id,
      token,
      input.tenantId,
      input.actorUserId,
      normalizeEmail(input.invitedEmail),
      input.role,
      input.workerType,
      JSON.stringify(normalizedAccesses),
      expiresAt.toISOString(),
    ],
  );

  // Keep only the latest 5 invitations per tenant.
  await db.query(
    `
      DELETE FROM "StaffInvitation"
      WHERE "tenantId" = $1
        AND id NOT IN (
          SELECT id
          FROM "StaffInvitation"
          WHERE "tenantId" = $1
          ORDER BY "createdAt" DESC
          LIMIT 5
        )
    `,
    [input.tenantId],
  );

  const base = input.origin.replace(/\/+$/, '');
  const inviteUrl = `${base}/login?invite=${encodeURIComponent(token)}&tenantId=${encodeURIComponent(input.tenantId)}&next=${encodeURIComponent('/app/inicio')}`;

  return {
    id,
    token,
    inviteUrl,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function createExternalEmployee(input: {
  actorUserId: string;
  tenantId: string;
  branchId: string;
  fullName: string;
  serviceIds: string[];
  isActive: boolean;
}) {
  await ensureCuentasTables();

  const scope = await getManageScope({ userId: input.actorUserId, tenantId: input.tenantId });
  if (!scope) {
    throw new Error('Sin acceso al tenant');
  }
  if (!scope.canManageAccounts) {
    throw new Error('No tenés permisos para gestionar trabajadores');
  }

  const branchRes = await db.query<{ id: string }>(
    `SELECT id FROM "Branch" WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
    [input.branchId, input.tenantId],
  );
  if (!branchRes.rows[0]) {
    throw new Error('Sucursal inválida');
  }

  if (scope.actor.role !== 'OWNER' && scope.manageableBranchIds && !scope.manageableBranchIds.has(input.branchId)) {
    throw new Error('No podés crear trabajadores en esta sucursal');
  }

  const serviceIds = Array.isArray(input.serviceIds)
    ? input.serviceIds.map((id) => String(id)).map((id) => id.trim()).filter(Boolean)
    : [];
  if (serviceIds.length === 0) {
    throw new Error('Debés asignar al menos un servicio');
  }

  const servicesRes = await db.query<{ id: string }>(
    `
      SELECT id
      FROM "Service"
      WHERE "tenantId" = $1
        AND "branchId" = $2
        AND id = ANY($3::text[])
    `,
    [input.tenantId, input.branchId, serviceIds],
  );
  if (servicesRes.rowCount !== serviceIds.length) {
    throw new Error('Hay servicios inválidos para esta sucursal');
  }

  const employeeRes = await db.query<{ id: string }>(
    `
      INSERT INTO "Employee" (
        id,
        "tenantId",
        "branchId",
        "membershipId",
        "fullName",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, NULL, $3, $4, NOW(), NOW())
      RETURNING id
    `,
    [input.tenantId, input.branchId, input.fullName.trim(), input.isActive !== false],
  );

  const employeeId = employeeRes.rows[0]?.id;
  if (!employeeId) {
    throw new Error('No se pudo crear el trabajador');
  }

  const branchSchedulesRes = await db.query<{
    dayOfWeek: number;
    startTimeMin: number;
    endTimeMin: number;
  }>(
    `
      SELECT "dayOfWeek", "startTimeMin", "endTimeMin"
      FROM "BranchSchedule"
      WHERE "branchId" = $1
      ORDER BY "dayOfWeek" ASC, "startTimeMin" ASC
    `,
    [input.branchId],
  );

  for (const schedule of branchSchedulesRes.rows) {
    await db.query(
      `
        INSERT INTO "EmployeeSchedule" (id, "employeeId", "dayOfWeek", "startTimeMin", "endTimeMin", "createdAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
      `,
      [employeeId, schedule.dayOfWeek, schedule.startTimeMin, schedule.endTimeMin],
    );
  }

  for (const serviceId of serviceIds) {
    await db.query(
      `
        INSERT INTO "ServiceAssignment" (id, "employeeId", "serviceId", "createdAt")
        VALUES (gen_random_uuid()::text, $1, $2, NOW())
        ON CONFLICT ("employeeId", "serviceId") DO NOTHING
      `,
      [employeeId, serviceId],
    );
  }

  return { employeeId };
}

export async function updateExternalEmployee(input: {
  actorUserId: string;
  tenantId: string;
  employeeId: string;
  fullName: string;
  isActive: boolean;
  profile: {
    instagram?: unknown;
    bio?: unknown;
    personalPhone?: unknown;
  };
  schedules: Array<{ dayOfWeek: number; startTimeMin: number; endTimeMin: number }>;
  serviceIds: string[];
}) {
  await ensureCuentasTables();

  const scope = await getManageScope({ userId: input.actorUserId, tenantId: input.tenantId });
  if (!scope) {
    throw new Error('Sin acceso al tenant');
  }
  if (!scope.canManageAccounts) {
    throw new Error('No tenés permisos para gestionar trabajadores');
  }

  const employeeRes = await db.query<{
    id: string;
    tenantId: string;
    branchId: string;
    membershipId: string | null;
  }>(
    `
      SELECT id, "tenantId", "branchId", "membershipId"
      FROM "Employee"
      WHERE id = $1
        AND "tenantId" = $2
      LIMIT 1
    `,
    [input.employeeId, input.tenantId],
  );

  const employee = employeeRes.rows[0];
  if (!employee) {
    throw new Error('Trabajadora no encontrada');
  }
  if (employee.membershipId) {
    throw new Error('Esta cuenta se edita desde el usuario staff');
  }
  if (scope.actor.role !== 'OWNER' && scope.manageableBranchIds && !scope.manageableBranchIds.has(employee.branchId)) {
    throw new Error('No podés editar trabajadoras de esta sucursal');
  }

  const fullName = normalizeText(input.fullName);
  if (!fullName || fullName.length < 2) {
    throw new Error('El nombre de la trabajadora es obligatorio');
  }

  const normalizedServiceIds = Array.isArray(input.serviceIds)
    ? input.serviceIds.map((id) => String(id)).map((id) => id.trim()).filter(Boolean)
    : [];

  const validServiceIds = new Set<string>();
  if (normalizedServiceIds.length > 0) {
    const servicesRes = await db.query<{ id: string }>(
      `
        SELECT id
        FROM "Service"
        WHERE "tenantId" = $1
          AND "branchId" = $2
          AND id = ANY($3::text[])
          AND "isActive" = TRUE
      `,
      [input.tenantId, employee.branchId, normalizedServiceIds],
    );

    for (const row of servicesRes.rows) {
      validServiceIds.add(row.id);
    }

    if (validServiceIds.size !== normalizedServiceIds.length) {
      throw new Error('Hay servicios inválidos para la sucursal de esta trabajadora');
    }
  }

  const normalizedSchedules = Array.isArray(input.schedules)
    ? input.schedules
        .map((row) => ({
          dayOfWeek: Number(row?.dayOfWeek),
          startTimeMin: Number(row?.startTimeMin),
          endTimeMin: Number(row?.endTimeMin),
        }))
        .filter(
          (row) =>
            Number.isInteger(row.dayOfWeek) &&
            row.dayOfWeek >= 0 &&
            row.dayOfWeek <= 6 &&
            Number.isInteger(row.startTimeMin) &&
            Number.isInteger(row.endTimeMin) &&
            row.startTimeMin < row.endTimeMin,
        )
    : [];

  await db.query('BEGIN');
  try {
    await db.query(
      `
        UPDATE "Employee"
        SET
          "fullName" = $1,
          "isActive" = $2,
          "updatedAt" = NOW()
        WHERE id = $3
      `,
      [fullName, input.isActive !== false, employee.id],
    );

    await db.query(
      `
        INSERT INTO "ExternalEmployeeProfile" ("employeeId", instagram, bio, "personalPhone", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT ("employeeId") DO UPDATE
        SET
          instagram = EXCLUDED.instagram,
          bio = EXCLUDED.bio,
          "personalPhone" = EXCLUDED."personalPhone",
          "updatedAt" = NOW()
      `,
      [
        employee.id,
        normalizeText(input.profile?.instagram),
        normalizeText(input.profile?.bio),
        normalizeText(input.profile?.personalPhone),
      ],
    );

    await db.query(`DELETE FROM "EmployeeSchedule" WHERE "employeeId" = $1`, [employee.id]);
    for (const row of normalizedSchedules) {
      await db.query(
        `
          INSERT INTO "EmployeeSchedule" (id, "employeeId", "dayOfWeek", "startTimeMin", "endTimeMin", "createdAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
        `,
        [employee.id, row.dayOfWeek, row.startTimeMin, row.endTimeMin],
      );
    }

    await db.query(`DELETE FROM "ServiceAssignment" WHERE "employeeId" = $1`, [employee.id]);
    for (const serviceId of normalizedServiceIds) {
      await db.query(
        `
          INSERT INTO "ServiceAssignment" (id, "employeeId", "serviceId", "createdAt")
          VALUES (gen_random_uuid()::text, $1, $2, NOW())
          ON CONFLICT ("employeeId", "serviceId") DO NOTHING
        `,
        [employee.id, serviceId],
      );
    }

    await db.query('COMMIT');
    return { ok: true, employeeId: employee.id };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function getInvitationPublicInfo(token: string) {
  await ensureCuentasTables();

  const invitationRes = await db.query<{
    id: string;
    expiresAt: Date;
    usedAt: Date | null;
    tenantId: string;
    tenantName: string;
  }>(
    `
      SELECT
        i.id,
        i."expiresAt",
        i."usedAt",
        t.id AS "tenantId",
        t.name AS "tenantName"
      FROM "StaffInvitation" i
      INNER JOIN "Tenant" t ON t.id = i."tenantId"
      WHERE i.token = $1
      LIMIT 1
    `,
    [token],
  );

  const invitation = invitationRes.rows[0];
  if (!invitation) {
    return { valid: false, reason: 'INVALID' as const };
  }

  if (invitation.usedAt) {
    return {
      valid: false,
      reason: 'USED' as const,
      tenantId: invitation.tenantId,
      tenantName: invitation.tenantName,
    };
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    return {
      valid: false,
      reason: 'EXPIRED' as const,
      tenantId: invitation.tenantId,
      tenantName: invitation.tenantName,
    };
  }

  return {
    valid: true,
    reason: 'OK' as const,
    tenantId: invitation.tenantId,
    tenantName: invitation.tenantName,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

export async function acceptInvitation(input: { token: string; userId: string }) {
  await ensureCuentasTables();

  const invitationRes = await db.query<{
    id: string;
    tenantId: string;
    invitedEmail: string | null;
    role: 'MANAGER' | 'EMPLOYEE';
    branchAccesses: unknown;
    expiresAt: Date;
    usedAt: Date | null;
  }>(
    `
      SELECT id, "tenantId", "invitedEmail", role, "branchAccesses", "expiresAt", "usedAt"
      FROM "StaffInvitation"
      WHERE token = $1
      LIMIT 1
    `,
    [input.token],
  );

  const invitation = invitationRes.rows[0];
  if (!invitation) {
    throw new Error('Invitación inválida');
  }

  if (invitation.usedAt) {
    throw new Error('Esta invitación ya fue utilizada');
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    throw new Error('Esta invitación venció');
  }

  const userRes = await db.query<{ id: string; email: string }>(
    `SELECT id, email FROM "User" WHERE id = $1 LIMIT 1`,
    [input.userId],
  );

  const user = userRes.rows[0];
  if (!user) {
    throw new Error('Usuario inválido');
  }

  if (invitation.invitedEmail && invitation.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error('Esta invitación fue emitida para otro email');
  }

  const existingRes = await db.query<{ id: string }>(
    `
      SELECT id
      FROM "Membership"
      WHERE "tenantId" = $1 AND "userId" = $2
      LIMIT 1
    `,
    [invitation.tenantId, input.userId],
  );

  if (existingRes.rows[0]) {
    const membershipInfoRes = await db.query<{
      membershipId: string;
      role: 'MANAGER' | 'EMPLOYEE' | 'OWNER';
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
    }>(
      `
        SELECT
          m.id as "membershipId",
          m.role as "role",
          t.id as "tenantId",
          t.slug as "tenantSlug",
          t.name as "tenantName"
        FROM "Membership" m
        INNER JOIN "Tenant" t ON t.id = m."tenantId"
        WHERE m.id = $1
        LIMIT 1
      `,
      [existingRes.rows[0].id],
    );
    await db.query(
      `
        UPDATE "StaffInvitation"
        SET "usedAt" = NOW(), "usedByUserId" = $2
        WHERE id = $1
      `,
      [invitation.id, input.userId],
    );

    const info = membershipInfoRes.rows[0];
    return {
      membershipId: existingRes.rows[0].id,
      alreadyMember: true,
      membership: info
        ? {
            membershipId: info.membershipId,
            role: info.role,
            tenantId: info.tenantId,
            tenantSlug: info.tenantSlug,
            tenantName: info.tenantName,
          }
        : null,
    };
  }

  await db.query('BEGIN');
  try {
    const membershipId = uuid();

    await db.query(
      `
        INSERT INTO "Membership" (id, "tenantId", "userId", role, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW(), NOW())
      `,
      [membershipId, invitation.tenantId, input.userId, invitation.role],
    );

    const accesses = parseBranchAccesses(invitation.branchAccesses);
    for (const access of accesses) {
      await db.query(
        `
          INSERT INTO "BranchAccess" (id, "membershipId", "branchId", permissions, "createdAt")
          VALUES ($1, $2, $3, $4::jsonb, NOW())
          ON CONFLICT ("membershipId", "branchId") DO UPDATE
          SET permissions = EXCLUDED.permissions
        `,
        [uuid(), membershipId, access.branchId, JSON.stringify(access.permissions)],
      );
    }

    await db.query(
      `
        UPDATE "StaffInvitation"
        SET "usedAt" = NOW(), "usedByUserId" = $2
        WHERE id = $1
      `,
      [invitation.id, input.userId],
    );

    await db.query('COMMIT');
    const tenantRes = await db.query<{ id: string; slug: string; name: string }>(
      `SELECT id, slug, name FROM "Tenant" WHERE id = $1 LIMIT 1`,
      [invitation.tenantId],
    );
    const tenantInfo = tenantRes.rows[0];
    return {
      membershipId,
      alreadyMember: false,
      membership: tenantInfo
        ? {
            membershipId,
            role: invitation.role,
            tenantId: tenantInfo.id,
            tenantSlug: tenantInfo.slug,
            tenantName: tenantInfo.name,
          }
        : null,
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function updateMembershipConfig(input: {
  actorUserId: string;
  tenantId: string;
  membershipId: string;
  role: 'MANAGER' | 'EMPLOYEE';
  branchAccesses: Array<{ branchId: string; permissions: string[] }>;
  profile: {
    instagram?: string | null;
    bio?: string | null;
    personalPhone?: string | null;
  };
  employeeSchedules?: Array<{
    branchId: string;
    schedules: Array<{ dayOfWeek: number; startTimeMin: number; endTimeMin: number }>;
  }>;
  employeeServices?: Array<{
    branchId: string;
    serviceIds: string[];
  }>;
  commissions?: {
    inventoryPercent?: unknown;
    fixedCents?: unknown;
    categoryCommissions?: Array<{ categoryId?: unknown; percent?: unknown }>;
  };
}) {
  await ensureCuentasTables();

  const scope = await getManageScope({ userId: input.actorUserId, tenantId: input.tenantId });
  if (!scope) {
    throw new Error('Sin acceso al tenant');
  }

  const memberRes = await db.query<{ id: string; role: 'OWNER' | 'MANAGER' | 'EMPLOYEE'; userId: string }>(
    `
      SELECT id, role, "userId"
      FROM "Membership"
      WHERE id = $1 AND "tenantId" = $2
      LIMIT 1
    `,
    [input.membershipId, input.tenantId],
  );

  const member = memberRes.rows[0];
  if (!member) {
    throw new Error('Miembro no encontrado');
  }

  const isSelfEdit = member.id === scope.actor.id;
  const selfProfileOnly = isSelfEdit;

  if (selfProfileOnly) {
    await db.query('BEGIN');
    try {
      await db.query(
        `
          INSERT INTO "StaffProfile" ("membershipId", instagram, bio, "personalPhone", "updatedAt")
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT ("membershipId") DO UPDATE
          SET instagram = EXCLUDED.instagram,
              bio = EXCLUDED.bio,
              "personalPhone" = EXCLUDED."personalPhone",
              "updatedAt" = NOW()
        `,
        [
          input.membershipId,
          normalizeText(input.profile.instagram),
          normalizeText(input.profile.bio),
          normalizeText(input.profile.personalPhone),
        ],
      );

      const allowedBranchIds =
        scope.actor.role === 'OWNER'
          ? new Set(
              (
                await db.query<{ id: string }>(
                  `SELECT id FROM "Branch" WHERE "tenantId" = $1`,
                  [input.tenantId],
                )
              ).rows.map((row) => row.id),
            )
          : new Set((await getMembershipBranchAccesses(input.membershipId)).map((access) => access.branchId));

      if (Array.isArray(input.employeeSchedules)) {
        const userRes = await db.query<{ fullName: string | null }>(
          `SELECT "fullName" FROM "User" WHERE id = $1 LIMIT 1`,
          [member.userId],
        );
        const fallbackName = userRes.rows[0]?.fullName?.trim() || 'Empleado';
        const employeeByBranch = new Map<string, string>();

        const resolveEmployeeId = async (branchId: string) => {
          const cached = employeeByBranch.get(branchId);
          if (cached) return cached;

          const existingEmployeeRes = await db.query<{ id: string }>(
            `
              SELECT id
              FROM "Employee"
              WHERE "tenantId" = $1 AND "branchId" = $2 AND "membershipId" = $3
              LIMIT 1
            `,
            [input.tenantId, branchId, input.membershipId],
          );

          if (existingEmployeeRes.rows[0]) {
            const id = existingEmployeeRes.rows[0].id;
            employeeByBranch.set(branchId, id);
            return id;
          }

          const id = uuid();
          await db.query(
            `
              INSERT INTO "Employee" (id, "tenantId", "branchId", "membershipId", "fullName", "isActive", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
            `,
            [id, input.tenantId, branchId, input.membershipId, fallbackName],
          );
          employeeByBranch.set(branchId, id);
          return id;
        };

        for (const branchSchedule of input.employeeSchedules) {
          if (!allowedBranchIds.has(branchSchedule.branchId)) {
            continue;
          }

          const employeeId = await resolveEmployeeId(branchSchedule.branchId);
          await db.query(`DELETE FROM "EmployeeSchedule" WHERE "employeeId" = $1`, [employeeId]);

          for (const row of branchSchedule.schedules ?? []) {
            const dayOfWeek = Number(row.dayOfWeek);
            const startTimeMin = Number(row.startTimeMin);
            const endTimeMin = Number(row.endTimeMin);

            if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) continue;
            if (!Number.isInteger(startTimeMin) || !Number.isInteger(endTimeMin)) continue;
            if (startTimeMin < 0 || endTimeMin > 24 * 60 || startTimeMin >= endTimeMin) continue;

            await db.query(
              `
                INSERT INTO "EmployeeSchedule" (id, "employeeId", "dayOfWeek", "startTimeMin", "endTimeMin", "createdAt")
                VALUES ($1, $2, $3, $4, $5, NOW())
              `,
              [uuid(), employeeId, dayOfWeek, startTimeMin, endTimeMin],
            );
          }
        }
      }

      if (Array.isArray(input.employeeServices)) {
        const userRes = await db.query<{ fullName: string | null }>(
          `SELECT "fullName" FROM "User" WHERE id = $1 LIMIT 1`,
          [member.userId],
        );
        const fallbackName = userRes.rows[0]?.fullName?.trim() || 'Empleado';
        const employeeByBranch = new Map<string, string>();

        const resolveEmployeeId = async (branchId: string) => {
          const cached = employeeByBranch.get(branchId);
          if (cached) return cached;

          const existingEmployeeRes = await db.query<{ id: string }>(
            `
              SELECT id
              FROM "Employee"
              WHERE "tenantId" = $1 AND "branchId" = $2 AND "membershipId" = $3
              LIMIT 1
            `,
            [input.tenantId, branchId, input.membershipId],
          );

          if (existingEmployeeRes.rows[0]) {
            const id = existingEmployeeRes.rows[0].id;
            employeeByBranch.set(branchId, id);
            return id;
          }

          const id = uuid();
          await db.query(
            `
              INSERT INTO "Employee" (id, "tenantId", "branchId", "membershipId", "fullName", "isActive", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
            `,
            [id, input.tenantId, branchId, input.membershipId, fallbackName],
          );
          employeeByBranch.set(branchId, id);
          return id;
        };

        for (const branchServices of input.employeeServices) {
          if (!allowedBranchIds.has(branchServices.branchId)) {
            continue;
          }

          const employeeId = await resolveEmployeeId(branchServices.branchId);
          const incomingIds = Array.isArray(branchServices.serviceIds)
            ? branchServices.serviceIds.map((id) => String(id)).filter(Boolean)
            : [];

          const validServicesRes = incomingIds.length
            ? await db.query<{ id: string }>(
                `
                  SELECT id
                  FROM "Service"
                  WHERE "tenantId" = $1 AND "branchId" = $2 AND id = ANY($3::text[])
                `,
                [input.tenantId, branchServices.branchId, incomingIds],
              )
            : { rows: [] as Array<{ id: string }> };

          const validServiceIds = validServicesRes.rows.map((row) => row.id);
          await db.query(`DELETE FROM "ServiceAssignment" WHERE "employeeId" = $1`, [employeeId]);
          for (const serviceId of validServiceIds) {
            await db.query(
              `
                INSERT INTO "ServiceAssignment" (id, "employeeId", "serviceId", "createdAt")
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT ("employeeId", "serviceId") DO NOTHING
              `,
              [uuid(), employeeId, serviceId],
            );
          }
        }
      }

      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    return;
  }

  if (!scope.canManageAccounts) {
    throw new Error('No tenés permisos para editar cuentas');
  }

  if (member.role === 'OWNER') {
    throw new Error('No se puede editar el Owner desde este panel');
  }

  const validBranches = await db.query<{ id: string }>(
    `SELECT id FROM "Branch" WHERE "tenantId" = $1`,
    [input.tenantId],
  );
  const validIds = new Set(validBranches.rows.map((row) => row.id));

  const normalizedAccesses = input.branchAccesses
    .filter((entry) => validIds.has(entry.branchId))
    .map((entry) => ({
      branchId: entry.branchId,
      permissions: normalizePermissions(entry.permissions),
    }))
    .filter((entry) => entry.permissions.length > 0);

  if (normalizedAccesses.length === 0) {
    throw new Error('El miembro debe tener al menos una sucursal con permisos');
  }

  if (scope.actor.role === 'MANAGER' && scope.manageableBranchIds) {
    const targetCurrentAccesses = await getMembershipBranchAccesses(input.membershipId);

    if (targetCurrentAccesses.length > 0) {
      const hasOutOfScopeCurrent = targetCurrentAccesses.some((entry) => !scope.manageableBranchIds?.has(entry.branchId));
      if (hasOutOfScopeCurrent) {
        throw new Error('No podés editar este usuario porque tiene acceso a sucursales fuera de tu alcance');
      }
    }

    const hasOutOfScopeUpdate = normalizedAccesses.some((entry) => !scope.manageableBranchIds?.has(entry.branchId));
    if (hasOutOfScopeUpdate) {
      throw new Error('Solo podés asignar permisos en sucursales donde tenés permisos de gestión');
    }
  }

  if (scope.actor.role !== 'OWNER') {
    const actorAccesses = await getMembershipBranchAccesses(scope.actor.id);
    const actorPermissionsByBranch = new Map(actorAccesses.map((access) => [access.branchId, new Set(access.permissions)]));

    for (const access of normalizedAccesses) {
      const actorPermissions = actorPermissionsByBranch.get(access.branchId);
      if (!actorPermissions) {
        throw new Error('No podés asignar accesos fuera de tus sucursales');
      }
      for (const permission of access.permissions) {
        if (!actorPermissions.has(permission)) {
          throw new Error('No podés asignar permisos superiores a los tuyos');
        }
      }
    }
  }

  await db.query('BEGIN');
  try {
    await db.query(
      `
        UPDATE "Membership"
        SET role = $1, "updatedAt" = NOW()
        WHERE id = $2
      `,
      [input.role, input.membershipId],
    );

    await db.query(`DELETE FROM "BranchAccess" WHERE "membershipId" = $1`, [input.membershipId]);

    for (const access of normalizedAccesses) {
      await db.query(
        `
          INSERT INTO "BranchAccess" (id, "membershipId", "branchId", permissions, "createdAt")
          VALUES ($1, $2, $3, $4::jsonb, NOW())
        `,
        [uuid(), input.membershipId, access.branchId, JSON.stringify(access.permissions)],
      );
    }

    await db.query(
      `
        INSERT INTO "StaffProfile" ("membershipId", instagram, bio, "personalPhone", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT ("membershipId") DO UPDATE
        SET instagram = EXCLUDED.instagram,
            bio = EXCLUDED.bio,
            "personalPhone" = EXCLUDED."personalPhone",
            "updatedAt" = NOW()
      `,
      [
        input.membershipId,
        normalizeText(input.profile.instagram),
        normalizeText(input.profile.bio),
        normalizeText(input.profile.personalPhone),
      ],
    );

    if (Array.isArray(input.employeeSchedules) || Array.isArray(input.employeeServices)) {
      const userRes = await db.query<{ fullName: string | null }>(
        `SELECT "fullName" FROM "User" WHERE id = $1 LIMIT 1`,
        [member.userId],
      );
      const fallbackName = userRes.rows[0]?.fullName?.trim() || 'Empleado';
      const employeeByBranch = new Map<string, string>();

      const resolveEmployeeId = async (branchId: string) => {
        const cached = employeeByBranch.get(branchId);
        if (cached) return cached;

        const existingEmployeeRes = await db.query<{ id: string }>(
          `
            SELECT id
            FROM "Employee"
            WHERE "tenantId" = $1 AND "branchId" = $2 AND "membershipId" = $3
            LIMIT 1
          `,
          [input.tenantId, branchId, input.membershipId],
        );

        if (existingEmployeeRes.rows[0]) {
          const id = existingEmployeeRes.rows[0].id;
          employeeByBranch.set(branchId, id);
          return id;
        }

        const id = uuid();
        await db.query(
          `
            INSERT INTO "Employee" (id, "tenantId", "branchId", "membershipId", "fullName", "isActive", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
          `,
          [id, input.tenantId, branchId, input.membershipId, fallbackName],
        );
        employeeByBranch.set(branchId, id);
        return id;
      };

      for (const branchSchedule of input.employeeSchedules ?? []) {
        if (!validIds.has(branchSchedule.branchId)) {
          continue;
        }

        const employeeId = await resolveEmployeeId(branchSchedule.branchId);

        await db.query(`DELETE FROM "EmployeeSchedule" WHERE "employeeId" = $1`, [employeeId]);

        for (const row of branchSchedule.schedules) {
          const dayOfWeek = Number(row.dayOfWeek);
          const startTimeMin = Number(row.startTimeMin);
          const endTimeMin = Number(row.endTimeMin);

          if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) continue;
          if (!Number.isInteger(startTimeMin) || !Number.isInteger(endTimeMin)) continue;
          if (startTimeMin < 0 || endTimeMin > 24 * 60 || startTimeMin >= endTimeMin) continue;

          await db.query(
            `
              INSERT INTO "EmployeeSchedule" (id, "employeeId", "dayOfWeek", "startTimeMin", "endTimeMin", "createdAt")
              VALUES ($1, $2, $3, $4, $5, NOW())
            `,
            [uuid(), employeeId, dayOfWeek, startTimeMin, endTimeMin],
          );
        }
      }

      for (const branchServices of input.employeeServices ?? []) {
        if (!validIds.has(branchServices.branchId)) {
          continue;
        }

        const employeeId = await resolveEmployeeId(branchServices.branchId);
        const incomingIds = Array.isArray(branchServices.serviceIds)
          ? branchServices.serviceIds.map((id) => String(id)).filter(Boolean)
          : [];

        const validServicesRes = incomingIds.length
          ? await db.query<{ id: string }>(
              `
                SELECT id
                FROM "Service"
                WHERE "tenantId" = $1 AND "branchId" = $2 AND id = ANY($3::text[])
              `,
              [input.tenantId, branchServices.branchId, incomingIds],
            )
          : { rows: [] as Array<{ id: string }> };

        const validServiceIds = validServicesRes.rows.map((row) => row.id);
        await db.query(`DELETE FROM "ServiceAssignment" WHERE "employeeId" = $1`, [employeeId]);
        for (const serviceId of validServiceIds) {
          await db.query(
            `
              INSERT INTO "ServiceAssignment" (id, "employeeId", "serviceId", "createdAt")
              VALUES ($1, $2, $3, NOW())
              ON CONFLICT ("employeeId", "serviceId") DO NOTHING
            `,
            [uuid(), employeeId, serviceId],
          );
        }
      }
    }

    if (input.commissions) {
      const inventoryPercent = normalizePercentOrNull(input.commissions.inventoryPercent, 'La comisión de inventario');
      const fixedCents = normalizeNonNegativeIntOrNull(input.commissions.fixedCents, 'El fijo');

      const validCategoryIdsRes = await db.query<{ id: string }>(
        `
          SELECT id
          FROM "ServiceCategory"
          WHERE "tenantId" = $1
        `,
        [input.tenantId],
      );
      const validCategoryIds = new Set(validCategoryIdsRes.rows.map((row) => row.id));

      const categoryCommissions = (Array.isArray(input.commissions.categoryCommissions) ? input.commissions.categoryCommissions : [])
        .map((row) => {
          const categoryId = String(row?.categoryId ?? '').trim();
          if (!categoryId || !validCategoryIds.has(categoryId)) return null;
          const percent = normalizePercentOrNull(row?.percent, 'La comisión por categoría');
          if (percent === null) return null;
          return { categoryId, percent };
        })
        .filter((row): row is { categoryId: string; percent: number } => Boolean(row));

      await db.query(
        `
          DELETE FROM "MembershipCommissionCategoryRule"
          WHERE "membershipId" = $1
        `,
        [input.membershipId],
      );

      for (const row of categoryCommissions) {
        await db.query(
          `
            INSERT INTO "MembershipCommissionCategoryRule" (
              id, "membershipId", "serviceCategoryId", "percent", "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT ("membershipId", "serviceCategoryId")
            DO UPDATE SET "percent" = EXCLUDED."percent", "updatedAt" = NOW()
          `,
          [uuid(), input.membershipId, row.categoryId, row.percent],
        );
      }

      if (inventoryPercent === null && fixedCents === null && categoryCommissions.length === 0) {
        await db.query(`DELETE FROM "MembershipCommissionConfig" WHERE "membershipId" = $1`, [input.membershipId]);
      } else {
        await db.query(
          `
            INSERT INTO "MembershipCommissionConfig" ("membershipId", "inventoryPercent", "fixedCents", "updatedAt")
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT ("membershipId")
            DO UPDATE
            SET "inventoryPercent" = EXCLUDED."inventoryPercent",
                "fixedCents" = EXCLUDED."fixedCents",
                "updatedAt" = NOW()
          `,
          [input.membershipId, inventoryPercent, fixedCents],
        );
      }
    }

    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function deleteMembershipFromTenant(input: {
  actorUserId: string;
  tenantId: string;
  membershipId: string;
}) {
  await ensureCuentasTables();

  const scope = await getManageScope({ userId: input.actorUserId, tenantId: input.tenantId });
  if (!scope || !scope.canManageAccounts) {
    throw new Error('No tenés permisos para borrar usuarios');
  }

  const memberRes = await db.query<{
    membershipId: string;
    userId: string;
    role: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
  }>(
    `
      SELECT id AS "membershipId", "userId", role
      FROM "Membership"
      WHERE id = $1
        AND "tenantId" = $2
      LIMIT 1
    `,
    [input.membershipId, input.tenantId],
  );

  const member = memberRes.rows[0];
  if (!member) {
    throw new Error('Usuario no encontrado');
  }
  if (member.role === 'OWNER') {
    throw new Error('No se puede borrar al owner desde este panel');
  }
  if (member.userId === input.actorUserId) {
    throw new Error('No podés borrarte a vos mismo desde este panel');
  }

  if (scope.actor.role === 'MANAGER' && scope.manageableBranchIds) {
    const targetAccesses = await getMembershipBranchAccesses(input.membershipId);
    const hasOutOfScope = targetAccesses.some((entry) => !scope.manageableBranchIds?.has(entry.branchId));
    if (hasOutOfScope) {
      throw new Error('No podés borrar este usuario porque tiene accesos fuera de tu alcance');
    }
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `
        DELETE FROM "ContentCompetition"
        WHERE "tenantId" = $1
          AND "createdByMembershipId" = $2
      `,
      [input.tenantId, input.membershipId],
    );

    const employeesRes = await client.query<{ id: string }>(
      `
        SELECT id
        FROM "Employee"
        WHERE "tenantId" = $1
          AND "membershipId" = $2
      `,
      [input.tenantId, input.membershipId],
    );

    const employeeIds = employeesRes.rows.map((row) => row.id);

    if (employeeIds.length > 0) {
      const appointmentIdsRes = await client.query<{ id: string }>(
        `
          SELECT id
          FROM "Appointment"
          WHERE "tenantId" = $1
            AND "employeeId" = ANY($2::text[])
        `,
        [input.tenantId, employeeIds],
      );
      const appointmentIds = appointmentIdsRes.rows.map((row) => row.id);

      const saleIdsRes = await client.query<{ id: string }>(
        `
          SELECT DISTINCT ps.id
          FROM "PosSale" ps
          LEFT JOIN "PosSaleLine" psl ON psl."saleId" = ps.id
          WHERE ps."tenantId" = $1
            AND (
              (cardinality($2::text[]) > 0 AND ps."appointmentId" = ANY($2::text[]))
              OR psl."employeeId" = ANY($3::text[])
            )
        `,
        [input.tenantId, appointmentIds, employeeIds],
      );
      const saleIds = saleIdsRes.rows.map((row) => row.id);

      if (saleIds.length > 0) {
        await client.query(
          `
            DELETE FROM "CustomerPointsRedemption"
            WHERE "posSaleId" = ANY($1::text[])
          `,
          [saleIds],
        );

        await client.query(
          `
            DELETE FROM "PosSale"
            WHERE id = ANY($1::text[])
          `,
          [saleIds],
        );
      }

      if (appointmentIds.length > 0) {
        await client.query(
          `
            DELETE FROM "Appointment"
            WHERE id = ANY($1::text[])
          `,
          [appointmentIds],
        );
      }

      await client.query(
        `
          DELETE FROM "Employee"
          WHERE id = ANY($1::text[])
        `,
        [employeeIds],
      );
    }

    await client.query(`DELETE FROM "BranchAccess" WHERE "membershipId" = $1`, [input.membershipId]);
    await client.query(`DELETE FROM "StaffProfile" WHERE "membershipId" = $1`, [input.membershipId]);
    await client.query(
      `
        DELETE FROM "UserOnboardingProgress"
        WHERE "userId" = $1
          AND "tenantId" = $2
      `,
      [member.userId, input.tenantId],
    );
    await client.query(
      `
        DELETE FROM "UserTenantContext"
        WHERE "userId" = $1
          AND "tenantId" = $2
      `,
      [member.userId, input.tenantId],
    );
    await client.query(
      `
        DELETE FROM "Membership"
        WHERE id = $1
          AND "tenantId" = $2
      `,
      [input.membershipId, input.tenantId],
    );

    await client.query('COMMIT');
    return { ok: true, membershipId: input.membershipId, userId: member.userId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function parseBranchAccesses(input: unknown): Array<{ branchId: string; permissions: BranchPermission[] }> {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((row) => {
      const record = row as { branchId?: unknown; permissions?: unknown };
      const branchId = String(record?.branchId ?? '').trim();
      if (!branchId) return null;
      return {
        branchId,
        permissions: normalizePermissions(record.permissions),
      };
    })
    .filter((row): row is { branchId: string; permissions: BranchPermission[] } => Boolean(row));
}

function parseSchedules(input: unknown) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((row) => {
      const record = row as {
        branchId?: unknown;
        employeeId?: unknown;
        fullName?: unknown;
        serviceIds?: unknown;
        schedules?: unknown;
      };

      const branchId = String(record?.branchId ?? '').trim();
      if (!branchId) return null;

      const schedules = Array.isArray(record?.schedules)
        ? record.schedules
            .map((item) => {
              const entry = item as { dayOfWeek?: unknown; startTimeMin?: unknown; endTimeMin?: unknown };
              return {
                dayOfWeek: Number(entry.dayOfWeek),
                startTimeMin: Number(entry.startTimeMin),
                endTimeMin: Number(entry.endTimeMin),
              };
            })
            .filter(
              (entry) =>
                Number.isInteger(entry.dayOfWeek) &&
                entry.dayOfWeek >= 0 &&
                entry.dayOfWeek <= 6 &&
                Number.isInteger(entry.startTimeMin) &&
                Number.isInteger(entry.endTimeMin),
            )
        : [];

      return {
        branchId,
        employeeId: String(record?.employeeId ?? ''),
        fullName: String(record?.fullName ?? ''),
        serviceIds: Array.isArray(record?.serviceIds)
          ? record.serviceIds.map((item) => String(item)).filter(Boolean)
          : [],
        schedules,
      };
    })
    .filter(Boolean);
}

function parseIdList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => String(item)).map((value) => value.trim()).filter(Boolean);
}
