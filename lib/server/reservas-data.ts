import { db } from './db';
import { getTenantBillingStatus } from './admin-data';
import { ensureAppointmentLineServiceFkDeleteSetNull } from './schema-fixes';
import { createCharacteristicServiceForBranchIfNeeded } from './tenant-onboarding-data';

export type AssignmentStrategy = 'ROTATIVE' | 'LOAD_BALANCE' | 'FIRST_AVAILABLE' | 'BEST_RATED';

type BranchProfile = {
  branchId: string;
  address: string | null;
  phone: string | null;
  showServicePrices: boolean;
  policyText: string | null;
  cancellationEnabled: boolean;
  depositType: 'NONE' | 'PERCENTAGE' | 'FIXED';
  depositAmount: number;
  publicNote: string | null;
  profilePhotoUrl: string | null;
  bannerPhotoUrl: string | null;
  carouselPhotoUrls: string[];
  useCustomWhatsappApi: boolean;
  whatsappMetaAccessToken: string | null;
  whatsappMetaPhoneNumberId: string | null;
  whatsappMetaGraphVersion: string | null;
  whatsappMetaOtpTemplateName: string | null;
  whatsappMetaOtpTemplateLang: string | null;
  mercadoPagoPublicKey: string | null;
  mercadoPagoAccessToken: string | null;
  chatgptApiKey: string | null;
  createdAt: string;
  updatedAt: string;
};

type TenantVisualProfile = {
  tenantId: string;
  logoPhotoUrl: string | null;
  bannerPhotoUrl: string | null;
  updatedAt: string;
};

function toIso(value: any): string {
  return new Date(value).toISOString();
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function parseJsonArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function isLocalHost(value: string) {
  const host = value.toLowerCase();
  return host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0') || host.includes('::1');
}

function normalizePublicBaseUrl(value: string | null | undefined) {
  const fallback = 'https://galto.online';
  const candidate = (value ?? '').trim() || fallback;
  try {
    const url = new URL(candidate);
    if (isLocalHost(url.host)) {
      return fallback;
    }
    return `${url.protocol}//${url.host}`.replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

export async function ensureTenantArchiveColumn() {
  await db.query(`
    ALTER TABLE "Tenant"
    ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ
  `);
}

export async function ensureReservasTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "TenantVisualProfile" (
      "tenantId" TEXT PRIMARY KEY REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "logoPhotoUrl" TEXT,
      "bannerPhotoUrl" TEXT,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "BranchProfile" (
      "branchId" TEXT PRIMARY KEY REFERENCES "Branch"(id) ON DELETE CASCADE,
      "address" TEXT,
      "phone" TEXT,
      "showServicePrices" BOOLEAN NOT NULL DEFAULT TRUE,
      "policyText" TEXT,
      "cancellationEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "depositType" TEXT NOT NULL DEFAULT 'NONE',
      "depositAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "publicNote" TEXT,
      "profilePhotoUrl" TEXT,
      "bannerPhotoUrl" TEXT,
      "carouselPhotoUrls" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "useCustomWhatsappApi" BOOLEAN NOT NULL DEFAULT FALSE,
      "whatsappMetaAccessToken" TEXT,
      "whatsappMetaPhoneNumberId" TEXT,
      "whatsappMetaGraphVersion" TEXT,
      "whatsappMetaOtpTemplateName" TEXT,
      "whatsappMetaOtpTemplateLang" TEXT,
      "mercadoPagoPublicKey" TEXT,
      "mercadoPagoAccessToken" TEXT,
      "chatgptApiKey" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "BranchProfile_depositType_check" CHECK ("depositType" IN ('NONE','PERCENTAGE','FIXED'))
    )
  `);
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "address" TEXT');
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "phone" TEXT');
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "showServicePrices" BOOLEAN NOT NULL DEFAULT TRUE');
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "useCustomWhatsappApi" BOOLEAN NOT NULL DEFAULT FALSE');
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaAccessToken" TEXT');
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaPhoneNumberId" TEXT');
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaGraphVersion" TEXT');
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaOtpTemplateName" TEXT');
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaOtpTemplateLang" TEXT');
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "mercadoPagoPublicKey" TEXT');
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "mercadoPagoAccessToken" TEXT');
  await db.query('ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "chatgptApiKey" TEXT');
  await db.query('ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "description" TEXT');
  await db.query('ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT');
  await db.query('ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "requiresDeposit" BOOLEAN NOT NULL DEFAULT FALSE');
  await ensureAppointmentLineServiceFkDeleteSetNull();
}

export async function listUserTenants(userId: string) {
  await ensureTenantArchiveColumn();

  const { rows } = await db.query<{
    membershipId: string;
    role: string;
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
  }>(
    `
      SELECT
        m.id as "membershipId",
        m.role,
        t.id as "tenantId",
        t.slug as "tenantSlug",
        t.name as "tenantName"
      FROM "Membership" m
      INNER JOIN "Tenant" t ON t.id = m."tenantId"
      WHERE m."userId" = $1
        AND t."archivedAt" IS NULL
      ORDER BY m."createdAt" DESC
    `,
    [userId],
  );

  return rows;
}

export async function assertTenantAccess(userId: string, tenantId: string) {
  await ensureTenantArchiveColumn();

  const result = await db.query(
    `
      SELECT m.id, m.role
      FROM "Membership" m
      WHERE m."userId" = $1 AND m."tenantId" = $2
        AND EXISTS (
          SELECT 1
          FROM "Tenant" t
          WHERE t.id = m."tenantId" AND t."archivedAt" IS NULL
        )
      LIMIT 1
    `,
    [userId, tenantId],
  );

  return result.rows[0] ?? null;
}

export async function listBranchesForTenant(tenantId: string) {
  const { rows } = await db.query<{
    id: string;
    name: string;
    slug: string;
    timeZone: string;
    allowChooseEmployee: boolean;
    assignmentStrategy: AssignmentStrategy;
    createdAt: Date;
  }>(
    `
      SELECT id, name, slug, "timeZone", "allowChooseEmployee", "assignmentStrategy", "createdAt"
      FROM "Branch"
      WHERE "tenantId" = $1
      ORDER BY "createdAt" ASC
    `,
    [tenantId],
  );

  return rows.map((row) => ({
    ...row,
    createdAt: toIso(row.createdAt),
  }));
}

export async function listCalendarBranchesForUser(input: { tenantId: string; userId: string }) {
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
    assignmentStrategy: AssignmentStrategy;
    createdAt: Date;
  }>(
    `
      SELECT DISTINCT
        b.id, b.name, b.slug, b."timeZone", b."allowChooseEmployee", b."assignmentStrategy", b."createdAt"
      FROM "Branch" b
      INNER JOIN "BranchAccess" ba ON ba."branchId" = b.id
      WHERE b."tenantId" = $1
        AND ba."membershipId" = $2
        AND (
          ba.permissions ? 'APPOINTMENTS_READ'
          OR ba.permissions ? 'APPOINTMENTS_WRITE'
        )
      ORDER BY b."createdAt" ASC
    `,
    [input.tenantId, membership.id],
  );

  return rows.map((row) => ({
    ...row,
    createdAt: toIso(row.createdAt),
  }));
}

export async function createBranchForTenant(input: {
  userId: string;
  tenantId: string;
  name: string;
  slug?: string;
  timeZone?: string;
}) {
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) {
    throw new Error('Sin acceso al tenant');
  }
  if (membership.role !== 'OWNER') {
    throw new Error('Solo el owner puede crear sucursales');
  }

  const branchCountRes = await db.query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM "Branch"
      WHERE "tenantId" = $1
    `,
    [input.tenantId],
  );
  const existingBranches = Number(branchCountRes.rows[0]?.total ?? 0);
  if (existingBranches >= 1) {
    const billing = await getTenantBillingStatus(input.tenantId);
    const hasPaidFull = billing.plan?.planType === 'PAID_FULL' && billing.plan?.isPaid;
    const includedSlots = Number(billing.includedBranchSlots ?? (hasPaidFull ? 1 : 1));
    if (!hasPaidFull) {
      throw new Error('Para tener más de una sucursal necesitás Plan Profesional activo.');
    }
    if (existingBranches >= Math.max(1, includedSlots)) {
      const error = new Error('Necesitás ampliar tu plan para agregar otra sucursal');
      (error as any).code = 'BRANCH_LIMIT_REQUIRES_PAYMENT';
      throw error;
    }
  }

  const baseSlug = normalizeSlug(input.slug || input.name || 'sucursal') || 'sucursal';
  let candidate = baseSlug;
  let i = 1;
  while (true) {
    const existing = await db.query(
      `SELECT id FROM "Branch" WHERE "tenantId" = $1 AND slug = $2 LIMIT 1`,
      [input.tenantId, candidate],
    );
    if (!existing.rows[0]) break;
    i += 1;
    candidate = `${baseSlug}-${i}`;
  }

  const { rows } = await db.query<{
    id: string;
    tenantId: string;
    name: string;
    slug: string;
    timeZone: string;
    allowChooseEmployee: boolean;
    assignmentStrategy: AssignmentStrategy;
  }>(
    `
      INSERT INTO "Branch" (
        id,
        "tenantId",
        name,
        slug,
        "timeZone",
        "allowChooseEmployee",
        "assignmentStrategy",
        "createdAt",
        "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, false, 'ROTATIVE', NOW(), NOW())
      RETURNING id, "tenantId", name, slug, "timeZone", "allowChooseEmployee", "assignmentStrategy"
    `,
    [input.tenantId, input.name.trim(), candidate, input.timeZone?.trim() || 'America/Argentina/Buenos_Aires'],
  );

  await ensureReservasTables();
  await db.query(
    `
      INSERT INTO "BranchProfile" ("branchId")
      VALUES ($1)
      ON CONFLICT ("branchId") DO NOTHING
    `,
    [rows[0].id],
  );

  await createCharacteristicServiceForBranchIfNeeded({
    tenantId: input.tenantId,
    branchId: rows[0].id,
  });

  return rows[0];
}

export async function deleteBranchForTenant(input: { userId: string; tenantId: string; branchId: string }) {
  await ensureAppointmentLineServiceFkDeleteSetNull();

  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) {
    throw new Error('Sin acceso al tenant');
  }
  if (membership.role !== 'OWNER') {
    throw new Error('Solo el owner puede dar de baja sucursales');
  }

  const branchRes = await db.query<{ id: string; name: string }>(
    `
      SELECT id, name
      FROM "Branch"
      WHERE id = $1 AND "tenantId" = $2
      LIMIT 1
    `,
    [input.branchId, input.tenantId],
  );
  const branch = branchRes.rows[0];
  if (!branch) {
    throw new Error('Sucursal no encontrada');
  }

  try {
    await db.query(
      `
        UPDATE "AppointmentLine" l
        SET "serviceId" = NULL
        FROM "Service" s
        WHERE l."serviceId" = s.id
          AND s."branchId" = $1
          AND s."tenantId" = $2
      `,
      [input.branchId, input.tenantId],
    );

    const deletedRes = await db.query<{ id: string; name: string }>(
      `
        DELETE FROM "Branch"
        WHERE id = $1 AND "tenantId" = $2
        RETURNING id, name
      `,
      [input.branchId, input.tenantId],
    );
    return deletedRes.rows[0] ?? null;
  } catch {
    throw new Error('No se pudo dar de baja la sucursal porque tiene datos vinculados');
  }
}

export async function getBranchFullConfig(tenantId: string, branchId: string) {
  await ensureReservasTables();

  const branchResult = await db.query<{
    id: string;
    tenantId: string;
    name: string;
    slug: string;
    timeZone: string;
    allowChooseEmployee: boolean;
    assignmentStrategy: AssignmentStrategy;
  }>(
    `
      SELECT id, "tenantId", name, slug, "timeZone", "allowChooseEmployee", "assignmentStrategy"
      FROM "Branch"
      WHERE id = $1 AND "tenantId" = $2
      LIMIT 1
    `,
    [branchId, tenantId],
  );

  const branch = branchResult.rows[0];
  if (!branch) {
    return null;
  }

  const profileResult = await db.query<any>(
    `
      SELECT *
      FROM "BranchProfile"
      WHERE "branchId" = $1
      LIMIT 1
    `,
    [branchId],
  );

  const tenantVisualResult = await db.query<{
    tenantId: string;
    logoPhotoUrl: string | null;
    bannerPhotoUrl: string | null;
    updatedAt: Date;
  }>(
    `
      SELECT "tenantId", "logoPhotoUrl", "bannerPhotoUrl", "updatedAt"
      FROM "TenantVisualProfile"
      WHERE "tenantId" = $1
      LIMIT 1
    `,
    [tenantId],
  );

  const scheduleResult = await db.query<{
    id: string;
    dayOfWeek: number;
    startTimeMin: number;
    endTimeMin: number;
  }>(
    `
      SELECT id, "dayOfWeek", "startTimeMin", "endTimeMin"
      FROM "BranchSchedule"
      WHERE "branchId" = $1
      ORDER BY "dayOfWeek" ASC, "startTimeMin" ASC
    `,
    [branchId],
  );

  const categoriesResult = await db.query<{
    id: string;
    name: string;
    sortOrder: number;
  }>(
    `
      SELECT id, name, "sortOrder"
      FROM "ServiceCategory"
      WHERE "branchId" = $1
      ORDER BY "sortOrder" ASC, name ASC
    `,
    [branchId],
  );

  const servicesResult = await db.query<{
    id: string;
    name: string;
    durationMins: number;
    priceCents: number;
    isActive: boolean;
    description: string | null;
    imageUrl: string | null;
    requiresDeposit: boolean;
    categoryId: string | null;
    categoryName: string | null;
  }>(
    `
      SELECT
        s.id,
        s.name,
        s."durationMins",
        s."priceCents",
        s."isActive",
        s."description",
        s."imageUrl",
        s."requiresDeposit",
        s."categoryId",
        c.name as "categoryName"
      FROM "Service" s
      LEFT JOIN "ServiceCategory" c ON c.id = s."categoryId"
      WHERE s."branchId" = $1
      ORDER BY s."createdAt" ASC
    `,
    [branchId],
  );

  const employeesResult = await db.query<{
    id: string;
    fullName: string;
    isActive: boolean;
  }>(
    `
      SELECT id, "fullName", "isActive"
      FROM "Employee"
      WHERE "branchId" = $1
      ORDER BY "createdAt" ASC
    `,
    [branchId],
  );

  const employeeIds = employeesResult.rows.map((row) => row.id);
  const employeeSchedules = employeeIds.length
    ? (
        await db.query<{
          employeeId: string;
          dayOfWeek: number;
          startTimeMin: number;
          endTimeMin: number;
        }>(
          `
            SELECT "employeeId", "dayOfWeek", "startTimeMin", "endTimeMin"
            FROM "EmployeeSchedule"
            WHERE "employeeId" = ANY($1::text[])
            ORDER BY "dayOfWeek" ASC, "startTimeMin" ASC
          `,
          [employeeIds],
        )
      ).rows
    : [];

  const employeeAssignments = employeeIds.length
    ? (
        await db.query<{
          employeeId: string;
          serviceId: string;
        }>(
          `
            SELECT "employeeId", "serviceId"
            FROM "ServiceAssignment"
            WHERE "employeeId" = ANY($1::text[])
          `,
          [employeeIds],
        )
      ).rows
    : [];

  const profileRow = profileResult.rows[0];
  const profile: BranchProfile = {
    branchId,
    address: profileRow?.address ?? null,
    phone: profileRow?.phone ?? null,
    showServicePrices: profileRow?.showServicePrices ?? true,
    policyText: profileRow?.policyText ?? null,
    cancellationEnabled: profileRow?.cancellationEnabled ?? true,
    depositType: profileRow?.depositType ?? 'NONE',
    depositAmount: Number(profileRow?.depositAmount ?? 0),
    publicNote: profileRow?.publicNote ?? null,
    profilePhotoUrl: profileRow?.profilePhotoUrl ?? null,
    bannerPhotoUrl: profileRow?.bannerPhotoUrl ?? null,
    carouselPhotoUrls: parseJsonArray(profileRow?.carouselPhotoUrls ?? []),
    useCustomWhatsappApi: Boolean(profileRow?.useCustomWhatsappApi),
    whatsappMetaAccessToken: profileRow?.whatsappMetaAccessToken ?? null,
    whatsappMetaPhoneNumberId: profileRow?.whatsappMetaPhoneNumberId ?? null,
    whatsappMetaGraphVersion: profileRow?.whatsappMetaGraphVersion ?? null,
    whatsappMetaOtpTemplateName: profileRow?.whatsappMetaOtpTemplateName ?? null,
    whatsappMetaOtpTemplateLang: profileRow?.whatsappMetaOtpTemplateLang ?? null,
    mercadoPagoPublicKey: profileRow?.mercadoPagoPublicKey ?? null,
    mercadoPagoAccessToken: profileRow?.mercadoPagoAccessToken ?? null,
    chatgptApiKey: profileRow?.chatgptApiKey ?? null,
    createdAt: profileRow?.createdAt ? toIso(profileRow.createdAt) : new Date().toISOString(),
    updatedAt: profileRow?.updatedAt ? toIso(profileRow.updatedAt) : new Date().toISOString(),
  };

  const tenantVisualRow = tenantVisualResult.rows[0];
  const tenantVisual: TenantVisualProfile = {
    tenantId,
    logoPhotoUrl: tenantVisualRow?.logoPhotoUrl ?? null,
    bannerPhotoUrl: tenantVisualRow?.bannerPhotoUrl ?? null,
    updatedAt: tenantVisualRow?.updatedAt ? toIso(tenantVisualRow.updatedAt) : new Date().toISOString(),
  };

  return {
    branch,
    tenantVisual,
    profile,
    schedules: scheduleResult.rows,
    categories: categoriesResult.rows,
    services: servicesResult.rows,
    employees: employeesResult.rows.map((employee) => ({
      ...employee,
      schedules: employeeSchedules.filter((schedule) => schedule.employeeId === employee.id),
      serviceIds: employeeAssignments
        .filter((assignment) => assignment.employeeId === employee.id)
        .map((assignment) => assignment.serviceId),
    })),
  };
}

export async function updateBranchConfig(input: {
  tenantId: string;
  branchId: string;
  branch: {
    name: string;
    timeZone: string;
    allowChooseEmployee: boolean;
    assignmentStrategy: AssignmentStrategy;
  };
  profile: {
    address?: string | null;
    phone?: string | null;
    showServicePrices?: boolean;
    policyText?: string | null;
    cancellationEnabled?: boolean;
    depositType?: 'NONE' | 'PERCENTAGE' | 'FIXED';
    depositAmount?: number;
    publicNote?: string | null;
    profilePhotoUrl?: string | null;
    bannerPhotoUrl?: string | null;
    carouselPhotoUrls?: string[];
    useCustomWhatsappApi?: boolean;
    whatsappMetaAccessToken?: string | null;
    whatsappMetaPhoneNumberId?: string | null;
    whatsappMetaGraphVersion?: string | null;
    whatsappMetaOtpTemplateName?: string | null;
    whatsappMetaOtpTemplateLang?: string | null;
    mercadoPagoPublicKey?: string | null;
    mercadoPagoAccessToken?: string | null;
    chatgptApiKey?: string | null;
  };
  tenantVisual?: {
    logoPhotoUrl?: string | null;
    bannerPhotoUrl?: string | null;
  };
  schedules: Array<{ dayOfWeek: number; startTimeMin: number; endTimeMin: number }>;
}) {
  await ensureReservasTables();
  const normalizedBranchName = input.branch.name.trim();
  if (normalizedBranchName.length < 2) {
    throw new Error('El nombre de la sucursal no puede estar vacío.');
  }

  await db.query(
    `
      UPDATE "Branch"
      SET
        name = $1,
        "timeZone" = $2,
        "allowChooseEmployee" = $3,
        "assignmentStrategy" = $4,
        "updatedAt" = NOW()
      WHERE id = $5 AND "tenantId" = $6
    `,
    [
      normalizedBranchName,
      input.branch.timeZone.trim() || 'America/Argentina/Buenos_Aires',
      input.branch.allowChooseEmployee,
      input.branch.assignmentStrategy,
      input.branchId,
      input.tenantId,
    ],
  );

  await db.query(
    `
      INSERT INTO "TenantVisualProfile" ("tenantId", "logoPhotoUrl", "bannerPhotoUrl", "updatedAt")
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT ("tenantId") DO UPDATE
      SET
        "logoPhotoUrl" = EXCLUDED."logoPhotoUrl",
        "bannerPhotoUrl" = EXCLUDED."bannerPhotoUrl",
        "updatedAt" = NOW()
    `,
    [
      input.tenantId,
      normalizeText(input.tenantVisual?.logoPhotoUrl),
      normalizeText(input.tenantVisual?.bannerPhotoUrl),
    ],
  );

  await db.query(
    `
      INSERT INTO "BranchProfile" (
        "branchId",
        "address",
        "phone",
        "showServicePrices",
        "policyText",
        "cancellationEnabled",
        "depositType",
        "depositAmount",
        "publicNote",
        "profilePhotoUrl",
        "bannerPhotoUrl",
        "carouselPhotoUrls",
        "useCustomWhatsappApi",
        "whatsappMetaAccessToken",
        "whatsappMetaPhoneNumberId",
        "whatsappMetaGraphVersion",
        "whatsappMetaOtpTemplateName",
        "whatsappMetaOtpTemplateLang",
        "mercadoPagoPublicKey",
        "mercadoPagoAccessToken",
        "chatgptApiKey",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())
      ON CONFLICT ("branchId") DO UPDATE
      SET
        "address" = EXCLUDED."address",
        "phone" = EXCLUDED."phone",
        "showServicePrices" = EXCLUDED."showServicePrices",
        "policyText" = EXCLUDED."policyText",
        "cancellationEnabled" = EXCLUDED."cancellationEnabled",
        "depositType" = EXCLUDED."depositType",
        "depositAmount" = EXCLUDED."depositAmount",
        "publicNote" = EXCLUDED."publicNote",
        "profilePhotoUrl" = EXCLUDED."profilePhotoUrl",
        "bannerPhotoUrl" = EXCLUDED."bannerPhotoUrl",
        "carouselPhotoUrls" = EXCLUDED."carouselPhotoUrls",
        "useCustomWhatsappApi" = EXCLUDED."useCustomWhatsappApi",
        "whatsappMetaAccessToken" = EXCLUDED."whatsappMetaAccessToken",
        "whatsappMetaPhoneNumberId" = EXCLUDED."whatsappMetaPhoneNumberId",
        "whatsappMetaGraphVersion" = EXCLUDED."whatsappMetaGraphVersion",
        "whatsappMetaOtpTemplateName" = EXCLUDED."whatsappMetaOtpTemplateName",
        "whatsappMetaOtpTemplateLang" = EXCLUDED."whatsappMetaOtpTemplateLang",
        "mercadoPagoPublicKey" = EXCLUDED."mercadoPagoPublicKey",
        "mercadoPagoAccessToken" = EXCLUDED."mercadoPagoAccessToken",
        "chatgptApiKey" = EXCLUDED."chatgptApiKey",
        "updatedAt" = NOW()
    `,
    [
      input.branchId,
      normalizeText(input.profile.address),
      normalizeText(input.profile.phone),
      input.profile.showServicePrices !== false,
      normalizeText(input.profile.policyText),
      Boolean(input.profile.cancellationEnabled),
      input.profile.depositType ?? 'NONE',
      Number(input.profile.depositAmount ?? 0),
      normalizeText(input.profile.publicNote),
      normalizeText(input.profile.profilePhotoUrl),
      normalizeText(input.profile.bannerPhotoUrl),
      JSON.stringify(parseJsonArray(input.profile.carouselPhotoUrls ?? [])),
      Boolean(input.profile.useCustomWhatsappApi),
      normalizeText(input.profile.whatsappMetaAccessToken),
      normalizeText(input.profile.whatsappMetaPhoneNumberId),
      normalizeText(input.profile.whatsappMetaGraphVersion),
      normalizeText(input.profile.whatsappMetaOtpTemplateName),
      normalizeText(input.profile.whatsappMetaOtpTemplateLang),
      normalizeText(input.profile.mercadoPagoPublicKey),
      normalizeText(input.profile.mercadoPagoAccessToken),
      normalizeText(input.profile.chatgptApiKey),
    ],
  );

  await db.query(`DELETE FROM "BranchSchedule" WHERE "branchId" = $1`, [input.branchId]);

  for (const schedule of input.schedules) {
    await db.query(
      `
        INSERT INTO "BranchSchedule" (id, "branchId", "dayOfWeek", "startTimeMin", "endTimeMin", "createdAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
      `,
      [input.branchId, schedule.dayOfWeek, schedule.startTimeMin, schedule.endTimeMin],
    );
  }
}

export async function createBranchService(input: {
  tenantId: string;
  branchId: string;
  name: string;
  durationMins: number;
  priceCents: number;
  categoryName?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  requiresDeposit?: boolean;
  isActive?: boolean;
}) {
  let categoryId: string | null = null;

  if (input.categoryName && input.categoryName.trim()) {
    const categoryName = input.categoryName.trim();
    const existing = await db.query<{ id: string }>(
      `
        SELECT id FROM "ServiceCategory"
        WHERE "tenantId" = $1 AND "branchId" = $2 AND lower(name) = lower($3)
        LIMIT 1
      `,
      [input.tenantId, input.branchId, categoryName],
    );

    if (existing.rows[0]) {
      categoryId = existing.rows[0].id;
    } else {
      const created = await db.query<{ id: string }>(
        `
          INSERT INTO "ServiceCategory" (id, "tenantId", "branchId", name, "sortOrder", "createdAt", "updatedAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3, 0, NOW(), NOW())
          RETURNING id
        `,
        [input.tenantId, input.branchId, categoryName],
      );
      categoryId = created.rows[0].id;
    }
  }

  const { rows } = await db.query(
    `
      INSERT INTO "Service" (
        id,
        "tenantId",
        "branchId",
        "categoryId",
        name,
        "durationMins",
        "priceCents",
        "description",
        "imageUrl",
        "requiresDeposit",
        "isActive",
        "createdAt",
        "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING id
    `,
    [
      input.tenantId,
      input.branchId,
      categoryId,
      input.name.trim(),
      input.durationMins,
      input.priceCents,
      normalizeText(input.description),
      normalizeText(input.imageUrl),
      Boolean(input.requiresDeposit),
      input.isActive ?? true,
    ],
  );

  return rows[0];
}

export async function updateBranchService(input: {
  tenantId: string;
  branchId: string;
  serviceId: string;
  name: string;
  durationMins: number;
  priceCents: number;
  categoryName?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  requiresDeposit?: boolean;
  isActive?: boolean;
}) {
  let categoryId: string | null = null;

  if (input.categoryName && input.categoryName.trim()) {
    const categoryName = input.categoryName.trim();
    const existing = await db.query<{ id: string }>(
      `
        SELECT id FROM "ServiceCategory"
        WHERE "tenantId" = $1 AND "branchId" = $2 AND lower(name) = lower($3)
        LIMIT 1
      `,
      [input.tenantId, input.branchId, categoryName],
    );

    if (existing.rows[0]) {
      categoryId = existing.rows[0].id;
    } else {
      const created = await db.query<{ id: string }>(
        `
          INSERT INTO "ServiceCategory" (id, "tenantId", "branchId", name, "sortOrder", "createdAt", "updatedAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3, 0, NOW(), NOW())
          RETURNING id
        `,
        [input.tenantId, input.branchId, categoryName],
      );
      categoryId = created.rows[0].id;
    }
  }

  await db.query(
    `
      UPDATE "Service"
      SET
        name = $1,
        "durationMins" = $2,
        "priceCents" = $3,
        "categoryId" = $4,
        "description" = $5,
        "imageUrl" = $6,
        "requiresDeposit" = $7,
        "isActive" = $8,
        "updatedAt" = NOW()
      WHERE id = $9 AND "tenantId" = $10 AND "branchId" = $11
    `,
    [
      input.name.trim(),
      Number(input.durationMins),
      Number(input.priceCents),
      categoryId,
      normalizeText(input.description),
      normalizeText(input.imageUrl),
      Boolean(input.requiresDeposit),
      input.isActive !== false,
      input.serviceId,
      input.tenantId,
      input.branchId,
    ],
  );
}

export async function deleteBranchService(input: { tenantId: string; branchId: string; serviceId: string }) {
  await ensureAppointmentLineServiceFkDeleteSetNull();

  await db.query(
    `
      UPDATE "AppointmentLine"
      SET "serviceId" = NULL
      WHERE "serviceId" = $1
    `,
    [input.serviceId],
  );

  await db.query(
    `
      DELETE FROM "Service"
      WHERE id = $1 AND "tenantId" = $2 AND "branchId" = $3
    `,
    [input.serviceId, input.tenantId, input.branchId],
  );
}

export async function createBranchEmployee(input: {
  tenantId: string;
  branchId: string;
  fullName: string;
  isActive: boolean;
  serviceIds: string[];
  schedules: Array<{ dayOfWeek: number; startTimeMin: number; endTimeMin: number }>;
}) {
  const employeeResult = await db.query<{ id: string }>(
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
    [input.tenantId, input.branchId, input.fullName.trim(), input.isActive],
  );

  const employeeId = employeeResult.rows[0].id;

  for (const schedule of input.schedules) {
    await db.query(
      `
        INSERT INTO "EmployeeSchedule" (id, "employeeId", "dayOfWeek", "startTimeMin", "endTimeMin", "createdAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
      `,
      [employeeId, schedule.dayOfWeek, schedule.startTimeMin, schedule.endTimeMin],
    );
  }

  for (const serviceId of input.serviceIds) {
    await db.query(
      `
        INSERT INTO "ServiceAssignment" (id, "employeeId", "serviceId", "createdAt")
        VALUES (gen_random_uuid()::text, $1, $2, NOW())
        ON CONFLICT ("employeeId", "serviceId") DO NOTHING
      `,
      [employeeId, serviceId],
    );
  }

  return { id: employeeId };
}

export async function getTenantBookingDomain(tenantId: string) {
  const tenantResult = await db.query<{ slug: string }>(
    `SELECT slug FROM "Tenant" WHERE id = $1 LIMIT 1`,
    [tenantId],
  );

  const slug = tenantResult.rows[0]?.slug;
  if (!slug) {
    return null;
  }

  const billing = await getTenantBillingStatus(tenantId);
  const planType = billing?.plan?.planType ?? null;
  const demoEndsAtRaw = billing?.plan?.demoEndsAt ?? null;
  const isPaid = Boolean(billing?.plan?.isPaid);
  const demoIsActive =
    planType === 'DEMO' &&
    (demoEndsAtRaw ? Number(new Date(demoEndsAtRaw)) > Date.now() : true);
  const bookingEnabled = isPaid || demoIsActive;
  const bookingBaseUrl = normalizePublicBaseUrl(process.env.BOOKING_PUBLIC_BASE_URL);
  const bookingPath = `/reservas?tenant=${encodeURIComponent(slug)}`;

  return {
    isPaid,
    domain: bookingEnabled ? bookingBaseUrl.replace(/^https?:\/\//, '') : null,
    bookingUrl: bookingEnabled ? `${bookingBaseUrl}${bookingPath}` : null,
    paymentStatus: demoIsActive ? 'DEMO_ACTIVE' : billing?.pendingPayment ? 'PENDING' : isPaid ? 'CONFIRMED' : 'NONE',
  };
}

function isE164Phone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

function parsePermissionList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string');
      }
    } catch {
      return [];
    }
  }
  return [];
}

export async function hasBranchPermission(input: {
  userId: string;
  tenantId: string;
  branchId: string;
  permission: string;
}) {
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) return false;
  if (membership.role === 'OWNER') return true;

  const accessRes = await db.query<{ permissions: unknown }>(
    `
      SELECT permissions
      FROM "BranchAccess"
      WHERE "membershipId" = $1 AND "branchId" = $2
      LIMIT 1
    `,
    [membership.id, input.branchId],
  );

  const permissions = parsePermissionList(accessRes.rows[0]?.permissions);
  return permissions.includes(input.permission);
}

export async function createWalkin(input: {
  tenantId: string;
  branchId: string;
  customerFullName: string;
  customerPhone: string;
  notes?: string | null;
  createdByUserId: string;
  items: Array<{ serviceId: string; employeeId: string }>;
}) {
  const fullName = input.customerFullName.trim();
  const phone = input.customerPhone.trim();
  if (fullName.length < 2) {
    throw new Error('El nombre del cliente es obligatorio');
  }
  if (!isE164Phone(phone)) {
    throw new Error('El teléfono debe estar en formato E.164');
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('Debés seleccionar al menos un servicio');
  }

  const normalizedItems = input.items
    .map((item) => ({
      serviceId: String(item.serviceId || '').trim(),
      employeeId: String(item.employeeId || '').trim(),
    }))
    .filter((item) => item.serviceId && item.employeeId);

  if (!normalizedItems.length) {
    throw new Error('Debés seleccionar al menos un servicio válido');
  }

  const branchRes = await db.query<{ id: string }>(
    `SELECT id FROM "Branch" WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
    [input.branchId, input.tenantId],
  );
  if (!branchRes.rows[0]) {
    throw new Error('Sucursal no encontrada');
  }

  const serviceIds = [...new Set(normalizedItems.map((item) => item.serviceId))];
  const employeeIds = [...new Set(normalizedItems.map((item) => item.employeeId))];

  const servicesRes = await db.query<{
    id: string;
    name: string;
    durationMins: number;
    priceCents: number;
    isActive: boolean;
  }>(
    `
      SELECT id, name, "durationMins", "priceCents", "isActive"
      FROM "Service"
      WHERE "tenantId" = $1 AND "branchId" = $2 AND id = ANY($3::text[])
    `,
    [input.tenantId, input.branchId, serviceIds],
  );

  const serviceMap = new Map(servicesRes.rows.map((service) => [service.id, service]));
  for (const serviceId of serviceIds) {
    const service = serviceMap.get(serviceId);
    if (!service || !service.isActive) {
      throw new Error('Uno de los servicios seleccionados no está disponible');
    }
  }

  const employeesRes = await db.query<{
    id: string;
    fullName: string;
    isActive: boolean;
  }>(
    `
      SELECT id, "fullName", "isActive"
      FROM "Employee"
      WHERE "tenantId" = $1 AND "branchId" = $2 AND id = ANY($3::text[])
    `,
    [input.tenantId, input.branchId, employeeIds],
  );

  const employeeMap = new Map(employeesRes.rows.map((employee) => [employee.id, employee]));
  for (const employeeId of employeeIds) {
    const employee = employeeMap.get(employeeId);
    if (!employee || !employee.isActive) {
      throw new Error('Uno de los trabajadores seleccionados no está disponible');
    }
  }

  const assignmentRes = await db.query<{ serviceId: string; employeeId: string }>(
    `
      SELECT "serviceId", "employeeId"
      FROM "ServiceAssignment"
      WHERE "employeeId" = ANY($1::text[]) AND "serviceId" = ANY($2::text[])
    `,
    [employeeIds, serviceIds],
  );
  const assignmentSet = new Set(assignmentRes.rows.map((row) => `${row.serviceId}:${row.employeeId}`));
  for (const item of normalizedItems) {
    if (!assignmentSet.has(`${item.serviceId}:${item.employeeId}`)) {
      throw new Error('Hay servicios asignados a un trabajador que no los ofrece');
    }
  }

  await db.query('BEGIN');
  try {
    for (const employeeId of employeeIds) {
      await db.query(`SELECT id FROM "Employee" WHERE id = $1 FOR UPDATE`, [employeeId]);
    }

    const customerRes = await db.query<{ id: string }>(
      `
        SELECT id
        FROM "Customer"
        WHERE "tenantId" = $1 AND phone = $2
        ORDER BY "updatedAt" DESC
        LIMIT 1
      `,
      [input.tenantId, phone],
    );

    let customerId = customerRes.rows[0]?.id ?? null;
    if (customerId) {
      await db.query(
        `
          UPDATE "Customer"
          SET "fullName" = $1, "updatedAt" = NOW()
          WHERE id = $2
        `,
        [fullName, customerId],
      );
    } else {
      const createdCustomerRes = await db.query<{ id: string }>(
        `
          INSERT INTO "Customer" (id, "tenantId", "fullName", phone, "createdAt", "updatedAt")
          VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
          RETURNING id
        `,
        [input.tenantId, fullName, phone],
      );
      customerId = createdCustomerRes.rows[0].id;
    }

    const now = new Date();
    let offsetMinutes = 0;
    const createdAppointments: Array<{
      id: string;
      employeeId: string;
      employeeName: string;
      serviceId: string;
      serviceName: string;
      startsAt: string;
      endsAt: string;
      priceCents: number;
    }> = [];

    for (const item of normalizedItems) {
      const service = serviceMap.get(item.serviceId)!;
      const employee = employeeMap.get(item.employeeId)!;

      const startsAt = new Date(now.getTime() + offsetMinutes * 60 * 1000);
      const endsAt = new Date(startsAt.getTime() + Number(service.durationMins) * 60 * 1000);

      const overlapRes = await db.query<{ id: string }>(
        `
          SELECT id
          FROM "Appointment"
          WHERE "employeeId" = $1
            AND status <> 'CANCELLED'
            AND "startsAt" < $2
            AND "endsAt" > $3
          LIMIT 1
        `,
        [item.employeeId, endsAt.toISOString(), startsAt.toISOString()],
      );
      if (overlapRes.rows[0]) {
        throw new Error(`El trabajador ${employee.fullName} ya tiene un turno en ese horario`);
      }

      const appointmentRes = await db.query<{ id: string }>(
        `
          INSERT INTO "Appointment" (
            id, "tenantId", "branchId", "employeeId", "customerId", "customerUserId",
            "createdBy", status, "startsAt", "endsAt", "totalChargedCents", notes, "createdAt", "updatedAt"
          )
          VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, NULL,
            'STAFF', 'COMPLETED', $5, $6, $7, $8, NOW(), NOW()
          )
          RETURNING id
        `,
        [
          input.tenantId,
          input.branchId,
          item.employeeId,
          customerId,
          startsAt.toISOString(),
          endsAt.toISOString(),
          Number(service.priceCents ?? 0),
          normalizeText(input.notes),
        ],
      );

      await db.query(
        `
          INSERT INTO "AppointmentLine" (
            id, "appointmentId", "serviceId", "serviceNameSnapshot", "durationMins", "priceCents", "createdAt"
          )
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW())
        `,
        [
          appointmentRes.rows[0].id,
          service.id,
          service.name,
          Number(service.durationMins),
          Number(service.priceCents ?? 0),
        ],
      );

      createdAppointments.push({
        id: appointmentRes.rows[0].id,
        employeeId: employee.id,
        employeeName: employee.fullName,
        serviceId: service.id,
        serviceName: service.name,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        priceCents: Number(service.priceCents ?? 0),
      });

      offsetMinutes += Number(service.durationMins);
    }

    await db.query('COMMIT');

    return {
      customer: {
        id: customerId,
        fullName,
        phone,
      },
      appointments: createdAppointments,
      totalChargedCents: createdAppointments.reduce((sum, row) => sum + row.priceCents, 0),
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function listRecentWalkins(input: { tenantId: string; branchId: string; limit?: number }) {
  const limit = Math.min(Math.max(Number(input.limit ?? 20), 1), 100);
  const rows = await db.query<{
    appointmentId: string;
    customerName: string | null;
    customerPhone: string | null;
    employeeName: string;
    startsAt: Date;
    endsAt: Date;
    totalChargedCents: number;
    status: string;
    serviceName: string;
  }>(
    `
      SELECT
        a.id as "appointmentId",
        c."fullName" as "customerName",
        c.phone as "customerPhone",
        e."fullName" as "employeeName",
        a."startsAt",
        a."endsAt",
        a."totalChargedCents",
        a.status::text as status,
        l."serviceNameSnapshot" as "serviceName"
      FROM "Appointment" a
      INNER JOIN "AppointmentLine" l ON l."appointmentId" = a.id
      LEFT JOIN "Customer" c ON c.id = a."customerId" AND c."archivedAt" IS NULL
      INNER JOIN "Employee" e ON e.id = a."employeeId"
      WHERE a."tenantId" = $1
        AND a."branchId" = $2
        AND a."createdBy" = 'STAFF'
      ORDER BY a."createdAt" DESC
      LIMIT $3
    `,
    [input.tenantId, input.branchId, limit],
  );

  return rows.rows.map((row) => ({
    appointmentId: row.appointmentId,
    customerName: row.customerName ?? 'Cliente',
    customerPhone: row.customerPhone,
    employeeName: row.employeeName,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    totalChargedCents: Number(row.totalChargedCents ?? 0),
    status: row.status,
    serviceName: row.serviceName,
  }));
}

export async function listBranchAppointments(input: {
  tenantId: string;
  branchId: string;
  fromIso: string;
  toIso: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(Number(input.limit ?? 500), 1), 2000);

  const result = await db.query<{
    appointmentId: string;
    status: string;
    createdBy: string;
    startsAt: Date;
    endsAt: Date;
    totalChargedCents: number;
    customerName: string | null;
    customerPhone: string | null;
    employeeId: string;
    employeeName: string;
    lineId: string | null;
    serviceId: string | null;
    serviceName: string | null;
    lineDurationMins: number | null;
    linePriceCents: number | null;
  }>(
    `
      SELECT
        a.id as "appointmentId",
        a.status::text as status,
        a."createdBy"::text as "createdBy",
        a."startsAt",
        a."endsAt",
        a."totalChargedCents",
        c."fullName" as "customerName",
        c.phone as "customerPhone",
        e.id as "employeeId",
        e."fullName" as "employeeName",
        l.id as "lineId",
        l."serviceId",
        l."serviceNameSnapshot" as "serviceName",
        l."durationMins" as "lineDurationMins",
        l."priceCents" as "linePriceCents"
      FROM "Appointment" a
      LEFT JOIN "Customer" c ON c.id = a."customerId" AND c."archivedAt" IS NULL
      INNER JOIN "Employee" e ON e.id = a."employeeId"
      LEFT JOIN "AppointmentLine" l ON l."appointmentId" = a.id
      WHERE a."tenantId" = $1
        AND a."branchId" = $2
        AND a."startsAt" >= $3::timestamptz
        AND a."startsAt" < $4::timestamptz
      ORDER BY a."startsAt" ASC, a."createdAt" ASC
      LIMIT $5
    `,
    [input.tenantId, input.branchId, input.fromIso, input.toIso, limit],
  );

  const map = new Map<
    string,
    {
      appointmentId: string;
      status: string;
      createdBy: string;
      startsAt: string;
      endsAt: string;
      totalChargedCents: number;
      customer: { fullName: string | null; phone: string | null };
      employee: { id: string; fullName: string };
      lines: Array<{
        id: string;
        serviceId: string | null;
        serviceName: string | null;
        durationMins: number;
        priceCents: number;
      }>;
    }
  >();

  for (const row of result.rows) {
    const existing = map.get(row.appointmentId);
    if (!existing) {
      map.set(row.appointmentId, {
        appointmentId: row.appointmentId,
        status: row.status,
        createdBy: row.createdBy,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        totalChargedCents: Number(row.totalChargedCents ?? 0),
        customer: {
          fullName: row.customerName,
          phone: row.customerPhone,
        },
        employee: {
          id: row.employeeId,
          fullName: row.employeeName,
        },
        lines: row.lineId
          ? [
              {
                id: row.lineId,
                serviceId: row.serviceId,
                serviceName: row.serviceName,
                durationMins: Number(row.lineDurationMins ?? 0),
                priceCents: Number(row.linePriceCents ?? 0),
              },
            ]
          : [],
      });
      continue;
    }

    if (row.lineId && !existing.lines.some((line) => line.id === row.lineId)) {
      existing.lines.push({
        id: row.lineId,
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        durationMins: Number(row.lineDurationMins ?? 0),
        priceCents: Number(row.linePriceCents ?? 0),
      });
    }
  }

  return Array.from(map.values());
}
