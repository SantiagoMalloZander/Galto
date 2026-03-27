import { db } from './db';
import { assertTenantAccess } from './reservas-data';

export type PointsMode = 'VISIT' | 'SPEND';

export async function ensurePointsTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "CustomerPointsConfig" (
      "tenantId" TEXT PRIMARY KEY REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "mode" TEXT NOT NULL DEFAULT 'VISIT',
      "pointsPerVisit" INTEGER NOT NULL DEFAULT 1,
      "spendAmountCentsPerPoint" INTEGER NOT NULL DEFAULT 1000,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "CustomerPointsConfig_mode_check" CHECK ("mode" IN ('VISIT','SPEND')),
      CONSTRAINT "CustomerPointsConfig_pointsPerVisit_check" CHECK ("pointsPerVisit" >= 1 AND "pointsPerVisit" <= 1000),
      CONSTRAINT "CustomerPointsConfig_spendAmount_check" CHECK ("spendAmountCentsPerPoint" >= 1)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "CustomerPointsReward" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "pointsRequired" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "imageUrl" TEXT,
      "note" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "CustomerPointsReward_pointsRequired_check" CHECK ("pointsRequired" >= 1)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "CustomerPointsReward_tenant_idx"
    ON "CustomerPointsReward"("tenantId", "isActive", "pointsRequired")
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "CustomerPointsRedemption" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "customerUserId" TEXT NOT NULL REFERENCES "CustomerUser"(id) ON DELETE CASCADE,
      "rewardId" TEXT NOT NULL REFERENCES "CustomerPointsReward"(id) ON DELETE RESTRICT,
      "pointsSpent" INTEGER NOT NULL,
      "discountCents" INTEGER NOT NULL DEFAULT 0,
      "posSaleId" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "CustomerPointsRedemption_points_check" CHECK ("pointsSpent" >= 1),
      CONSTRAINT "CustomerPointsRedemption_discount_check" CHECK ("discountCents" >= 0)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "CustomerPointsRedemption_tenant_customer_idx"
    ON "CustomerPointsRedemption"("tenantId", "customerUserId", "createdAt" DESC)
  `);
}

export async function getPointsContext(input: { userId: string; tenantId: string }) {
  await ensurePointsTables();

  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) {
    throw new Error('Sin acceso al tenant');
  }

  await db.query(
    `
      INSERT INTO "CustomerPointsConfig" ("tenantId")
      VALUES ($1)
      ON CONFLICT ("tenantId") DO NOTHING
    `,
    [input.tenantId],
  );

  await syncTenantPoints(input.tenantId);

  const configRes = await db.query<{
    mode: PointsMode;
    pointsPerVisit: number;
    spendAmountCentsPerPoint: number;
    updatedAt: Date;
  }>(
    `
      SELECT "mode", "pointsPerVisit", "spendAmountCentsPerPoint", "updatedAt"
      FROM "CustomerPointsConfig"
      WHERE "tenantId" = $1
      LIMIT 1
    `,
    [input.tenantId],
  );

  const rewardsRes = await db.query<{
    id: string;
    pointsRequired: number;
    title: string;
    imageUrl: string | null;
    note: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>(
    `
      SELECT id, "pointsRequired", title, "imageUrl", note, "isActive", "createdAt", "updatedAt"
      FROM "CustomerPointsReward"
      WHERE "tenantId" = $1
      ORDER BY "isActive" DESC, "pointsRequired" ASC, "createdAt" DESC
    `,
    [input.tenantId],
  );

  const customersRes = await db.query<{
    customerUserId: string;
    fullName: string | null;
    phone: string;
    points: number;
    bookingsCount: number;
    lastBookedAt: Date | null;
    spendCents: number;
  }>(
    `
      WITH appointment_totals AS (
        SELECT
          a.id,
          a."customerId",
          a."startsAt",
          COALESCE(NULLIF(SUM(l."priceCents"), 0), a."totalChargedCents", 0) AS "appointmentSpendCents"
        FROM "Appointment" a
        INNER JOIN "Customer" c ON c.id = a."customerId" AND c."archivedAt" IS NULL
        LEFT JOIN "AppointmentLine" l ON l."appointmentId" = a.id
        WHERE a."tenantId" = $1
          AND a.status = 'COMPLETED'
          AND a."customerId" IS NOT NULL
          AND COALESCE(c."isTest", FALSE) = FALSE
        GROUP BY a.id, a."customerId", a."startsAt", a."totalChargedCents"
      ), spend_by_customer_user AS (
        SELECT
          ci."customerUserId",
          COALESCE(SUM(at."appointmentSpendCents"), 0) AS "spendCents"
        FROM appointment_totals at
        INNER JOIN "CustomerIdentity" ci ON ci."customerId" = at."customerId"
        GROUP BY ci."customerUserId"
      )
      SELECT
        ctp."customerUserId",
        cu."fullName",
        cu.phone,
        ctp.points,
        ctp."bookingsCount",
        ctp."lastBookedAt",
        COALESCE(sbc."spendCents", 0) AS "spendCents"
      FROM "CustomerTenantPoints" ctp
      INNER JOIN "CustomerUser" cu ON cu.id = ctp."customerUserId"
      LEFT JOIN spend_by_customer_user sbc ON sbc."customerUserId" = ctp."customerUserId"
      WHERE ctp."tenantId" = $1
      ORDER BY ctp.points DESC, ctp."bookingsCount" DESC, cu."createdAt" DESC
      LIMIT 500
    `,
    [input.tenantId],
  );

  return {
    membership: {
      id: membership.id,
      role: membership.role,
    },
    config: {
      mode: configRes.rows[0]?.mode ?? 'VISIT',
      pointsPerVisit: Number(configRes.rows[0]?.pointsPerVisit ?? 1),
      spendAmountCentsPerPoint: Number(configRes.rows[0]?.spendAmountCentsPerPoint ?? 1000),
      updatedAt: configRes.rows[0]?.updatedAt?.toISOString() ?? new Date().toISOString(),
    },
    rewards: rewardsRes.rows.map((row) => ({
      id: row.id,
      pointsRequired: Number(row.pointsRequired),
      title: row.title,
      imageUrl: row.imageUrl,
      note: row.note,
      isActive: Boolean(row.isActive),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    customers: customersRes.rows.map((row) => ({
      customerUserId: row.customerUserId,
      fullName: row.fullName,
      phone: row.phone,
      points: Number(row.points),
      bookingsCount: Number(row.bookingsCount),
      lastBookedAt: row.lastBookedAt ? row.lastBookedAt.toISOString() : null,
      spendCents: Number(row.spendCents ?? 0),
    })),
  };
}

export async function updatePointsConfig(input: {
  userId: string;
  tenantId: string;
  mode: PointsMode;
  pointsPerVisit: number;
  spendAmountCentsPerPoint: number;
}) {
  await ensurePointsTables();

  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');

  if (input.mode !== 'VISIT' && input.mode !== 'SPEND') {
    throw new Error('Modo inválido');
  }

  const pointsPerVisit = Math.max(1, Math.min(1000, Math.floor(input.pointsPerVisit)));
  const spendAmountCentsPerPoint = Math.max(1, Math.floor(input.spendAmountCentsPerPoint));

  await db.query(
    `
      INSERT INTO "CustomerPointsConfig" (
        "tenantId", "mode", "pointsPerVisit", "spendAmountCentsPerPoint", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT ("tenantId") DO UPDATE
      SET "mode" = EXCLUDED."mode",
          "pointsPerVisit" = EXCLUDED."pointsPerVisit",
          "spendAmountCentsPerPoint" = EXCLUDED."spendAmountCentsPerPoint",
          "updatedAt" = NOW()
    `,
    [input.tenantId, input.mode, pointsPerVisit, spendAmountCentsPerPoint],
  );

  await syncTenantPoints(input.tenantId);
}

export async function createReward(input: {
  userId: string;
  tenantId: string;
  pointsRequired: number;
  title: string;
  imageUrl?: string | null;
  note?: string | null;
}) {
  await ensurePointsTables();

  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');

  const title = String(input.title ?? '').trim();
  if (title.length < 2) throw new Error('Ingresá una recompensa válida');

  const pointsRequired = Math.max(1, Math.floor(Number(input.pointsRequired || 0)));
  const imageUrl = normalizeText(input.imageUrl);
  const note = normalizeText(input.note);

  const result = await db.query<{ id: string }>(
    `
      INSERT INTO "CustomerPointsReward" (
        id, "tenantId", "pointsRequired", title, "imageUrl", note, "isActive", "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, TRUE, NOW(), NOW())
      RETURNING id
    `,
    [input.tenantId, pointsRequired, title, imageUrl, note],
  );

  return result.rows[0]?.id;
}

export async function updateReward(input: {
  userId: string;
  tenantId: string;
  rewardId: string;
  pointsRequired: number;
  title: string;
  imageUrl?: string | null;
  note?: string | null;
  isActive?: boolean;
}) {
  await ensurePointsTables();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');

  const title = String(input.title ?? '').trim();
  if (title.length < 2) throw new Error('Ingresá una recompensa válida');

  await db.query(
    `
      UPDATE "CustomerPointsReward"
      SET "pointsRequired" = $1,
          title = $2,
          "imageUrl" = $3,
          note = $4,
          "isActive" = $5,
          "updatedAt" = NOW()
      WHERE id = $6 AND "tenantId" = $7
    `,
    [
      Math.max(1, Math.floor(Number(input.pointsRequired || 0))),
      title,
      normalizeText(input.imageUrl),
      normalizeText(input.note),
      input.isActive !== false,
      input.rewardId,
      input.tenantId,
    ],
  );
}

export async function deleteReward(input: { userId: string; tenantId: string; rewardId: string }) {
  await ensurePointsTables();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');

  await db.query(
    `DELETE FROM "CustomerPointsReward" WHERE id = $1 AND "tenantId" = $2`,
    [input.rewardId, input.tenantId],
  );
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function syncTenantPoints(tenantId: string) {
  await db.query(
    `
      INSERT INTO "CustomerPointsConfig" ("tenantId")
      VALUES ($1)
      ON CONFLICT ("tenantId") DO NOTHING
    `,
    [tenantId],
  );

  const configRes = await db.query<{
    mode: PointsMode;
    pointsPerVisit: number;
    spendAmountCentsPerPoint: number;
  }>(
    `
      SELECT "mode", "pointsPerVisit", "spendAmountCentsPerPoint"
      FROM "CustomerPointsConfig"
      WHERE "tenantId" = $1
      LIMIT 1
    `,
    [tenantId],
  );

  const config = configRes.rows[0] ?? {
    mode: 'VISIT' as PointsMode,
    pointsPerVisit: 1,
    spendAmountCentsPerPoint: 1000,
  };

  const aggregates = await db.query<{
    customerUserId: string;
    visits: number;
    spendCents: number;
    lastBookedAt: Date | null;
    pointsSpent: number;
  }>(
    `
      WITH appointment_totals AS (
        SELECT
          a.id,
          a."customerId",
          a."startsAt",
          COALESCE(NULLIF(SUM(l."priceCents"), 0), a."totalChargedCents", 0) AS "appointmentSpendCents"
        FROM "Appointment" a
        INNER JOIN "Customer" c ON c.id = a."customerId" AND c."archivedAt" IS NULL
        LEFT JOIN "AppointmentLine" l ON l."appointmentId" = a.id
        WHERE a."tenantId" = $1
          AND a.status = 'COMPLETED'
          AND a."customerId" IS NOT NULL
          AND COALESCE(c."isTest", FALSE) = FALSE
        GROUP BY a.id, a."customerId", a."startsAt", a."totalChargedCents"
      ), redeemed_by_customer_user AS (
        SELECT
          r."customerUserId",
          COALESCE(SUM(r."pointsSpent"), 0)::int as "pointsSpent"
        FROM "CustomerPointsRedemption" r
        WHERE r."tenantId" = $1
        GROUP BY r."customerUserId"
      )
      SELECT
        ci."customerUserId",
        COUNT(at.id)::int AS visits,
        COALESCE(SUM(at."appointmentSpendCents"), 0)::int AS "spendCents",
        MAX(at."startsAt") as "lastBookedAt",
        MAX(COALESCE(rbc."pointsSpent", 0))::int as "pointsSpent"
      FROM appointment_totals at
      INNER JOIN "CustomerIdentity" ci ON ci."customerId" = at."customerId"
      LEFT JOIN redeemed_by_customer_user rbc ON rbc."customerUserId" = ci."customerUserId"
      GROUP BY ci."customerUserId"
    `,
    [tenantId],
  );

  for (const row of aggregates.rows) {
    const visits = Number(row.visits ?? 0);
    const spendCents = Number(row.spendCents ?? 0);
    const generatedPoints =
      config.mode === 'VISIT'
        ? visits * Number(config.pointsPerVisit ?? 1)
        : Math.floor(spendCents / Math.max(1, Number(config.spendAmountCentsPerPoint ?? 1000)));
    const pointsSpent = Number((row as any).pointsSpent ?? 0);
    const points = Math.max(0, generatedPoints - pointsSpent);

    await db.query(
      `
        INSERT INTO "CustomerTenantPoints" (
          id, "customerUserId", "tenantId", points, "bookingsCount", "lastBookedAt", "createdAt", "updatedAt"
        )
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT ("customerUserId", "tenantId") DO UPDATE
        SET points = EXCLUDED.points,
            "bookingsCount" = EXCLUDED."bookingsCount",
            "lastBookedAt" = EXCLUDED."lastBookedAt",
            "updatedAt" = NOW()
      `,
      [row.customerUserId, tenantId, points, visits, row.lastBookedAt],
    );
  }
}
