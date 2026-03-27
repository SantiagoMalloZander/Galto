import { db } from './db';
import { ensureCustomerAccountTables } from './customer-accounts';
import { ensurePosTables } from './pos-data';
import { assertTenantAccess, hasBranchPermission } from './reservas-data';

type TenantCustomerRow = {
  customerId: string;
  customerUserId: string | null;
  fullName: string;
  phone: string;
  isTest: boolean;
  createdAt: Date;
  updatedAt: Date;
  bookingsCount: string;
  purchasesCount: string;
  lastVisitAt: Date | null;
};

export async function getClientesPermissions(input: {
  userId: string;
  tenantId: string;
  branchId: string;
}) {
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) {
    return {
      canRead: false,
      canWrite: false,
      membership: null,
    };
  }

  if (membership.role === 'OWNER') {
    return {
      canRead: true,
      canWrite: true,
      membership,
    };
  }

  const [canRead, canWrite] = await Promise.all([
    hasBranchPermission({
      userId: input.userId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      permission: 'CUSTOMERS_READ',
    }),
    hasBranchPermission({
      userId: input.userId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      permission: 'CUSTOMERS_WRITE',
    }),
  ]);

  return {
    canRead,
    canWrite,
    membership,
  };
}

export async function listTenantCustomers(input: {
  tenantId: string;
  search?: string | null;
  limit?: number;
  filter?: 'ALL' | 'WITH_VISITS' | 'WITHOUT_VISITS' | 'TEST';
}) {
  await ensureCustomerAccountTables();
  await ensurePosTables();

  const limit = Math.max(1, Math.min(200, Number(input.limit ?? 100)));
  const search = String(input.search ?? '').trim().toLowerCase();
  const searchPattern = search ? `%${search}%` : null;
  const filter = input.filter === 'WITH_VISITS' || input.filter === 'WITHOUT_VISITS' || input.filter === 'TEST'
    ? input.filter
    : 'ALL';

  const result = await db.query<TenantCustomerRow>(
    `
      WITH customer_stats AS (
        SELECT
          c.id AS "customerId",
          ci."customerUserId" AS "customerUserId",
          c."fullName",
          c.phone,
          COALESCE(c."isTest", FALSE) AS "isTest",
          c."createdAt",
          c."updatedAt",
          COALESCE((
            SELECT COUNT(DISTINCT a.id)::int
            FROM "Appointment" a
            WHERE a."customerId" = c.id
              AND a."tenantId" = c."tenantId"
              AND a.status IN ('PENDING', 'CONFIRMED', 'COMPLETED')
          ), 0)::text AS "bookingsCount",
          COALESCE((
            SELECT COUNT(DISTINCT ps.id)::int
            FROM "PosSale" ps
            WHERE ps."customerId" = c.id
              AND ps."tenantId" = c."tenantId"
              AND ps.status = 'PAID'
          ), 0)::text AS "purchasesCount",
          GREATEST(
            COALESCE((
              SELECT MAX(a."startsAt")
              FROM "Appointment" a
              WHERE a."customerId" = c.id
                AND a."tenantId" = c."tenantId"
                AND a.status IN ('PENDING', 'CONFIRMED', 'COMPLETED')
            ), to_timestamp(0)),
            COALESCE((
              SELECT MAX(ps."createdAt")
              FROM "PosSale" ps
              WHERE ps."customerId" = c.id
                AND ps."tenantId" = c."tenantId"
                AND ps.status = 'PAID'
            ), to_timestamp(0))
          ) AS "lastVisitAt"
        FROM "Customer" c
        LEFT JOIN "CustomerIdentity" ci ON ci."customerId" = c.id
        WHERE c."tenantId" = $1
          AND c."archivedAt" IS NULL
          AND (
            $2::text IS NULL
            OR LOWER(c."fullName") LIKE $2
            OR LOWER(c.phone) LIKE $2
          )
        GROUP BY c.id, ci."customerUserId", c."fullName", c.phone, c."isTest", c."createdAt", c."updatedAt"
      )
      SELECT *
      FROM customer_stats
      WHERE (
        $3::text = 'ALL'
        OR ($3::text = 'WITH_VISITS' AND (COALESCE("bookingsCount", '0')::int > 0 OR COALESCE("purchasesCount", '0')::int > 0))
        OR ($3::text = 'WITHOUT_VISITS' AND COALESCE("bookingsCount", '0')::int = 0 AND COALESCE("purchasesCount", '0')::int = 0)
        OR ($3::text = 'TEST' AND "isTest" = TRUE)
      )
      ORDER BY NULLIF("lastVisitAt", to_timestamp(0)) DESC NULLS LAST, "updatedAt" DESC, "createdAt" DESC
      LIMIT $4
    `,
    [input.tenantId, searchPattern, filter, limit],
  );

  return result.rows.map((row) => ({
    customerId: row.customerId,
    customerUserId: row.customerUserId,
    fullName: row.fullName,
    phone: row.phone,
    isTest: Boolean(row.isTest),
    bookingsCount: Number(row.bookingsCount ?? 0),
    purchasesCount: Number(row.purchasesCount ?? 0),
    lastVisitAt: row.lastVisitAt && row.lastVisitAt.getTime() > 0 ? row.lastVisitAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function deleteTenantCustomer(input: {
  tenantId: string;
  customerId: string;
}) {
  await ensureCustomerAccountTables();
  await ensurePosTables();

  const customerRes = await db.query<{
    customerId: string;
    customerUserId: string | null;
    fullName: string;
  }>(
    `
      SELECT
        c.id AS "customerId",
        ci."customerUserId" AS "customerUserId",
        c."fullName"
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
          AND (
            "customerId" = $2
            OR ($3::text IS NOT NULL AND "customerUserId" = $3)
          )
      `,
      [input.tenantId, customer.customerId, customer.customerUserId],
    );

    await client.query(
      `
        UPDATE "PosSale"
        SET "customerId" = NULL,
            "updatedAt" = NOW(),
            "customerNameSnapshot" = COALESCE("customerNameSnapshot", $3)
        WHERE "tenantId" = $1
          AND "customerId" = $2
      `,
      [input.tenantId, customer.customerId, customer.fullName],
    );

    if (customer.customerUserId) {
      await client.query(
        `
          DELETE FROM "CustomerPointsRedemption"
          WHERE "tenantId" = $1
            AND "customerUserId" = $2
        `,
        [input.tenantId, customer.customerUserId],
      );

      await client.query(
        `
          DELETE FROM "CustomerTenantPoints"
          WHERE "tenantId" = $1
            AND "customerUserId" = $2
        `,
        [input.tenantId, customer.customerUserId],
      );
    }

    await client.query(
      `
        DELETE FROM "CustomerIdentity"
        WHERE "customerId" = $1
      `,
      [customer.customerId],
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
    return {
      ok: true,
      customerId: customer.customerId,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
