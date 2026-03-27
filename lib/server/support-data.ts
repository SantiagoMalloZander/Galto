import { db } from './db';
import { assertTenantAccess } from './reservas-data';
import { TRANSFER_CBU } from './admin-data';
import { createMercadoPagoPreference, getMercadoPagoPayment, hasMercadoPagoConfig } from './mercadopago';

export type SupportPaymentMethod = 'MERCADOPAGO' | 'TRANSFER';
export type SupportPurchaseStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type SupportServiceStatus = 'PENDING' | 'DONE';

export type SupportPackageCode = 'PACK_1H_20' | 'PACK_2H_36' | 'PACK_4H_70';

export const SUPPORT_PACKAGES: Array<{
  code: SupportPackageCode;
  label: string;
  hours: number;
  amountArs: number;
}> = [
  { code: 'PACK_1H_20', label: 'Paquete 1 hora', hours: 1, amountArs: 20 },
  { code: 'PACK_2H_36', label: 'Paquete 2 horas', hours: 2, amountArs: 36 },
  { code: 'PACK_4H_70', label: 'Paquete 4 horas', hours: 4, amountArs: 70 },
];

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizePhone(value: unknown): string | null {
  const next = normalizeText(value);
  if (!next) return null;
  if (!/^\+?[0-9 ()-]{8,}$/.test(next)) return null;
  return next;
}

function getPublicBaseUrl() {
  return (
    process.env.BILLING_PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'https://galto.online'
  ).replace(/\/+$/, '');
}

export async function ensureSupportTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "SupportPurchase" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      "contactName" TEXT NOT NULL,
      "contactPhone" TEXT NOT NULL,
      "packageCode" TEXT NOT NULL,
      "packageLabel" TEXT NOT NULL,
      "hoursQty" INTEGER NOT NULL,
      "amountArs" DOUBLE PRECISION NOT NULL,
      "paymentMethod" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "cbu" TEXT,
      "checkoutUrl" TEXT,
      "mercadoPagoPreferenceId" TEXT,
      "mercadoPagoPaymentId" TEXT,
      "mercadoPagoStatus" TEXT,
      "summaryBusinessContext" TEXT,
      "summaryNeed" TEXT,
      "summaryGoal" TEXT,
      "summaryNotes" TEXT,
      "serviceStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "serviceCompletedAt" TIMESTAMPTZ,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "paidAt" TIMESTAMPTZ,
      CONSTRAINT "SupportPurchase_paymentMethod_check" CHECK ("paymentMethod" IN ('MERCADOPAGO','TRANSFER')),
      CONSTRAINT "SupportPurchase_status_check" CHECK ("status" IN ('PENDING','PAID','CANCELLED')),
      CONSTRAINT "SupportPurchase_serviceStatus_check" CHECK ("serviceStatus" IN ('PENDING','DONE')),
      CONSTRAINT "SupportPurchase_hours_check" CHECK ("hoursQty" > 0),
      CONSTRAINT "SupportPurchase_amount_check" CHECK ("amountArs" >= 0)
    )
  `);

  await db.query(
    `ALTER TABLE "SupportPurchase" ADD COLUMN IF NOT EXISTS "serviceStatus" TEXT NOT NULL DEFAULT 'PENDING'`,
  );
  await db.query(`ALTER TABLE "SupportPurchase" ADD COLUMN IF NOT EXISTS "serviceCompletedAt" TIMESTAMPTZ`);
  await db.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supportContactName" TEXT`);
  await db.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supportContactPhone" TEXT`);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "SupportPurchase_tenant_idx"
    ON "SupportPurchase"("tenantId", "createdAt" DESC)
  `);
}

function getPackageByCode(code: string) {
  return SUPPORT_PACKAGES.find((item) => item.code === code) ?? null;
}

export async function getSupportContext(input: { userId: string; tenantId: string }) {
  await ensureSupportTables();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');

  const purchasesRes = await db.query<{
    id: string;
    contactName: string;
    contactPhone: string;
    packageCode: SupportPackageCode;
    packageLabel: string;
    hoursQty: number;
    amountArs: number;
    paymentMethod: SupportPaymentMethod;
    status: SupportPurchaseStatus;
    cbu: string | null;
    checkoutUrl: string | null;
    mercadoPagoPreferenceId: string | null;
    mercadoPagoPaymentId: string | null;
    mercadoPagoStatus: string | null;
    summaryBusinessContext: string | null;
    summaryNeed: string | null;
    summaryGoal: string | null;
    summaryNotes: string | null;
    serviceStatus: SupportServiceStatus;
    serviceCompletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    paidAt: Date | null;
  }>(
    `
      SELECT
        id, "contactName", "contactPhone", "packageCode", "packageLabel", "hoursQty", "amountArs",
        "paymentMethod", status, cbu, "checkoutUrl", "mercadoPagoPreferenceId", "mercadoPagoPaymentId", "mercadoPagoStatus",
        "summaryBusinessContext", "summaryNeed", "summaryGoal", "summaryNotes",
        "serviceStatus", "serviceCompletedAt", "createdAt", "updatedAt", "paidAt"
      FROM "SupportPurchase"
      WHERE "tenantId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 50
    `,
    [input.tenantId],
  );

  const userProfileRes = await db.query<{
    supportContactName: string | null;
    supportContactPhone: string | null;
    fullName: string | null;
  }>(
    `
      SELECT
        "supportContactName",
        "supportContactPhone",
        "fullName"
      FROM "User"
      WHERE id = $1
      LIMIT 1
    `,
    [input.userId],
  );
  const userProfile = userProfileRes.rows[0];
  const latestPurchase = purchasesRes.rows[0];
  const defaultContactName =
    normalizeText(userProfile?.supportContactName) ??
    normalizeText(latestPurchase?.contactName) ??
    normalizeText(userProfile?.fullName) ??
    null;
  const defaultContactPhone =
    normalizePhone(userProfile?.supportContactPhone) ??
    normalizePhone(latestPurchase?.contactPhone) ??
    null;

  return {
    actor: { membershipId: membership.id, role: membership.role },
    packages: SUPPORT_PACKAGES,
    purchases: purchasesRes.rows.map((row) => ({
      ...row,
      hoursQty: Number(row.hoursQty),
      amountArs: Number(row.amountArs),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
      serviceCompletedAt: row.serviceCompletedAt ? row.serviceCompletedAt.toISOString() : null,
      summaryCompleted: Boolean(row.summaryNeed && row.summaryGoal),
    })),
    cbu: TRANSFER_CBU,
    mercadoPagoEnabled: hasMercadoPagoConfig(),
    defaultContactName,
    defaultContactPhone,
  };
}

export async function createSupportPurchase(input: {
  userId: string;
  tenantId: string;
  packageCode: string;
  paymentMethod: SupportPaymentMethod;
  contactName: string;
  contactPhone: string;
}) {
  await ensureSupportTables();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');

  const selectedPackage = getPackageByCode(input.packageCode);
  if (!selectedPackage) throw new Error('Paquete inválido');
  if (input.paymentMethod !== 'MERCADOPAGO' && input.paymentMethod !== 'TRANSFER') {
    throw new Error('Método de pago inválido');
  }

  const contactName = normalizeText(input.contactName);
  const contactPhone = normalizePhone(input.contactPhone);
  if (!contactName) throw new Error('Nombre de contacto obligatorio');
  if (!contactPhone) throw new Error('Teléfono de contacto inválido');

  const insertRes = await db.query<{ id: string }>(
    `
      INSERT INTO "SupportPurchase" (
        id, "tenantId", "userId", "contactName", "contactPhone", "packageCode", "packageLabel", "hoursQty", "amountArs",
        "paymentMethod", status, cbu, "createdAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING', $10, NOW(), NOW()
      )
      RETURNING id
    `,
    [
      input.tenantId,
      input.userId,
      contactName,
      contactPhone,
      selectedPackage.code,
      selectedPackage.label,
      selectedPackage.hours,
      selectedPackage.amountArs,
      input.paymentMethod,
      TRANSFER_CBU,
    ],
  );
  const purchaseId = insertRes.rows[0].id;

  await db.query(
    `
      UPDATE "User"
      SET
        "supportContactName" = $1,
        "supportContactPhone" = $2
      WHERE id = $3
    `,
    [contactName, contactPhone, input.userId],
  );

  if (input.paymentMethod === 'MERCADOPAGO') {
    if (!hasMercadoPagoConfig()) {
      throw new Error('Mercado Pago no está configurado');
    }
    const publicBase = getPublicBaseUrl();
    const preference = await createMercadoPagoPreference({
      externalReference: `SUPPORT:${purchaseId}`,
      title: `Soporte GALTO - ${selectedPackage.label}`,
      amountArs: selectedPackage.amountArs,
      successUrl: `${publicBase}/app/soporte?supportPurchaseId=${purchaseId}&supportPay=success`,
      failureUrl: `${publicBase}/app/soporte?supportPurchaseId=${purchaseId}&supportPay=failure`,
      pendingUrl: `${publicBase}/app/soporte?supportPurchaseId=${purchaseId}&supportPay=pending`,
      metadata: {
        kind: 'support',
        supportPurchaseId: purchaseId,
      },
    });

    const checkoutUrl = preference.initPoint || preference.sandboxInitPoint || null;
    await db.query(
      `
        UPDATE "SupportPurchase"
        SET
          "checkoutUrl" = $1,
          "mercadoPagoPreferenceId" = $2,
          "updatedAt" = NOW()
        WHERE id = $3
      `,
      [checkoutUrl, preference.id, purchaseId],
    );

    return {
      id: purchaseId,
      checkoutUrl,
      cbu: TRANSFER_CBU,
      status: 'PENDING' as SupportPurchaseStatus,
      paymentMethod: input.paymentMethod,
    };
  }

  return {
    id: purchaseId,
    checkoutUrl: null,
    cbu: TRANSFER_CBU,
    status: 'PENDING' as SupportPurchaseStatus,
    paymentMethod: input.paymentMethod,
  };
}

export async function verifySupportMercadoPago(input: {
  userId: string;
  tenantId: string;
  purchaseId: string;
  paymentId: string;
}) {
  await ensureSupportTables();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');

  const purchaseRes = await db.query<{
    id: string;
    tenantId: string;
    status: SupportPurchaseStatus;
    paymentMethod: SupportPaymentMethod;
    amountArs: number;
  }>(
    `
      SELECT id, "tenantId", status, "paymentMethod", "amountArs"
      FROM "SupportPurchase"
      WHERE id = $1
      LIMIT 1
    `,
    [input.purchaseId],
  );
  const purchase = purchaseRes.rows[0];
  if (!purchase || purchase.tenantId !== input.tenantId) {
    throw new Error('Compra de soporte no encontrada');
  }
  if (purchase.paymentMethod !== 'MERCADOPAGO') {
    throw new Error('Esta compra no es de Mercado Pago');
  }

  const payment = await getMercadoPagoPayment(input.paymentId);
  const refs = [payment.externalReference, String((payment.metadata as any)?.supportPurchaseId ?? '')];
  const hasPurchaseRef = refs.some((value) => value === `SUPPORT:${input.purchaseId}` || value === input.purchaseId);
  if (!hasPurchaseRef) {
    throw new Error('El pago no corresponde a esta compra de soporte');
  }

  const approved = payment.status === 'approved';
  await db.query(
    `
      UPDATE "SupportPurchase"
      SET
        "mercadoPagoPaymentId" = $1,
        "mercadoPagoStatus" = $2,
        status = CASE WHEN $3 THEN 'PAID' ELSE status END,
        "paidAt" = CASE WHEN $3 THEN NOW() ELSE "paidAt" END,
        "updatedAt" = NOW()
      WHERE id = $4
    `,
    [payment.id, payment.status, approved, input.purchaseId],
  );

  return {
    purchaseId: input.purchaseId,
    approved,
    mercadoPagoStatus: payment.status,
  };
}

export async function saveSupportSummary(input: {
  userId: string;
  tenantId: string;
  purchaseId: string;
  businessContext?: string | null;
  need?: string | null;
  goal?: string | null;
  notes?: string | null;
}) {
  await ensureSupportTables();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');

  const need = normalizeText(input.need);
  const goal = normalizeText(input.goal);
  if (!need || !goal) {
    throw new Error('Completá al menos necesidad y objetivo');
  }

  const result = await db.query<{ id: string; status: SupportPurchaseStatus }>(
    `
      UPDATE "SupportPurchase"
      SET
        "summaryBusinessContext" = $1,
        "summaryNeed" = $2,
        "summaryGoal" = $3,
        "summaryNotes" = $4,
        "updatedAt" = NOW()
      WHERE id = $5
        AND "tenantId" = $6
      RETURNING id, status
    `,
    [normalizeText(input.businessContext), need, goal, normalizeText(input.notes), input.purchaseId, input.tenantId],
  );

  if (!result.rows[0]) {
    throw new Error('Compra no encontrada');
  }

  return result.rows[0];
}

export async function listSupportPurchasesForAdmin() {
  await ensureSupportTables();
  const rows = await db.query<{
    id: string;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    userId: string;
    userEmail: string;
    userFullName: string | null;
    contactName: string;
    contactPhone: string;
    packageCode: string;
    packageLabel: string;
    hoursQty: number;
    amountArs: number;
    paymentMethod: SupportPaymentMethod;
    status: SupportPurchaseStatus;
    cbu: string | null;
    checkoutUrl: string | null;
    mercadoPagoPreferenceId: string | null;
    mercadoPagoPaymentId: string | null;
    mercadoPagoStatus: string | null;
    summaryBusinessContext: string | null;
    summaryNeed: string | null;
    summaryGoal: string | null;
    summaryNotes: string | null;
    serviceStatus: SupportServiceStatus;
    serviceCompletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    paidAt: Date | null;
  }>(
    `
      SELECT
        sp.id,
        sp."tenantId",
        t.name as "tenantName",
        t.slug as "tenantSlug",
        sp."userId",
        u.email as "userEmail",
        u."fullName" as "userFullName",
        sp."contactName",
        sp."contactPhone",
        sp."packageCode",
        sp."packageLabel",
        sp."hoursQty",
        sp."amountArs",
        sp."paymentMethod",
        sp.status,
        sp.cbu,
        sp."checkoutUrl",
        sp."mercadoPagoPreferenceId",
        sp."mercadoPagoPaymentId",
        sp."mercadoPagoStatus",
        sp."summaryBusinessContext",
        sp."summaryNeed",
        sp."summaryGoal",
        sp."summaryNotes",
        sp."serviceStatus",
        sp."serviceCompletedAt",
        sp."createdAt",
        sp."updatedAt",
        sp."paidAt"
      FROM "SupportPurchase" sp
      INNER JOIN "Tenant" t ON t.id = sp."tenantId"
      INNER JOIN "User" u ON u.id = sp."userId"
      ORDER BY sp."createdAt" DESC
      LIMIT 300
    `,
  );

  return rows.rows.map((row) => ({
    ...row,
    hoursQty: Number(row.hoursQty),
    amountArs: Number(row.amountArs),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    serviceCompletedAt: row.serviceCompletedAt ? row.serviceCompletedAt.toISOString() : null,
    summaryCompleted: Boolean(row.summaryNeed && row.summaryGoal),
  }));
}

export async function confirmSupportTransferById(purchaseId: string) {
  await ensureSupportTables();
  const result = await db.query<{ id: string }>(
    `
      UPDATE "SupportPurchase"
      SET
        status = 'PAID',
        "paidAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = $1
        AND "paymentMethod" = 'TRANSFER'
      RETURNING id
    `,
    [purchaseId],
  );
  return result.rows[0] ?? null;
}

export async function completeSupportServiceById(purchaseId: string) {
  await ensureSupportTables();
  const result = await db.query<{ id: string }>(
    `
      UPDATE "SupportPurchase"
      SET
        "serviceStatus" = 'DONE',
        "serviceCompletedAt" = NOW(),
        "updatedAt" = NOW()
      WHERE id = $1
        AND status = 'PAID'
        AND "serviceStatus" <> 'DONE'
      RETURNING id
    `,
    [purchaseId],
  );
  return result.rows[0] ?? null;
}
