import { db } from './db';
import { assertTenantAccess, hasBranchPermission } from './reservas-data';
import { ensurePosTables } from './pos-data';

type BranchExpenseRow = {
  id: string;
  name: string;
  description: string | null;
  amountPreTaxCents: number;
  isFixed: boolean;
  category: string;
  recurrence: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ExpenseServiceLinkRow = {
  expenseId: string;
  serviceId: string;
  serviceName: string;
};

type ExpenseProductLinkRow = {
  expenseId: string;
  productId: string;
  productName: string;
};

type ExpensePermissionSet = {
  canRead: boolean;
  canWrite: boolean;
  membership: { id: string; role: string } | null;
};

type ExpenseRecurrence = 'ONE_TIME' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

const VALID_RECURRENCES = new Set<ExpenseRecurrence>(['ONE_TIME', 'WEEKLY', 'MONTHLY', 'YEARLY']);

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asCents(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

function uniqueStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
  return [...new Set(normalized)];
}

function normalizeRecurrence(value: unknown): ExpenseRecurrence {
  if (typeof value === 'string' && VALID_RECURRENCES.has(value as ExpenseRecurrence)) {
    return value as ExpenseRecurrence;
  }
  return 'ONE_TIME';
}

export async function ensureGastosTables() {
  await ensurePosTables();

  await db.query(`
    CREATE TABLE IF NOT EXISTS "BranchExpense" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "branchId" TEXT NOT NULL REFERENCES "Branch"(id) ON DELETE CASCADE,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "amountPreTaxCents" INTEGER NOT NULL,
      "isFixed" BOOLEAN NOT NULL DEFAULT FALSE,
      "category" TEXT NOT NULL DEFAULT 'OTHER',
      "recurrence" TEXT NOT NULL DEFAULT 'ONE_TIME',
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdByUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "BranchExpense_amount_check" CHECK ("amountPreTaxCents" >= 0),
      CONSTRAINT "BranchExpense_recurrence_check" CHECK ("recurrence" IN ('ONE_TIME', 'WEEKLY', 'MONTHLY', 'YEARLY'))
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "BranchExpense_branch_idx"
    ON "BranchExpense"("tenantId", "branchId", "createdAt" DESC)
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "BranchExpenseServiceLink" (
      "expenseId" TEXT NOT NULL REFERENCES "BranchExpense"(id) ON DELETE CASCADE,
      "serviceId" TEXT NOT NULL REFERENCES "Service"(id) ON DELETE CASCADE,
      PRIMARY KEY ("expenseId", "serviceId")
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "BranchExpenseServiceLink_service_idx"
    ON "BranchExpenseServiceLink"("serviceId")
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "BranchExpenseProductLink" (
      "expenseId" TEXT NOT NULL REFERENCES "BranchExpense"(id) ON DELETE CASCADE,
      "productId" TEXT NOT NULL REFERENCES "BranchProduct"(id) ON DELETE CASCADE,
      PRIMARY KEY ("expenseId", "productId")
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "BranchExpenseProductLink_product_idx"
    ON "BranchExpenseProductLink"("productId")
  `);
}

export async function getGastosPermissions(input: {
  userId: string;
  tenantId: string;
  branchId: string;
}): Promise<ExpensePermissionSet> {
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) {
    return { canRead: false, canWrite: false, membership: null };
  }

  if (membership.role === 'OWNER') {
    return { canRead: true, canWrite: true, membership };
  }

  const [
    canReadBranch,
    canWriteBranch,
    canReadInventory,
    canWriteInventory,
    canReadServices,
    canWriteServices,
  ] = await Promise.all([
    hasBranchPermission({ ...input, permission: 'BRANCH_READ' }),
    hasBranchPermission({ ...input, permission: 'BRANCH_WRITE' }),
    hasBranchPermission({ ...input, permission: 'INVENTORY_READ' }),
    hasBranchPermission({ ...input, permission: 'INVENTORY_WRITE' }),
    hasBranchPermission({ ...input, permission: 'SERVICES_READ' }),
    hasBranchPermission({ ...input, permission: 'SERVICES_WRITE' }),
  ]);

  return {
    canRead: canReadBranch || canWriteBranch || canReadInventory || canWriteInventory || canReadServices || canWriteServices,
    canWrite: canWriteBranch || canWriteInventory || canWriteServices,
    membership,
  };
}

export async function getGastosContext(input: {
  tenantId: string;
  branchId: string;
}) {
  await ensureGastosTables();

  const [branchRes, servicesRes, productsRes, expensesRes] = await Promise.all([
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
      categoryName: string | null;
      durationMins: number;
      priceCents: number;
      isActive: boolean;
    }>(
      `
        SELECT
          s.id,
          s.name,
          sc.name AS "categoryName",
          s."durationMins",
          s."priceCents",
          s."isActive"
        FROM "Service" s
        LEFT JOIN "ServiceCategory" sc ON sc.id = s."categoryId"
        WHERE s."tenantId" = $1 AND s."branchId" = $2
        ORDER BY COALESCE(sc.name, ''), s.name
      `,
      [input.tenantId, input.branchId],
    ),
    db.query<{
      id: string;
      name: string;
      priceCents: number;
      stockQuantity: number;
      isActive: boolean;
    }>(
      `
        SELECT id, name, "priceCents", "stockQuantity", "isActive"
        FROM "BranchProduct"
        WHERE "tenantId" = $1 AND "branchId" = $2
        ORDER BY name ASC
      `,
      [input.tenantId, input.branchId],
    ),
    db.query<BranchExpenseRow>(
      `
        SELECT
          id,
          name,
          description,
          "amountPreTaxCents",
          "isFixed",
          category,
          recurrence,
          "isActive",
          "createdAt",
          "updatedAt"
        FROM "BranchExpense"
        WHERE "tenantId" = $1 AND "branchId" = $2
        ORDER BY "createdAt" DESC
      `,
      [input.tenantId, input.branchId],
    ),
  ]);

  const branch = branchRes.rows[0];
  if (!branch) {
    throw new Error('Sucursal no encontrada');
  }

  const expenseIds = expensesRes.rows.map((row) => row.id);
  let serviceLinks: ExpenseServiceLinkRow[] = [];
  let productLinks: ExpenseProductLinkRow[] = [];

  if (expenseIds.length > 0) {
    const [serviceLinksRes, productLinksRes] = await Promise.all([
      db.query<ExpenseServiceLinkRow>(
        `
          SELECT
            l."expenseId",
            l."serviceId",
            s.name AS "serviceName"
          FROM "BranchExpenseServiceLink" l
          INNER JOIN "Service" s ON s.id = l."serviceId"
          WHERE l."expenseId" = ANY($1::text[])
          ORDER BY s.name ASC
        `,
        [expenseIds],
      ),
      db.query<ExpenseProductLinkRow>(
        `
          SELECT
            l."expenseId",
            l."productId",
            p.name AS "productName"
          FROM "BranchExpenseProductLink" l
          INNER JOIN "BranchProduct" p ON p.id = l."productId"
          WHERE l."expenseId" = ANY($1::text[])
          ORDER BY p.name ASC
        `,
        [expenseIds],
      ),
    ]);
    serviceLinks = serviceLinksRes.rows;
    productLinks = productLinksRes.rows;
  }

  const servicesByExpense = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of serviceLinks) {
    const current = servicesByExpense.get(row.expenseId) ?? [];
    current.push({ id: row.serviceId, name: row.serviceName });
    servicesByExpense.set(row.expenseId, current);
  }

  const productsByExpense = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of productLinks) {
    const current = productsByExpense.get(row.expenseId) ?? [];
    current.push({ id: row.productId, name: row.productName });
    productsByExpense.set(row.expenseId, current);
  }

  return {
    branch,
    services: servicesRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      categoryName: row.categoryName,
      durationMins: row.durationMins,
      priceCents: row.priceCents,
      isActive: row.isActive,
    })),
    products: productsRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      priceCents: row.priceCents,
      stockQuantity: row.stockQuantity,
      isActive: row.isActive,
    })),
    expenses: expensesRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      amountPreTaxCents: row.amountPreTaxCents,
      isFixed: row.isFixed,
      category: row.category,
      recurrence: row.recurrence,
      isActive: row.isActive,
      services: servicesByExpense.get(row.id) ?? [],
      products: productsByExpense.get(row.id) ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function upsertBranchExpense(input: {
  tenantId: string;
  branchId: string;
  userId: string;
  expenseId?: string;
  name: string;
  description?: string | null;
  amountPreTaxCents: number;
  isFixed: boolean;
  category?: string | null;
  recurrence?: string | null;
  isActive?: boolean;
  serviceIds?: unknown;
  productIds?: unknown;
}) {
  await ensureGastosTables();

  const name = String(input.name ?? '').trim();
  if (name.length < 2) {
    throw new Error('El nombre del gasto es obligatorio');
  }

  const amountPreTaxCents = asCents(input.amountPreTaxCents);
  const isFixed = Boolean(input.isFixed);
  const recurrence = normalizeRecurrence(input.recurrence);
  const category = normalizeText(input.category) ?? 'OTHER';
  const description = normalizeText(input.description);
  const isActive = input.isActive !== false;

  const serviceIds = uniqueStringArray(input.serviceIds);
  const productIds = uniqueStringArray(input.productIds);

  if (!isFixed && serviceIds.length === 0 && productIds.length === 0) {
    throw new Error('Un gasto variable debe asociarse al menos a un servicio o a un ítem de inventario');
  }

  if (serviceIds.length > 0) {
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
      throw new Error('Hay servicios asociados inválidos para esta sucursal');
    }
  }

  if (productIds.length > 0) {
    const productsRes = await db.query<{ id: string }>(
      `
        SELECT id
        FROM "BranchProduct"
        WHERE "tenantId" = $1
          AND "branchId" = $2
          AND id = ANY($3::text[])
      `,
      [input.tenantId, input.branchId, productIds],
    );
    if (productsRes.rowCount !== productIds.length) {
      throw new Error('Hay ítems de inventario inválidos para esta sucursal');
    }
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    let expenseId = input.expenseId ? String(input.expenseId) : '';
    if (expenseId) {
      const updateRes = await client.query<{ id: string }>(
        `
          UPDATE "BranchExpense"
          SET
            "name" = $1,
            "description" = $2,
            "amountPreTaxCents" = $3,
            "isFixed" = $4,
            "category" = $5,
            "recurrence" = $6,
            "isActive" = $7,
            "updatedAt" = NOW()
          WHERE id = $8
            AND "tenantId" = $9
            AND "branchId" = $10
          RETURNING id
        `,
        [
          name,
          description,
          amountPreTaxCents,
          isFixed,
          category,
          recurrence,
          isActive,
          expenseId,
          input.tenantId,
          input.branchId,
        ],
      );
      if (!updateRes.rows[0]) {
        throw new Error('Gasto no encontrado');
      }
    } else {
      const insertRes = await client.query<{ id: string }>(
        `
          INSERT INTO "BranchExpense" (
            id,
            "tenantId",
            "branchId",
            "name",
            "description",
            "amountPreTaxCents",
            "isFixed",
            "category",
            "recurrence",
            "isActive",
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
          name,
          description,
          amountPreTaxCents,
          isFixed,
          category,
          recurrence,
          isActive,
          input.userId,
        ],
      );
      expenseId = insertRes.rows[0].id;
    }

    await client.query(`DELETE FROM "BranchExpenseServiceLink" WHERE "expenseId" = $1`, [expenseId]);
    await client.query(`DELETE FROM "BranchExpenseProductLink" WHERE "expenseId" = $1`, [expenseId]);

    for (const serviceId of serviceIds) {
      await client.query(
        `
          INSERT INTO "BranchExpenseServiceLink" ("expenseId", "serviceId")
          VALUES ($1, $2)
          ON CONFLICT ("expenseId", "serviceId") DO NOTHING
        `,
        [expenseId, serviceId],
      );
    }

    for (const productId of productIds) {
      await client.query(
        `
          INSERT INTO "BranchExpenseProductLink" ("expenseId", "productId")
          VALUES ($1, $2)
          ON CONFLICT ("expenseId", "productId") DO NOTHING
        `,
        [expenseId, productId],
      );
    }

    await client.query('COMMIT');
    return { id: expenseId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteBranchExpense(input: {
  tenantId: string;
  branchId: string;
  expenseId: string;
}) {
  await ensureGastosTables();

  const result = await db.query<{ id: string }>(
    `
      DELETE FROM "BranchExpense"
      WHERE id = $1 AND "tenantId" = $2 AND "branchId" = $3
      RETURNING id
    `,
    [input.expenseId, input.tenantId, input.branchId],
  );

  if (!result.rows[0]) {
    throw new Error('Gasto no encontrado');
  }

  return { ok: true, expenseId: result.rows[0].id };
}
