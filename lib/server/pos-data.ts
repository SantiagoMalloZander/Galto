import { PoolClient } from 'pg';
import { db } from './db';
import { assertTenantAccess, hasBranchPermission } from './reservas-data';
import { ensurePointsTables } from './points-data';
import { ensureCustomerAccountTables } from './customer-accounts';

export type PosPaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'MIXED';

type PosPermissionSet = {
  canRead: boolean;
  canWrite: boolean;
  membership: { id: string; role: string } | null;
};

function isE164Phone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asInt(value: unknown, fallback = 0) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.floor(next);
}

function asCurrencyCents(value: unknown, fallback = 0) {
  return Math.max(0, asInt(value, fallback));
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export async function ensurePosTables() {
  await ensureCustomerAccountTables();
  await ensurePointsTables();

  await db.query(`
    CREATE TABLE IF NOT EXISTS "BranchProduct" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "branchId" TEXT NOT NULL REFERENCES "Branch"(id) ON DELETE CASCADE,
      "name" TEXT NOT NULL,
      "priceCents" INTEGER NOT NULL,
      "stockQuantity" INTEGER NOT NULL DEFAULT 0,
      "trackMinStock" BOOLEAN NOT NULL DEFAULT FALSE,
      "minStockQuantity" INTEGER NOT NULL DEFAULT 0,
      "photoUrl" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "BranchProduct_price_check" CHECK ("priceCents" >= 0),
      CONSTRAINT "BranchProduct_stock_check" CHECK ("stockQuantity" >= 0),
      CONSTRAINT "BranchProduct_min_stock_check" CHECK ("minStockQuantity" >= 0)
    )
  `);

  await db.query(`ALTER TABLE "BranchProduct" ADD COLUMN IF NOT EXISTS "stockQuantity" INTEGER NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE "BranchProduct" ADD COLUMN IF NOT EXISTS "trackMinStock" BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.query(`ALTER TABLE "BranchProduct" ADD COLUMN IF NOT EXISTS "minStockQuantity" INTEGER NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE "BranchProduct" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT`);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "BranchProduct_branch_idx"
    ON "BranchProduct"("tenantId", "branchId", "isActive", "createdAt" DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "BranchInventorySettings" (
      "branchId" TEXT PRIMARY KEY REFERENCES "Branch"(id) ON DELETE CASCADE,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "useInventory" BOOLEAN NOT NULL DEFAULT FALSE,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "BranchInventorySettings_tenant_branch_idx"
    ON "BranchInventorySettings"("tenantId", "branchId")
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "BranchCashSession" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "branchId" TEXT NOT NULL REFERENCES "Branch"(id) ON DELETE CASCADE,
      "openedByUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
      "closedByUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
      "openingAmountCents" INTEGER NOT NULL DEFAULT 0,
      "closingAmountCents" INTEGER,
      "note" TEXT,
      "openedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "closedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "BranchCashSession_open_idx"
    ON "BranchCashSession"("tenantId", "branchId", "openedAt" DESC)
  `);

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "BranchCashSession_open_unique_idx"
    ON "BranchCashSession"("branchId")
    WHERE "closedAt" IS NULL
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "PosSale" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "branchId" TEXT NOT NULL REFERENCES "Branch"(id) ON DELETE CASCADE,
      "cashSessionId" TEXT REFERENCES "BranchCashSession"(id) ON DELETE SET NULL,
      "customerId" TEXT REFERENCES "Customer"(id) ON DELETE SET NULL,
      "customerUserId" TEXT REFERENCES "CustomerUser"(id) ON DELETE SET NULL,
      "appointmentId" TEXT REFERENCES "Appointment"(id) ON DELETE SET NULL,
      "sourceType" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "customerNameSnapshot" TEXT,
      "customerPhoneSnapshot" TEXT,
      "notes" TEXT,
      "paymentMethod" TEXT NOT NULL,
      "subtotalCents" INTEGER NOT NULL DEFAULT 0,
      "discountCents" INTEGER NOT NULL DEFAULT 0,
      "rewardDiscountCents" INTEGER NOT NULL DEFAULT 0,
      "totalCents" INTEGER NOT NULL DEFAULT 0,
      "paidCents" INTEGER NOT NULL DEFAULT 0,
      "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
      "rewardId" TEXT REFERENCES "CustomerPointsReward"(id) ON DELETE SET NULL,
      "createdByUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "PosSale_sourceType_check" CHECK ("sourceType" IN ('WALKIN','APPOINTMENT')),
      CONSTRAINT "PosSale_status_check" CHECK ("status" IN ('PAID','VOID')),
      CONSTRAINT "PosSale_paymentMethod_check" CHECK ("paymentMethod" IN ('CASH','TRANSFER','CARD','MIXED')),
      CONSTRAINT "PosSale_money_check" CHECK (
        "subtotalCents" >= 0
        AND "discountCents" >= 0
        AND "rewardDiscountCents" >= 0
        AND "totalCents" >= 0
        AND "paidCents" >= 0
      )
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "PosSale_branch_idx"
    ON "PosSale"("tenantId", "branchId", "createdAt" DESC)
  `);

  await db.query(`
    ALTER TABLE "Appointment"
    ADD COLUMN IF NOT EXISTS "posSaleId" TEXT REFERENCES "PosSale"(id) ON DELETE SET NULL
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "Appointment_posSale_idx"
    ON "Appointment"("posSaleId")
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "PosSaleLine" (
      "id" TEXT PRIMARY KEY,
      "saleId" TEXT NOT NULL REFERENCES "PosSale"(id) ON DELETE CASCADE,
      "lineType" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
      "totalPriceCents" INTEGER NOT NULL DEFAULT 0,
      "serviceId" TEXT REFERENCES "Service"(id) ON DELETE SET NULL,
      "employeeId" TEXT REFERENCES "Employee"(id) ON DELETE SET NULL,
      "productId" TEXT REFERENCES "BranchProduct"(id) ON DELETE SET NULL,
      "appointmentLineId" TEXT REFERENCES "AppointmentLine"(id) ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "PosSaleLine_lineType_check" CHECK ("lineType" IN ('SERVICE','PRODUCT')),
      CONSTRAINT "PosSaleLine_values_check" CHECK (
        "quantity" >= 1
        AND "unitPriceCents" >= 0
        AND "totalPriceCents" >= 0
      )
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "PosSaleLine_sale_idx"
    ON "PosSaleLine"("saleId", "createdAt")
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "CustomerPointsRedemption" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "customerUserId" TEXT NOT NULL REFERENCES "CustomerUser"(id) ON DELETE CASCADE,
      "rewardId" TEXT NOT NULL REFERENCES "CustomerPointsReward"(id) ON DELETE RESTRICT,
      "pointsSpent" INTEGER NOT NULL,
      "discountCents" INTEGER NOT NULL DEFAULT 0,
      "posSaleId" TEXT REFERENCES "PosSale"(id) ON DELETE SET NULL,
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

export async function getPosPermissions(input: {
  userId: string;
  tenantId: string;
  branchId: string;
}): Promise<PosPermissionSet> {
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) {
    return { canRead: false, canWrite: false, membership: null };
  }

  if (membership.role === 'OWNER') {
    return { canRead: true, canWrite: true, membership };
  }

  const [canReadPos, canWritePos, canReadWalkins, canWriteWalkins, canReadAppointments, canWriteAppointments] =
    await Promise.all([
      hasBranchPermission({ ...input, permission: 'POS_READ' }),
      hasBranchPermission({ ...input, permission: 'POS_WRITE' }),
      hasBranchPermission({ ...input, permission: 'WALKINS_READ' }),
      hasBranchPermission({ ...input, permission: 'WALKINS_WRITE' }),
      hasBranchPermission({ ...input, permission: 'APPOINTMENTS_READ' }),
      hasBranchPermission({ ...input, permission: 'APPOINTMENTS_WRITE' }),
    ]);

  return {
    canRead: canReadPos || canWritePos || canReadWalkins || canWriteWalkins || canReadAppointments || canWriteAppointments,
    canWrite: canWritePos || canWriteWalkins || canWriteAppointments,
    membership,
  };
}

export async function getInventoryPermissions(input: {
  userId: string;
  tenantId: string;
  branchId: string;
}): Promise<PosPermissionSet> {
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) {
    return { canRead: false, canWrite: false, membership: null };
  }

  if (membership.role === 'OWNER') {
    return { canRead: true, canWrite: true, membership };
  }

  const [canReadInventory, canWriteInventory] = await Promise.all([
    hasBranchPermission({ ...input, permission: 'INVENTORY_READ' }),
    hasBranchPermission({ ...input, permission: 'INVENTORY_WRITE' }),
  ]);

  return {
    canRead: canReadInventory || canWriteInventory,
    canWrite: canWriteInventory,
    membership,
  };
}

function parseJsonArray(raw: unknown): string[] {
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

export async function getPosContext(input: { tenantId: string; branchId: string; userId: string }) {
  await ensurePosTables();

  const [branchRes, servicesRes, employeesRes, assignmentsRes, productsRes, reservationsRes, recentSalesRes, cashRes, inventorySettingsRes] =
    await Promise.all([
      db.query<{
        id: string;
        name: string;
        slug: string;
        timeZone: string;
      }>(
        `
          SELECT id, name, slug, "timeZone"
          FROM "Branch"
          WHERE id = $1 AND "tenantId" = $2
          LIMIT 1
        `,
        [input.branchId, input.tenantId],
      ),
      db.query<{
        id: string;
        name: string;
        durationMins: number;
        priceCents: number;
        isActive: boolean;
      }>(
        `
          SELECT id, name, "durationMins", "priceCents", "isActive"
          FROM "Service"
          WHERE "tenantId" = $1 AND "branchId" = $2
          ORDER BY name ASC
        `,
        [input.tenantId, input.branchId],
      ),
      db.query<{
        id: string;
        fullName: string;
        isActive: boolean;
      }>(
        `
          SELECT id, "fullName", "isActive"
          FROM "Employee"
          WHERE "tenantId" = $1 AND "branchId" = $2
          ORDER BY "fullName" ASC
        `,
        [input.tenantId, input.branchId],
      ),
      db.query<{ employeeId: string; serviceId: string }>(
        `
          SELECT "employeeId", "serviceId"
          FROM "ServiceAssignment"
          WHERE "employeeId" IN (
            SELECT id FROM "Employee" WHERE "tenantId" = $1 AND "branchId" = $2
          )
        `,
        [input.tenantId, input.branchId],
      ),
      db.query<{
        id: string;
        name: string;
        priceCents: number;
        stockQuantity: number;
        trackMinStock: boolean;
        minStockQuantity: number;
        photoUrl: string | null;
        isActive: boolean;
        soldQuantity: number;
        createdAt: Date;
      }>(
        `
          SELECT
            p.id,
            p.name,
            p."priceCents",
            p."stockQuantity",
            p."trackMinStock",
            p."minStockQuantity",
            p."photoUrl",
            p."isActive",
            COALESCE((
              SELECT SUM(psl.quantity)::int
              FROM "PosSaleLine" psl
              INNER JOIN "PosSale" ps ON ps.id = psl."saleId"
              WHERE psl."productId" = p.id
                AND psl."lineType" = 'PRODUCT'
                AND ps."tenantId" = $1
                AND ps."branchId" = $2
                AND ps.status = 'PAID'
            ), 0) AS "soldQuantity",
            p."createdAt"
          FROM "BranchProduct"
          p
          WHERE p."tenantId" = $1 AND p."branchId" = $2
          ORDER BY p."isActive" DESC, p."createdAt" DESC
        `,
        [input.tenantId, input.branchId],
      ),
      db.query<{
        appointmentId: string;
        status: string;
        startsAt: Date;
        endsAt: Date;
        totalChargedCents: number;
        customerId: string | null;
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
            a."startsAt",
            a."endsAt",
            a."totalChargedCents",
            a."customerId",
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
            AND a.status IN ('PENDING', 'CONFIRMED')
            AND a."startsAt" >= NOW() - INTERVAL '3 hours'
          ORDER BY a."startsAt" DESC, a."createdAt" DESC
          LIMIT 250
        `,
        [input.tenantId, input.branchId],
      ),
      db.query<{
        id: string;
        sourceType: string;
        appointmentId: string | null;
        paymentMethod: string;
        totalCents: number;
        paidCents: number;
        customerNameSnapshot: string | null;
        createdAt: Date;
      }>(
        `
          SELECT
            id,
            "sourceType",
            "appointmentId",
            "paymentMethod",
            "totalCents",
            "paidCents",
            "customerNameSnapshot",
            "createdAt"
          FROM "PosSale"
          WHERE "tenantId" = $1 AND "branchId" = $2
          ORDER BY "createdAt" DESC
          LIMIT 20
        `,
        [input.tenantId, input.branchId],
      ),
      db.query<{
        id: string;
        openedAt: Date;
        openingAmountCents: number;
        note: string | null;
      }>(
        `
          SELECT id, "openedAt", "openingAmountCents", note
          FROM "BranchCashSession"
          WHERE "tenantId" = $1 AND "branchId" = $2 AND "closedAt" IS NULL
          ORDER BY "openedAt" DESC
          LIMIT 1
        `,
        [input.tenantId, input.branchId],
      ),
      db.query<{ useInventory: boolean }>(
        `
          SELECT "useInventory"
          FROM "BranchInventorySettings"
          WHERE "tenantId" = $1 AND "branchId" = $2
          LIMIT 1
        `,
        [input.tenantId, input.branchId],
      ),
    ]);

  const branch = branchRes.rows[0] ?? null;
  if (!branch) {
    throw new Error('Sucursal no encontrada');
  }

  const services = servicesRes.rows.map((row) => ({
    id: row.id,
    name: row.name,
    durationMins: Number(row.durationMins),
    priceCents: Number(row.priceCents),
    isActive: Boolean(row.isActive),
  }));

  const employees = employeesRes.rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    isActive: Boolean(row.isActive),
    serviceIds: assignmentsRes.rows
      .filter((item) => item.employeeId === row.id)
      .map((item) => item.serviceId),
  }));

  const reservationsMap = new Map<
    string,
    {
      appointmentId: string;
      status: string;
      startsAt: string;
      endsAt: string;
      totalChargedCents: number;
      customer: { id: string | null; fullName: string | null; phone: string | null };
      employee: { id: string; fullName: string };
      lines: Array<{
        lineId: string;
        serviceId: string | null;
        serviceName: string | null;
        durationMins: number;
        priceCents: number;
      }>;
    }
  >();

  for (const row of reservationsRes.rows) {
    if (!reservationsMap.has(row.appointmentId)) {
      reservationsMap.set(row.appointmentId, {
        appointmentId: row.appointmentId,
        status: row.status,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        totalChargedCents: Number(row.totalChargedCents ?? 0),
        customer: {
          id: row.customerId,
          fullName: row.customerName,
          phone: row.customerPhone,
        },
        employee: {
          id: row.employeeId,
          fullName: row.employeeName,
        },
        lines: [],
      });
    }

    if (row.lineId) {
      reservationsMap.get(row.appointmentId)!.lines.push({
        lineId: row.lineId,
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        durationMins: Number(row.lineDurationMins ?? 0),
        priceCents: Number(row.linePriceCents ?? 0),
      });
    }
  }

  return {
    branch,
    inventory: {
      useInventory: Boolean(inventorySettingsRes.rows[0]?.useInventory ?? false),
    },
    services,
    employees,
    products: productsRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      priceCents: Number(row.priceCents),
      stockQuantity: Number(row.stockQuantity ?? 0),
      trackMinStock: Boolean(row.trackMinStock),
      minStockQuantity: Number(row.minStockQuantity ?? 0),
      photoUrl: row.photoUrl,
      isActive: Boolean(row.isActive),
      soldQuantity: Number(row.soldQuantity ?? 0),
      createdAt: row.createdAt.toISOString(),
    })),
    reservations: [...reservationsMap.values()],
    recentSales: recentSalesRes.rows.map((row) => ({
      id: row.id,
      sourceType: row.sourceType,
      appointmentId: row.appointmentId,
      paymentMethod: row.paymentMethod,
      totalCents: Number(row.totalCents ?? 0),
      paidCents: Number(row.paidCents ?? 0),
      customerNameSnapshot: row.customerNameSnapshot,
      createdAt: row.createdAt.toISOString(),
    })),
    cashSession: cashRes.rows[0]
      ? {
          id: cashRes.rows[0].id,
          openedAt: cashRes.rows[0].openedAt.toISOString(),
          openingAmountCents: Number(cashRes.rows[0].openingAmountCents ?? 0),
          note: cashRes.rows[0].note,
        }
      : null,
  };
}

export async function getInventoryContext(input: { tenantId: string; branchId: string }) {
  await ensurePosTables();

  const [branchRes, settingsRes, productsRes] = await Promise.all([
    db.query<{ id: string; name: string; slug: string }>(
      `
        SELECT id, name, slug
        FROM "Branch"
        WHERE id = $1 AND "tenantId" = $2
        LIMIT 1
      `,
      [input.branchId, input.tenantId],
    ),
    db.query<{ useInventory: boolean }>(
      `
        SELECT "useInventory"
        FROM "BranchInventorySettings"
        WHERE "tenantId" = $1 AND "branchId" = $2
        LIMIT 1
      `,
      [input.tenantId, input.branchId],
    ),
    db.query<{
      id: string;
      name: string;
      priceCents: number;
      stockQuantity: number;
      trackMinStock: boolean;
      minStockQuantity: number;
      photoUrl: string | null;
      isActive: boolean;
      soldQuantity: number;
      createdAt: Date;
      updatedAt: Date;
    }>(
      `
        SELECT
          p.id,
          p.name,
          p."priceCents",
          p."stockQuantity",
          p."trackMinStock",
          p."minStockQuantity",
          p."photoUrl",
          p."isActive",
          COALESCE((
            SELECT SUM(psl.quantity)::int
            FROM "PosSaleLine" psl
            INNER JOIN "PosSale" ps ON ps.id = psl."saleId"
            WHERE psl."productId" = p.id
              AND psl."lineType" = 'PRODUCT'
              AND ps."tenantId" = $1
              AND ps."branchId" = $2
              AND ps.status = 'PAID'
          ), 0) AS "soldQuantity",
          p."createdAt",
          p."updatedAt"
        FROM "BranchProduct" p
        WHERE p."tenantId" = $1 AND p."branchId" = $2
        ORDER BY p."isActive" DESC, p."updatedAt" DESC, p."createdAt" DESC
      `,
      [input.tenantId, input.branchId],
    ),
  ]);

  const branch = branchRes.rows[0];
  if (!branch) {
    throw new Error('Sucursal no encontrada');
  }

  return {
    branch,
    settings: {
      useInventory: Boolean(settingsRes.rows[0]?.useInventory ?? false),
    },
    products: productsRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      priceCents: Number(row.priceCents ?? 0),
      stockQuantity: Number(row.stockQuantity ?? 0),
      trackMinStock: Boolean(row.trackMinStock),
      minStockQuantity: Number(row.minStockQuantity ?? 0),
      photoUrl: row.photoUrl,
      isActive: Boolean(row.isActive),
      soldQuantity: Number(row.soldQuantity ?? 0),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function lookupCustomerForPos(input: {
  tenantId: string;
  branchId: string;
  phone: string;
}) {
  await ensurePosTables();

  const phone = input.phone.trim();
  if (!isE164Phone(phone)) {
    throw new Error('El teléfono debe estar en formato E.164');
  }

  const customerRes = await db.query<{
    customerId: string;
    fullName: string;
    phone: string;
    customerUserId: string | null;
    points: number;
  }>(
    `
      SELECT
        c.id as "customerId",
        c."fullName",
        c.phone,
        ci."customerUserId",
        COALESCE(ctp.points, 0) as points
      FROM "Customer" c
      LEFT JOIN "CustomerIdentity" ci ON ci."customerId" = c.id
      LEFT JOIN "CustomerTenantPoints" ctp ON ctp."customerUserId" = ci."customerUserId" AND ctp."tenantId" = c."tenantId"
      WHERE c."tenantId" = $1
        AND c.phone = $2
        AND c."archivedAt" IS NULL
      ORDER BY c."updatedAt" DESC
      LIMIT 1
    `,
    [input.tenantId, phone],
  );

  const customer = customerRes.rows[0] ?? null;
  if (!customer) {
    return {
      customer: null,
      rewards: [],
    };
  }

  const rewardsRes = await db.query<{
    id: string;
    title: string;
    pointsRequired: number;
    note: string | null;
    isActive: boolean;
  }>(
    `
      SELECT id, title, "pointsRequired", note, "isActive"
      FROM "CustomerPointsReward"
      WHERE "tenantId" = $1
        AND "isActive" = TRUE
      ORDER BY "pointsRequired" ASC, "createdAt" DESC
      LIMIT 100
    `,
    [input.tenantId],
  );

  const points = Number(customer.points ?? 0);
  return {
    customer: {
      customerId: customer.customerId,
      customerUserId: customer.customerUserId,
      fullName: customer.fullName,
      phone: customer.phone,
      points,
    },
    rewards: rewardsRes.rows.map((row) => ({
      id: row.id,
      title: row.title,
      pointsRequired: Number(row.pointsRequired),
      note: row.note,
      isEligible: points >= Number(row.pointsRequired),
    })),
  };
}

export async function listCustomersForPos(input: {
  tenantId: string;
  branchId: string;
  limit?: number;
}) {
  await ensurePosTables();

  const limit = Math.max(1, Math.min(100, Number(input.limit ?? 30)));

  const rows = await db.query<{
    customerId: string;
    customerUserId: string | null;
    fullName: string;
    phone: string;
    isTest: boolean;
    archivedAt: Date | null;
    updatedAt: Date;
  }>(
    `
      SELECT
        c.id AS "customerId",
        ci."customerUserId" AS "customerUserId",
        c."fullName",
        c.phone,
        COALESCE(c."isTest", FALSE) AS "isTest",
        c."archivedAt",
        c."updatedAt"
      FROM "Customer" c
      LEFT JOIN "CustomerIdentity" ci ON ci."customerId" = c.id
      WHERE c."tenantId" = $1
        AND c."archivedAt" IS NULL
      ORDER BY c."updatedAt" DESC
      LIMIT $2
    `,
    [input.tenantId, limit],
  );

  return rows.rows.map((row) => ({
    customerId: row.customerId,
    customerUserId: row.customerUserId,
    fullName: row.fullName,
    phone: row.phone,
    isTest: Boolean(row.isTest),
    isArchived: Boolean(row.archivedAt),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function archiveCustomerForPos(input: {
  tenantId: string;
  branchId: string;
  customerId: string;
}) {
  await ensurePosTables();

  const customerRes = await db.query<{
    customerId: string;
    customerUserId: string | null;
    isTest: boolean;
    archivedAt: Date | null;
  }>(
    `
      SELECT
        c.id AS "customerId",
        ci."customerUserId" AS "customerUserId",
        COALESCE(c."isTest", FALSE) AS "isTest",
        c."archivedAt"
      FROM "Customer" c
      LEFT JOIN "CustomerIdentity" ci ON ci."customerId" = c.id
      WHERE c.id = $1
        AND c."tenantId" = $2
      LIMIT 1
    `,
    [input.customerId, input.tenantId],
  );

  const customer = customerRes.rows[0];
  if (!customer) {
    throw new Error('Cliente no encontrado');
  }
  if (customer.archivedAt) {
    return { ok: true };
  }
  if (!customer.isTest) {
    throw new Error('Los clientes reales se gestionan desde la pantalla Clientes');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `
        UPDATE "Appointment"
        SET "customerId" = NULL,
            "customerUserId" = NULL,
            "updatedAt" = NOW()
        WHERE "tenantId" = $1
          AND "customerId" = $2
      `,
      [input.tenantId, customer.customerId],
    );

    await client.query(
      `
        UPDATE "PosSale"
        SET "customerId" = NULL,
            "updatedAt" = NOW(),
            "customerNameSnapshot" = COALESCE("customerNameSnapshot", 'Cliente de prueba')
        WHERE "tenantId" = $1
          AND "customerId" = $2
      `,
      [input.tenantId, customer.customerId],
    );

    await client.query(
      `
        DELETE FROM "Customer"
        WHERE id = $1
          AND "tenantId" = $2
      `,
      [customer.customerId, input.tenantId],
    );

    await client.query('COMMIT');
    return { ok: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePosSaleById(input: {
  tenantId: string;
  branchId: string;
  saleId: string;
}) {
  await ensurePosTables();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const saleRes = await client.query<{
      id: string;
      tenantId: string;
      branchId: string;
      appointmentId: string | null;
      customerUserId: string | null;
    }>(
      `
        SELECT id, "tenantId", "branchId", "appointmentId", "customerUserId"
        FROM "PosSale"
        WHERE id = $1
          AND "tenantId" = $2
          AND "branchId" = $3
        FOR UPDATE
      `,
      [input.saleId, input.tenantId, input.branchId],
    );

    const sale = saleRes.rows[0];
    if (!sale) {
      throw new Error('Orden de compra no encontrada');
    }

    const productLinesRes = await client.query<{ productId: string | null; quantity: number }>(
      `
        SELECT "productId", quantity
        FROM "PosSaleLine"
        WHERE "saleId" = $1
          AND "lineType" = 'PRODUCT'
      `,
      [sale.id],
    );

    const redemptionRes = await client.query<{ pointsSpent: number }>(
      `
        SELECT "pointsSpent"
        FROM "CustomerPointsRedemption"
        WHERE "posSaleId" = $1
      `,
      [sale.id],
    );

    const walkinAppointmentsRes = await client.query<{ id: string }>(
      `
        SELECT id
        FROM "Appointment"
        WHERE "tenantId" = $1
          AND "branchId" = $2
          AND "posSaleId" = $3
      `,
      [input.tenantId, input.branchId, sale.id],
    );

    const appointmentIds = Array.from(
      new Set([
        ...(sale.appointmentId ? [sale.appointmentId] : []),
        ...walkinAppointmentsRes.rows.map((row) => row.id),
      ]),
    );

    for (const line of productLinesRes.rows) {
      if (!line.productId) continue;
      await client.query(
        `
          UPDATE "BranchProduct"
          SET "stockQuantity" = GREATEST(0, "stockQuantity" + $1),
              "updatedAt" = NOW()
          WHERE id = $2
            AND "tenantId" = $3
            AND "branchId" = $4
        `,
        [Number(line.quantity ?? 0), line.productId, input.tenantId, input.branchId],
      );
    }

    const pointsToRestore = redemptionRes.rows.reduce((sum, row) => sum + Number(row.pointsSpent ?? 0), 0);
    if (pointsToRestore > 0 && sale.customerUserId) {
      await client.query(
        `
          UPDATE "CustomerTenantPoints"
          SET points = points + $1,
              "updatedAt" = NOW()
          WHERE "customerUserId" = $2
            AND "tenantId" = $3
        `,
        [pointsToRestore, sale.customerUserId, input.tenantId],
      );
    }

    await client.query(`DELETE FROM "CustomerPointsRedemption" WHERE "posSaleId" = $1`, [sale.id]);

    if (appointmentIds.length > 0) {
      await client.query(`DELETE FROM "Appointment" WHERE id = ANY($1::text[])`, [appointmentIds]);
    }

    await client.query(`DELETE FROM "PosSale" WHERE id = $1`, [sale.id]);

    await client.query('COMMIT');
    return { ok: true, saleId: sale.id, appointmentIds };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function openCashSession(input: {
  tenantId: string;
  branchId: string;
  userId: string;
  openingAmountCents: number;
  note?: string | null;
}) {
  await ensurePosTables();

  const existing = await db.query<{ id: string }>(
    `
      SELECT id
      FROM "BranchCashSession"
      WHERE "tenantId" = $1 AND "branchId" = $2 AND "closedAt" IS NULL
      LIMIT 1
    `,
    [input.tenantId, input.branchId],
  );

  if (existing.rows[0]) {
    throw new Error('Ya hay una caja abierta en esta sucursal');
  }

  const result = await db.query<{ id: string; openedAt: Date }>(
    `
      INSERT INTO "BranchCashSession" (
        id, "tenantId", "branchId", "openedByUserId", "openingAmountCents", note, "openedAt", "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW(), NOW())
      RETURNING id, "openedAt"
    `,
    [
      input.tenantId,
      input.branchId,
      input.userId,
      asCurrencyCents(input.openingAmountCents),
      normalizeText(input.note),
    ],
  );

  return {
    id: result.rows[0].id,
    openedAt: result.rows[0].openedAt.toISOString(),
  };
}

export async function closeCashSession(input: {
  tenantId: string;
  branchId: string;
  userId: string;
  closingAmountCents: number;
  note?: string | null;
}) {
  await ensurePosTables();

  const result = await db.query<{ id: string; closedAt: Date }>(
    `
      UPDATE "BranchCashSession"
      SET "closedAt" = NOW(),
          "closedByUserId" = $1,
          "closingAmountCents" = $2,
          note = COALESCE($3, note),
          "updatedAt" = NOW()
      WHERE "tenantId" = $4
        AND "branchId" = $5
        AND "closedAt" IS NULL
      RETURNING id, "closedAt"
    `,
    [input.userId, asCurrencyCents(input.closingAmountCents), normalizeText(input.note), input.tenantId, input.branchId],
  );

  if (!result.rows[0]) {
    throw new Error('No hay una caja abierta para cerrar');
  }

  return {
    id: result.rows[0].id,
    closedAt: result.rows[0].closedAt.toISOString(),
  };
}

export async function upsertBranchProduct(input: {
  tenantId: string;
  branchId: string;
  productId?: string;
  name: string;
  priceCents: number;
  stockQuantity?: number;
  trackMinStock?: boolean;
  minStockQuantity?: number;
  photoUrl?: string | null;
  isActive?: boolean;
}) {
  await ensurePosTables();

  const name = String(input.name ?? '').trim();
  if (name.length < 2) {
    throw new Error('Ingresá un producto válido');
  }

  const priceCents = asCurrencyCents(input.priceCents);
  const stockQuantity = Math.max(0, asInt(input.stockQuantity, 0));
  const trackMinStock = Boolean(input.trackMinStock);
  const minStockQuantity = trackMinStock ? Math.max(0, asInt(input.minStockQuantity, 0)) : 0;
  const photoUrl = normalizeText(input.photoUrl);

  if (input.productId) {
    const updated = await db.query<{ id: string }>(
      `
        UPDATE "BranchProduct"
        SET name = $1,
            "priceCents" = $2,
            "stockQuantity" = $3,
            "trackMinStock" = $4,
            "minStockQuantity" = $5,
            "photoUrl" = $6,
            "isActive" = $7,
            "updatedAt" = NOW()
        WHERE id = $8
          AND "tenantId" = $9
          AND "branchId" = $10
        RETURNING id
      `,
      [
        name,
        priceCents,
        stockQuantity,
        trackMinStock,
        minStockQuantity,
        photoUrl,
        input.isActive !== false,
        input.productId,
        input.tenantId,
        input.branchId,
      ],
    );

    if (!updated.rows[0]) {
      throw new Error('Producto no encontrado');
    }

    return { id: updated.rows[0].id, mode: 'updated' as const };
  }

  const created = await db.query<{ id: string }>(
    `
      INSERT INTO "BranchProduct" (
        id, "tenantId", "branchId", name, "priceCents", "stockQuantity", "trackMinStock", "minStockQuantity", "photoUrl", "isActive", "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW(), NOW())
      RETURNING id
    `,
    [input.tenantId, input.branchId, name, priceCents, stockQuantity, trackMinStock, minStockQuantity, photoUrl],
  );

  return { id: created.rows[0].id, mode: 'created' as const };
}

export async function upsertInventorySettings(input: {
  tenantId: string;
  branchId: string;
  useInventory: boolean;
}) {
  await ensurePosTables();

  await db.query(
    `
      INSERT INTO "BranchInventorySettings" ("branchId", "tenantId", "useInventory", "updatedAt")
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT ("branchId") DO UPDATE
      SET "tenantId" = EXCLUDED."tenantId",
          "useInventory" = EXCLUDED."useInventory",
          "updatedAt" = NOW()
    `,
    [input.branchId, input.tenantId, Boolean(input.useInventory)],
  );

  return { ok: true };
}

type CheckoutInput = {
  tenantId: string;
  branchId: string;
  userId: string;
  sourceType: 'WALKIN' | 'APPOINTMENT';
  appointmentId?: string;
  walkInVisitDate?: string;
  walkInVisitTime?: string;
  customer: {
    fullName?: string;
    phone?: string;
    allowAnonymous?: boolean;
    isTest?: boolean;
  };
  serviceItems: Array<{ serviceId: string; employeeId: string }>;
  productItems: Array<{ productId: string; quantity: number }>;
  discountCents?: number;
  rewardId?: string;
  rewardDiscountCents?: number;
  paymentMethod: PosPaymentMethod;
  paidCents?: number;
  notes?: string;
};

function parseDateOnly(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function parseTimeOnly(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) return null;
  const [hour, minute] = trimmed.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function localParts(iso: string, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(iso));
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return {
    dayKey: `${map.year}-${map.month}-${map.day}`,
    minutes: Number(map.hour ?? '0') * 60 + Number(map.minute ?? '0'),
  };
}

function dateKeyToMinuteIndex(dateKey: string, minutes: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0) / 60000 + minutes;
}

function localDateTimeToUtc(dateKey: string, minutes: number, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  let guess = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0);

  for (let index = 0; index < 4; index += 1) {
    const parts = localParts(new Date(guess).toISOString(), timeZone);
    const deltaMinutes = dateKeyToMinuteIndex(dateKey, minutes) - dateKeyToMinuteIndex(parts.dayKey, parts.minutes);
    if (deltaMinutes === 0) break;
    guess += deltaMinutes * 60_000;
  }

  return new Date(guess);
}

async function upsertCustomerForSale(
  client: PoolClient,
  input: {
    tenantId: string;
    fullName?: string;
    phone?: string;
    allowAnonymous?: boolean;
    isTest?: boolean;
  },
) {
  const fullName = normalizeText(input.fullName);
  const phone = normalizeText(input.phone);
  const isTest = Boolean(input.isTest);

  if (isTest) {
    const nextFullName = fullName ?? 'Cliente de prueba';
    const syntheticPhone = `+999${Date.now().toString().slice(-9)}${Math.floor(Math.random() * 90 + 10)}`;
    const customerRes = await client.query<{ id: string }>(
      `
        INSERT INTO "Customer" (id, "tenantId", "fullName", phone, "isTest", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, TRUE, NOW(), NOW())
        RETURNING id
      `,
      [input.tenantId, nextFullName, syntheticPhone],
    );

    return {
      customerId: customerRes.rows[0].id,
      customerUserId: null as string | null,
      customerName: nextFullName,
      customerPhone: null as string | null,
      isTest: true,
    };
  }

  if (!phone) {
    if (input.allowAnonymous) {
      return {
        customerId: null as string | null,
        customerUserId: null as string | null,
        customerName: fullName,
        customerPhone: null as string | null,
        isTest: false,
      };
    }
    throw new Error('Pedile al cliente nombre y teléfono o marcá “cliente sin datos”');
  }

  if (!isE164Phone(phone)) {
    throw new Error('El teléfono debe estar en formato E.164');
  }

  const nextFullName = fullName ?? 'Cliente sin nombre';

  const customerRes = await client.query<{ id: string }>(
    `
      INSERT INTO "Customer" (id, "tenantId", "fullName", phone, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
      ON CONFLICT ("tenantId", phone) DO UPDATE
      SET "fullName" = EXCLUDED."fullName",
          "updatedAt" = NOW(),
          "archivedAt" = NULL
      RETURNING id
    `,
    [input.tenantId, nextFullName, phone],
  );

  const customerId = customerRes.rows[0].id;

  const customerUserRes = await client.query<{ id: string }>(
    `
      INSERT INTO "CustomerUser" (id, phone, "fullName", email, "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, NULL, NOW(), NOW())
      ON CONFLICT (phone) DO UPDATE
      SET "fullName" = COALESCE(EXCLUDED."fullName", "CustomerUser"."fullName"),
          "updatedAt" = NOW(),
          "archivedAt" = NULL
      RETURNING id
    `,
    [phone, nextFullName],
  );

  const customerUserId = customerUserRes.rows[0].id;

  await client.query(
    `
      INSERT INTO "CustomerIdentity" (id, "customerUserId", "customerId")
      VALUES (gen_random_uuid()::text, $1, $2)
      ON CONFLICT ("customerUserId", "customerId") DO NOTHING
    `,
    [customerUserId, customerId],
  );

  await client.query(
    `
      INSERT INTO "CustomerTenantPoints" (
        id, "customerUserId", "tenantId", points, "bookingsCount", "lastBookedAt", "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, 0, 0, NULL, NOW(), NOW())
      ON CONFLICT ("customerUserId", "tenantId") DO NOTHING
    `,
    [customerUserId, input.tenantId],
  );

  return {
    customerId,
    customerUserId,
    customerName: nextFullName,
    customerPhone: phone,
    isTest: false,
  };
}

export async function checkoutPosSale(input: CheckoutInput) {
  await ensurePosTables();

  if (input.paymentMethod !== 'CASH' && input.paymentMethod !== 'TRANSFER' && input.paymentMethod !== 'CARD' && input.paymentMethod !== 'MIXED') {
    throw new Error('Medio de pago inválido');
  }

  const normalizedSource = input.sourceType === 'APPOINTMENT' ? 'APPOINTMENT' : 'WALKIN';
  const normalizedServiceItems = Array.isArray(input.serviceItems)
    ? input.serviceItems
        .map((item) => ({
          serviceId: String(item?.serviceId ?? '').trim(),
          employeeId: String(item?.employeeId ?? '').trim(),
        }))
        .filter((item) => item.serviceId && item.employeeId)
    : [];

  const normalizedProductItems = Array.isArray(input.productItems)
    ? input.productItems
        .map((item) => ({
          productId: String(item?.productId ?? '').trim(),
          quantity: Math.max(1, asInt(item?.quantity, 1)),
        }))
        .filter((item) => item.productId)
    : [];

  if (normalizedSource === 'WALKIN' && normalizedServiceItems.length === 0 && normalizedProductItems.length === 0) {
    throw new Error('Agregá al menos un servicio o producto');
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const branchRes = await client.query<{ timeZone: string }>(
      `
        SELECT "timeZone"
        FROM "Branch"
        WHERE id = $1
          AND "tenantId" = $2
        LIMIT 1
      `,
      [input.branchId, input.tenantId],
    );
    const branchTimeZone = branchRes.rows[0]?.timeZone ?? 'America/Argentina/Buenos_Aires';
    const nowIso = new Date().toISOString();
    const defaultVisitDate = localParts(nowIso, branchTimeZone).dayKey;
    const walkInVisitDate = parseDateOnly(input.walkInVisitDate) ?? defaultVisitDate;
    const explicitWalkInStartMinutes = parseTimeOnly(input.walkInVisitTime);
    const normalizedNotes = normalizeText(input.notes);

    let linkedAppointmentId: string | null = null;
    let customerFromAppointment: { customerId: string | null; fullName: string | null; phone: string | null } | null = null;

    const serviceLines: Array<{
      description: string;
      quantity: number;
      unitPriceCents: number;
      totalPriceCents: number;
      serviceId: string;
      employeeId: string;
      durationMins: number;
      appointmentLineId: string | null;
      appointmentId: string | null;
    }> = [];

    if (normalizedSource === 'APPOINTMENT') {
      const appointmentId = String(input.appointmentId ?? '').trim();
      if (!appointmentId) {
        throw new Error('Seleccioná una reserva para cobrar');
      }

      const appointmentRes = await client.query<{
        id: string;
        status: string;
        customerId: string | null;
        customerName: string | null;
        customerPhone: string | null;
      }>(
        `
          SELECT
            a.id,
            a.status::text as status,
            a."customerId",
            c."fullName" as "customerName",
            c.phone as "customerPhone"
          FROM "Appointment" a
          LEFT JOIN "Customer" c ON c.id = a."customerId" AND c."archivedAt" IS NULL
          WHERE a.id = $1
            AND a."tenantId" = $2
            AND a."branchId" = $3
          FOR UPDATE OF a
        `,
        [appointmentId, input.tenantId, input.branchId],
      );

      const appointment = appointmentRes.rows[0];
      if (!appointment) {
        throw new Error('Reserva no encontrada');
      }

      linkedAppointmentId = appointment.id;
      customerFromAppointment = {
        customerId: appointment.customerId,
        fullName: appointment.customerName,
        phone: appointment.customerPhone,
      };

      if (appointment.status !== 'COMPLETED') {
        const linesRes = await client.query<{
          id: string;
          serviceId: string;
          serviceNameSnapshot: string;
          priceCents: number;
          employeeId: string;
        }>(
          `
            SELECT
              l.id,
              l."serviceId",
              l."serviceNameSnapshot",
              l."priceCents",
              a."employeeId"
            FROM "AppointmentLine" l
            INNER JOIN "Appointment" a ON a.id = l."appointmentId"
            WHERE l."appointmentId" = $1
          `,
          [appointment.id],
        );

        for (const line of linesRes.rows) {
          serviceLines.push({
            description: line.serviceNameSnapshot,
            quantity: 1,
            unitPriceCents: Number(line.priceCents ?? 0),
            totalPriceCents: Number(line.priceCents ?? 0),
            serviceId: line.serviceId,
            employeeId: line.employeeId,
            durationMins: 30,
            appointmentLineId: line.id,
            appointmentId: appointment.id,
          });
        }
      }

      if (normalizedServiceItems.length > 0) {
        const serviceIds = unique(normalizedServiceItems.map((item) => item.serviceId));
        const employeeIds = unique(normalizedServiceItems.map((item) => item.employeeId));

        const [servicesRes, employeesRes, assignmentRes] = await Promise.all([
          client.query<{
            id: string;
            name: string;
            durationMins: number;
            priceCents: number;
            isActive: boolean;
          }>(
            `
              SELECT id, name, "durationMins", "priceCents", "isActive"
              FROM "Service"
              WHERE "tenantId" = $1
                AND "branchId" = $2
                AND id = ANY($3::text[])
            `,
            [input.tenantId, input.branchId, serviceIds],
          ),
          client.query<{
            id: string;
            fullName: string;
            isActive: boolean;
          }>(
            `
              SELECT id, "fullName", "isActive"
              FROM "Employee"
              WHERE "tenantId" = $1
                AND "branchId" = $2
                AND id = ANY($3::text[])
              FOR UPDATE
            `,
            [input.tenantId, input.branchId, employeeIds],
          ),
          client.query<{ serviceId: string; employeeId: string }>(
            `
              SELECT "serviceId", "employeeId"
              FROM "ServiceAssignment"
              WHERE "employeeId" = ANY($1::text[])
                AND "serviceId" = ANY($2::text[])
            `,
            [employeeIds, serviceIds],
          ),
        ]);

        const serviceMap = new Map(servicesRes.rows.map((row) => [row.id, row]));
        const employeeMap = new Map(employeesRes.rows.map((row) => [row.id, row]));
        const assignmentSet = new Set(assignmentRes.rows.map((row) => `${row.serviceId}:${row.employeeId}`));

        for (const row of normalizedServiceItems) {
          const service = serviceMap.get(row.serviceId);
          const employee = employeeMap.get(row.employeeId);

          if (!service || !service.isActive) {
            throw new Error('Uno de los servicios seleccionados no está disponible');
          }
          if (!employee || !employee.isActive) {
            throw new Error('Uno de los trabajadores seleccionados no está disponible');
          }
          if (!assignmentSet.has(`${row.serviceId}:${row.employeeId}`)) {
            throw new Error(`El trabajador ${employee.fullName} no tiene asignado este servicio`);
          }

          serviceLines.push({
            description: `${service.name} · ${employee.fullName}`,
            quantity: 1,
            unitPriceCents: Number(service.priceCents ?? 0),
            totalPriceCents: Number(service.priceCents ?? 0),
            serviceId: service.id,
            employeeId: employee.id,
            durationMins: Number(service.durationMins ?? 30),
            appointmentLineId: null,
            appointmentId: appointment.id,
          });
        }
      }
    } else {
      const serviceIds = unique(normalizedServiceItems.map((item) => item.serviceId));
      const employeeIds = unique(normalizedServiceItems.map((item) => item.employeeId));

      const [servicesRes, employeesRes, assignmentRes] = await Promise.all([
        client.query<{
          id: string;
          name: string;
          durationMins: number;
          priceCents: number;
          isActive: boolean;
        }>(
          `
            SELECT id, name, "durationMins", "priceCents", "isActive"
            FROM "Service"
            WHERE "tenantId" = $1
              AND "branchId" = $2
              AND id = ANY($3::text[])
          `,
          [input.tenantId, input.branchId, serviceIds],
        ),
        client.query<{
          id: string;
          fullName: string;
          isActive: boolean;
        }>(
          `
            SELECT id, "fullName", "isActive"
            FROM "Employee"
            WHERE "tenantId" = $1
              AND "branchId" = $2
              AND id = ANY($3::text[])
            FOR UPDATE
          `,
          [input.tenantId, input.branchId, employeeIds],
        ),
        client.query<{ serviceId: string; employeeId: string }>(
          `
            SELECT "serviceId", "employeeId"
            FROM "ServiceAssignment"
            WHERE "employeeId" = ANY($1::text[])
              AND "serviceId" = ANY($2::text[])
          `,
          [employeeIds, serviceIds],
        ),
      ]);

      const serviceMap = new Map(servicesRes.rows.map((row) => [row.id, row]));
      const employeeMap = new Map(employeesRes.rows.map((row) => [row.id, row]));
      const assignmentSet = new Set(assignmentRes.rows.map((row) => `${row.serviceId}:${row.employeeId}`));

      for (const row of normalizedServiceItems) {
        const service = serviceMap.get(row.serviceId);
        const employee = employeeMap.get(row.employeeId);

        if (!service || !service.isActive) {
          throw new Error('Uno de los servicios seleccionados no está disponible');
        }
        if (!employee || !employee.isActive) {
          throw new Error('Uno de los trabajadores seleccionados no está disponible');
        }
        if (!assignmentSet.has(`${row.serviceId}:${row.employeeId}`)) {
          throw new Error(`El trabajador ${employee.fullName} no tiene asignado este servicio`);
        }

        serviceLines.push({
          description: `${service.name} · ${employee.fullName}`,
          quantity: 1,
            unitPriceCents: Number(service.priceCents ?? 0),
            totalPriceCents: Number(service.priceCents ?? 0),
            serviceId: service.id,
            employeeId: employee.id,
            durationMins: Number(service.durationMins ?? 30),
            appointmentLineId: null,
            appointmentId: null,
          });
      }
    }

    const customerResolved = await upsertCustomerForSale(client, {
      tenantId: input.tenantId,
      fullName: input.customer?.fullName ?? customerFromAppointment?.fullName ?? undefined,
      phone: input.customer?.phone ?? customerFromAppointment?.phone ?? undefined,
      allowAnonymous: Boolean(input.customer?.allowAnonymous),
      isTest: Boolean(input.customer?.isTest),
    });

    if (normalizedSource === 'APPOINTMENT' && linkedAppointmentId && customerResolved.customerId) {
      await client.query(
        `
          UPDATE "Appointment"
          SET "customerId" = $1,
              "updatedAt" = NOW()
          WHERE id = $2
        `,
        [customerResolved.customerId, linkedAppointmentId],
      );
    }

    const productIds = unique(normalizedProductItems.map((item) => item.productId));
    const inventorySettingsRes = await client.query<{ useInventory: boolean }>(
      `
        SELECT "useInventory"
        FROM "BranchInventorySettings"
        WHERE "tenantId" = $1 AND "branchId" = $2
        LIMIT 1
      `,
      [input.tenantId, input.branchId],
    );
    const useInventory = Boolean(inventorySettingsRes.rows[0]?.useInventory ?? false);
    if (normalizedProductItems.length > 0 && !useInventory) {
      throw new Error('El inventario de productos está deshabilitado para esta sucursal');
    }

    const productRes = productIds.length
      ? await client.query<{
          id: string;
          name: string;
          priceCents: number;
          stockQuantity: number;
          isActive: boolean;
        }>(
          `
            SELECT id, name, "priceCents", "stockQuantity", "isActive"
            FROM "BranchProduct"
            WHERE "tenantId" = $1
              AND "branchId" = $2
              AND id = ANY($3::text[])
            FOR UPDATE
          `,
          [input.tenantId, input.branchId, productIds],
        )
      : { rows: [] as Array<{ id: string; name: string; priceCents: number; stockQuantity: number; isActive: boolean }> };

    const productMap = new Map(productRes.rows.map((row) => [row.id, row]));

    const productLines = normalizedProductItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product || !product.isActive) {
        throw new Error('Uno de los productos ya no está disponible');
      }
      const qty = Math.max(1, asInt(item.quantity, 1));
      if (Number(product.stockQuantity ?? 0) < qty) {
        throw new Error(`Stock insuficiente para ${product.name}`);
      }
      const unit = Number(product.priceCents ?? 0);
      return {
        description: product.name,
        quantity: qty,
        unitPriceCents: unit,
        totalPriceCents: unit * qty,
        productId: product.id,
      };
    });

    const subtotalCents =
      serviceLines.reduce((sum, row) => sum + row.totalPriceCents, 0) +
      productLines.reduce((sum, row) => sum + row.totalPriceCents, 0);

    let pointsRedeemed = 0;
    let rewardDiscountCents = 0;
    let rewardId: string | null = null;

    const requestedRewardId = normalizeText(input.rewardId);
    if (requestedRewardId) {
      if (!customerResolved.customerUserId) {
        throw new Error('Para canjear puntos necesitás cargar un cliente con teléfono');
      }

      const rewardRes = await client.query<{
        id: string;
        title: string;
        pointsRequired: number;
        isActive: boolean;
      }>(
        `
          SELECT id, title, "pointsRequired", "isActive"
          FROM "CustomerPointsReward"
          WHERE id = $1 AND "tenantId" = $2
          LIMIT 1
        `,
        [requestedRewardId, input.tenantId],
      );

      const reward = rewardRes.rows[0];
      if (!reward || !reward.isActive) {
        throw new Error('La recompensa seleccionada no está disponible');
      }

      const pointsRes = await client.query<{ points: number }>(
        `
          SELECT points
          FROM "CustomerTenantPoints"
          WHERE "customerUserId" = $1 AND "tenantId" = $2
          FOR UPDATE
        `,
        [customerResolved.customerUserId, input.tenantId],
      );

      const availablePoints = Number(pointsRes.rows[0]?.points ?? 0);
      if (availablePoints < Number(reward.pointsRequired ?? 0)) {
        throw new Error('El cliente no tiene puntos suficientes para ese canje');
      }

      pointsRedeemed = Number(reward.pointsRequired ?? 0);
      rewardId = reward.id;
      rewardDiscountCents = Math.min(asCurrencyCents(input.rewardDiscountCents), subtotalCents);

      await client.query(
        `
          UPDATE "CustomerTenantPoints"
          SET points = GREATEST(0, points - $1),
              "updatedAt" = NOW()
          WHERE "customerUserId" = $2 AND "tenantId" = $3
        `,
        [pointsRedeemed, customerResolved.customerUserId, input.tenantId],
      );
    }

    const discountCents = Math.min(asCurrencyCents(input.discountCents), Math.max(0, subtotalCents - rewardDiscountCents));
    const totalCents = Math.max(0, subtotalCents - discountCents - rewardDiscountCents);
    const paidCents = Math.max(totalCents, asCurrencyCents(input.paidCents, totalCents));

    const saleRes = await client.query<{ id: string; createdAt: Date }>(
      `
        INSERT INTO "PosSale" (
          id,
          "tenantId",
          "branchId",
          "cashSessionId",
          "customerId",
          "customerUserId",
          "appointmentId",
          "sourceType",
          status,
          "customerNameSnapshot",
          "customerPhoneSnapshot",
          notes,
          "paymentMethod",
          "subtotalCents",
          "discountCents",
          "rewardDiscountCents",
          "totalCents",
          "paidCents",
          "pointsRedeemed",
          "rewardId",
          "createdByUserId",
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
          $7,
          'PAID',
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          $18,
          $19,
          NOW(),
          NOW()
        )
        RETURNING id, "createdAt"
      `,
      [
        input.tenantId,
        input.branchId,
        null,
        customerResolved.customerId,
        customerResolved.customerUserId,
        linkedAppointmentId,
        normalizedSource,
        customerResolved.customerName,
        customerResolved.customerPhone,
        normalizedNotes,
        input.paymentMethod,
        subtotalCents,
        discountCents,
        rewardDiscountCents,
        totalCents,
        paidCents,
        pointsRedeemed,
        rewardId,
        input.userId,
      ],
    );

    const saleId = saleRes.rows[0].id;

    for (const line of serviceLines) {
      await client.query(
        `
          INSERT INTO "PosSaleLine" (
            id,
            "saleId",
            "lineType",
            "description",
            "quantity",
            "unitPriceCents",
            "totalPriceCents",
            "serviceId",
            "employeeId",
            "appointmentLineId",
            "createdAt"
          )
          VALUES (gen_random_uuid()::text, $1, 'SERVICE', $2, $3, $4, $5, $6, $7, $8, NOW())
        `,
        [saleId, line.description, line.quantity, line.unitPriceCents, line.totalPriceCents, line.serviceId, line.employeeId, line.appointmentLineId],
      );
    }

    for (const line of productLines) {
      await client.query(
        `
          INSERT INTO "PosSaleLine" (
            id,
            "saleId",
            "lineType",
            "description",
            "quantity",
            "unitPriceCents",
            "totalPriceCents",
            "productId",
            "createdAt"
          )
          VALUES (gen_random_uuid()::text, $1, 'PRODUCT', $2, $3, $4, $5, $6, NOW())
        `,
        [saleId, line.description, line.quantity, line.unitPriceCents, line.totalPriceCents, line.productId],
      );

      await client.query(
        `
          UPDATE "BranchProduct"
          SET "stockQuantity" = GREATEST(0, "stockQuantity" - $1),
              "updatedAt" = NOW()
          WHERE id = $2
            AND "tenantId" = $3
            AND "branchId" = $4
        `,
        [line.quantity, line.productId, input.tenantId, input.branchId],
      );
    }

    if (rewardId && customerResolved.customerUserId && pointsRedeemed > 0) {
      await client.query(
        `
          INSERT INTO "CustomerPointsRedemption" (
            id, "tenantId", "customerUserId", "rewardId", "pointsSpent", "discountCents", "posSaleId", "createdAt"
          )
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW())
        `,
        [input.tenantId, customerResolved.customerUserId, rewardId, pointsRedeemed, rewardDiscountCents, saleId],
      );
    }

    if (normalizedSource === 'APPOINTMENT' && linkedAppointmentId) {
      await client.query(
        `
          UPDATE "Appointment"
          SET status = 'COMPLETED',
              "totalChargedCents" = $1,
              "updatedAt" = NOW()
          WHERE id = $2
            AND status <> 'CANCELLED'
        `,
        [Math.max(0, subtotalCents - discountCents), linkedAppointmentId],
      );
    }

    if (normalizedSource === 'WALKIN' && serviceLines.length > 0) {
      const totalDurationMins = serviceLines.reduce((sum, row) => sum + Math.max(1, Number(row.durationMins ?? 30)), 0);
      const currentLocalMinutes = localParts(nowIso, branchTimeZone).minutes;
      const walkInBaseMinutes =
        explicitWalkInStartMinutes !== null
          ? explicitWalkInStartMinutes
          : Math.max(0, currentLocalMinutes - totalDurationMins);

      let offsetMinutes = 0;
      for (const row of serviceLines) {
        const durationMins = Math.max(1, Number(row.durationMins ?? 30));
        const startsAt = localDateTimeToUtc(walkInVisitDate, walkInBaseMinutes + offsetMinutes, branchTimeZone);
        const endsAt = new Date(startsAt.getTime() + durationMins * 60 * 1000);

        const appointmentRes = await client.query<{ id: string }>(
          `
            INSERT INTO "Appointment" (
              id,
              "tenantId",
              "branchId",
              "posSaleId",
              "employeeId",
              "customerId",
              "customerUserId",
              "createdBy",
              status,
              "startsAt",
              "endsAt",
              "totalChargedCents",
              notes,
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
              'STAFF',
              'COMPLETED',
              $7,
              $8,
              $9,
              $10,
              NOW(),
              NOW()
            )
            RETURNING id
          `,
          [
            input.tenantId,
            input.branchId,
            saleId,
            row.employeeId,
            customerResolved.customerId,
            customerResolved.customerUserId,
            startsAt.toISOString(),
            endsAt.toISOString(),
            row.totalPriceCents,
            normalizedNotes,
          ],
        );

        await client.query(
          `
            INSERT INTO "AppointmentLine" (
              id, "appointmentId", "serviceId", "serviceNameSnapshot", "durationMins", "priceCents", "createdAt"
            )
            VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW())
          `,
          [
            appointmentRes.rows[0].id,
            row.serviceId,
            row.description.split(' · ')[0],
            durationMins,
            row.unitPriceCents,
          ],
        );

        offsetMinutes += durationMins;
      }
    }

    await client.query('COMMIT');

    return {
      sale: {
        id: saleId,
        createdAt: saleRes.rows[0].createdAt.toISOString(),
        subtotalCents,
        discountCents,
        rewardDiscountCents,
        totalCents,
        paidCents,
        pointsRedeemed,
      },
      customer: {
        id: customerResolved.customerId,
        customerUserId: customerResolved.customerUserId,
        isTest: Boolean(customerResolved.isTest),
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
