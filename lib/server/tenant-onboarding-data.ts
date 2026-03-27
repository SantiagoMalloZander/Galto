import { db } from './db';

export type BusinessLine = 'BARBERIA' | 'PELUQUERIA' | 'ESTETICA';

export type TenantOnboardingProfile = {
  tenantId: string;
  businessLine: BusinessLine;
  workersCount: number;
  countryCode: string;
  countryName: string;
  createdAt: string;
  updatedAt: string;
};

type CharacteristicServiceTemplate = {
  name: string;
  categoryName: string;
  durationMins: number;
  priceCents: number;
};

const DEFAULT_BUSINESS_LINE: BusinessLine = 'BARBERIA';

function toIso(value: unknown): string {
  return new Date(value as any).toISOString();
}

function normalizeCountryCode(value: unknown): string {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw.length < 2) return 'AR';
  return raw.slice(0, 2);
}

function normalizeCountryName(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Argentina';
  return raw.slice(0, 80);
}

function normalizeWorkersCount(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(500, Math.max(1, parsed));
}

function normalizeBusinessLine(value: unknown): BusinessLine {
  const candidate = String(value ?? '').trim().toUpperCase();
  if (candidate === 'PELUQUERIA') return 'PELUQUERIA';
  if (candidate === 'ESTETICA') return 'ESTETICA';
  return 'BARBERIA';
}

function getCharacteristicServiceTemplate(businessLine: BusinessLine): CharacteristicServiceTemplate {
  if (businessLine === 'PELUQUERIA') {
    return {
      name: 'Corte y peinado',
      categoryName: 'Peluqueria',
      durationMins: 60,
      priceCents: 1800000,
    };
  }

  if (businessLine === 'ESTETICA') {
    return {
      name: 'Limpieza facial',
      categoryName: 'Estetica',
      durationMins: 60,
      priceCents: 2200000,
    };
  }

  return {
    name: 'Corte clasico',
    categoryName: 'Cortes',
    durationMins: 45,
    priceCents: 1200000,
  };
}

export async function ensureTenantOnboardingProfileTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "TenantOnboardingProfile" (
      "tenantId" TEXT PRIMARY KEY REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "businessLine" TEXT NOT NULL DEFAULT 'BARBERIA',
      "workersCount" INTEGER NOT NULL DEFAULT 1,
      "countryCode" TEXT NOT NULL DEFAULT 'AR',
      "countryName" TEXT NOT NULL DEFAULT 'Argentina',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "TenantOnboardingProfile_businessLine_check" CHECK ("businessLine" IN ('BARBERIA', 'PELUQUERIA', 'ESTETICA')),
      CONSTRAINT "TenantOnboardingProfile_workersCount_check" CHECK ("workersCount" >= 1 AND "workersCount" <= 500)
    )
  `);
}

export async function upsertTenantOnboardingProfile(input: {
  tenantId: string;
  businessLine: BusinessLine;
  workersCount: number;
  countryCode: string;
  countryName: string;
}): Promise<TenantOnboardingProfile> {
  await ensureTenantOnboardingProfileTable();

  const businessLine = normalizeBusinessLine(input.businessLine);
  const workersCount = normalizeWorkersCount(input.workersCount);
  const countryCode = normalizeCountryCode(input.countryCode);
  const countryName = normalizeCountryName(input.countryName);

  const result = await db.query<{
    tenantId: string;
    businessLine: BusinessLine;
    workersCount: number;
    countryCode: string;
    countryName: string;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `
      INSERT INTO "TenantOnboardingProfile" (
        "tenantId",
        "businessLine",
        "workersCount",
        "countryCode",
        "countryName",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT ("tenantId") DO UPDATE
      SET
        "businessLine" = EXCLUDED."businessLine",
        "workersCount" = EXCLUDED."workersCount",
        "countryCode" = EXCLUDED."countryCode",
        "countryName" = EXCLUDED."countryName",
        "updatedAt" = NOW()
      RETURNING "tenantId", "businessLine", "workersCount", "countryCode", "countryName", "createdAt", "updatedAt"
    `,
    [input.tenantId, businessLine, workersCount, countryCode, countryName],
  );

  const row = result.rows[0];
  return {
    tenantId: row.tenantId,
    businessLine: row.businessLine,
    workersCount: Number(row.workersCount),
    countryCode: row.countryCode,
    countryName: row.countryName,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export async function getTenantOnboardingProfile(tenantId: string): Promise<TenantOnboardingProfile | null> {
  await ensureTenantOnboardingProfileTable();

  const result = await db.query<{
    tenantId: string;
    businessLine: BusinessLine;
    workersCount: number;
    countryCode: string;
    countryName: string;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `
      SELECT
        "tenantId",
        "businessLine",
        "workersCount",
        "countryCode",
        "countryName",
        "createdAt",
        "updatedAt"
      FROM "TenantOnboardingProfile"
      WHERE "tenantId" = $1
      LIMIT 1
    `,
    [tenantId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    tenantId: row.tenantId,
    businessLine: row.businessLine,
    workersCount: Number(row.workersCount),
    countryCode: row.countryCode,
    countryName: row.countryName,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export async function createCharacteristicServiceForBranchIfNeeded(input: {
  tenantId: string;
  branchId: string;
}) {
  await ensureTenantOnboardingProfileTable();

  const existingService = await db.query<{ id: string }>(
    `
      SELECT id
      FROM "Service"
      WHERE "tenantId" = $1 AND "branchId" = $2
      LIMIT 1
    `,
    [input.tenantId, input.branchId],
  );

  if (existingService.rows[0]) {
    return;
  }

  const profile = await getTenantOnboardingProfile(input.tenantId);
  const template = getCharacteristicServiceTemplate(profile?.businessLine ?? DEFAULT_BUSINESS_LINE);

  let categoryId: string | null = null;
  const existingCategory = await db.query<{ id: string }>(
    `
      SELECT id
      FROM "ServiceCategory"
      WHERE "tenantId" = $1
        AND "branchId" = $2
        AND lower(name) = lower($3)
      LIMIT 1
    `,
    [input.tenantId, input.branchId, template.categoryName],
  );
  if (existingCategory.rows[0]) {
    categoryId = existingCategory.rows[0].id;
  } else {
    const createdCategory = await db.query<{ id: string }>(
      `
        INSERT INTO "ServiceCategory" (id, "tenantId", "branchId", name, "sortOrder", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, 0, NOW(), NOW())
        RETURNING id
      `,
      [input.tenantId, input.branchId, template.categoryName],
    );
    categoryId = createdCategory.rows[0].id;
  }

  await db.query(
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
      VALUES (
        gen_random_uuid()::text,
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        NULL,
        NULL,
        false,
        true,
        NOW(),
        NOW()
      )
    `,
    [input.tenantId, input.branchId, categoryId, template.name, template.durationMins, template.priceCents],
  );
}
