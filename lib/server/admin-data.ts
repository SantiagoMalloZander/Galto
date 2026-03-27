import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db } from './db';
import {
  createMercadoPagoPreapproval,
  createMercadoPagoPreference,
  getMercadoPagoPreapproval,
  getMercadoPagoPayment,
  getMercadoPagoPublicKey,
  hasMercadoPagoConfig,
  isMercadoPagoRecurrenceEnabled,
} from './mercadopago';
import { ensureAppointmentLineServiceFkDeleteSetNull } from './schema-fixes';

export const TRANSFER_CBU = '0000003100056449349068';

export type PlanType = 'DEMO' | 'PAID_FULL';
export type PaymentRequestStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';
export type PaymentProvider = 'TRANSFER' | 'MERCADOPAGO';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export type AccountAccessSnapshot = {
  mode: PlanType;
  isPaid: boolean;
  demoEndsAt: string | null;
  enabledApps: string[];
  planName: string;
  hasChosenPlan: boolean;
  paymentStatus: 'NONE' | 'PENDING' | 'CONFIRMED';
};

export const ALL_APPS = [
  'reservas',
  'calendario',
  'cuentas',
  'clientes',
  'lead_finder',
  'dashboard',
  'puntos',
  'recompensas',
  'contenido',
] as const;
export const FREE_APPS = ['reservas', 'calendario', 'cuentas', 'clientes'] as const;

export interface TenantPlan {
  tenantId: string;
  planType: PlanType;
  isPaid: boolean;
  enabledApps: string[];
  demoEndsAt: string | null;
  paidBranchSlots: number;
  updatedAt: string;
}

export interface UserMembershipView {
  membershipId: string;
  role: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  plan: TenantPlan;
}

export interface AdminTenantMemberView {
  membershipId: string;
  role: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
  userId: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  branchAccessCount: number;
}

export interface AdminTenantView {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  plan: TenantPlan;
  members: AdminTenantMemberView[];
}

export interface AdminUserView {
  id: string;
  email: string;
  fullName: string | null;
  passwordHash: string | null;
  createdAt: string;
  memberships: UserMembershipView[];
}

export interface PaymentRequestView {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  requestedByUserId: string;
  requestedByEmail: string;
  planType: PlanType;
  selectedApps: string[];
  purpose: 'PLAN' | 'ADD_BRANCH';
  branchSlotsQty: number;
  status: PaymentRequestStatus;
  provider: PaymentProvider;
  billingCycle: BillingCycle;
  cbu: string;
  checkoutUrl: string | null;
  mercadoPagoPreferenceId: string | null;
  mercadoPagoPaymentId: string | null;
  mercadoPagoStatus: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

const PLAN_TYPES: PlanType[] = ['DEMO', 'PAID_FULL'];

function getPublicBaseUrl() {
  return (process.env.BILLING_PUBLIC_BASE_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://galto.online').replace(/\/+$/, '');
}

function getEnabledAppsForPlan(planType: PlanType, selectedApps?: unknown): string[] {
  if (planType === 'DEMO') {
    return [...FREE_APPS];
  }
  return [...ALL_APPS];
}

function getPlanFirstPaymentAmountArs(
  billingCycle: BillingCycle,
  branchCount = 1,
) {
  const professionalMonthly = Number(process.env.PLAN_PROFESSIONAL_MONTHLY_ARS ?? 28000);
  const unitMonthly = professionalMonthly;
  const cycleMultiplier = billingCycle === 'ANNUAL' ? 12 : 1;
  const discountMultiplier = billingCycle === 'ANNUAL' ? 0.9 : 1;
  const qty = Math.max(1, Math.floor(Number(branchCount || 1)));
  return Number((unitMonthly * cycleMultiplier * qty * discountMultiplier).toFixed(2));
}

function isMercadoPagoCountryError(error: unknown) {
  const message = String((error as any)?.message ?? '').toLowerCase();
  return message.includes('different countries') || message.includes('cannot operate between different countries');
}

async function createMercadoPagoCheckout(input: {
  externalReference: string;
  title: string;
  reason: string;
  amountArs: number;
  payerEmail?: string | null;
  backUrl: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
  metadata: Record<string, unknown>;
}) {
  if (isMercadoPagoRecurrenceEnabled() && input.payerEmail && input.amountArs >= 15) {
    try {
      const preapproval = await createMercadoPagoPreapproval({
        externalReference: input.externalReference,
        reason: input.reason,
        amountArs: input.amountArs,
        payerEmail: input.payerEmail,
        backUrl: input.backUrl,
      });
      return {
        checkoutUrl: preapproval.initPoint || null,
        preferenceId: preapproval.id || null,
      };
    } catch (error) {
      if (!isMercadoPagoCountryError(error)) {
        throw error;
      }
    }
  }

  try {
    const preference = await createMercadoPagoPreference({
      externalReference: input.externalReference,
      title: input.title,
      amountArs: input.amountArs,
      successUrl: input.successUrl,
      failureUrl: input.failureUrl,
      pendingUrl: input.pendingUrl,
      notificationUrl: input.notificationUrl,
      metadata: input.metadata,
    });
    return {
      checkoutUrl: preference.initPoint || preference.sandboxInitPoint || null,
      preferenceId: preference.id || null,
    };
  } catch (error) {
    if (isMercadoPagoCountryError(error)) {
      throw new Error('Mercado Pago rechazó esta operación por país. Verificá que la cuenta y el cobro estén en el mismo país.');
    }
    throw error;
  }
}

export async function ensureAdminTables() {
  await db.query(`
    ALTER TABLE "Tenant"
    ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ
  `);

  await db.query(`
    ALTER TABLE "CustomerUser"
    ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "AdminTenantPlan" (
      "tenantId" TEXT PRIMARY KEY REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "planType" TEXT NOT NULL DEFAULT 'DEMO',
      "isPaid" BOOLEAN NOT NULL DEFAULT FALSE,
      "enabledApps" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "demoEndsAt" TIMESTAMPTZ,
      "paidBranchSlots" INTEGER NOT NULL DEFAULT 1,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "AdminTenantPlan_planType_check" CHECK ("planType" IN ('DEMO','PAID_FULL'))
    )
  `);
  await db.query(`ALTER TABLE "AdminTenantPlan" ADD COLUMN IF NOT EXISTS "paidBranchSlots" INTEGER NOT NULL DEFAULT 1`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS "PaymentRequest" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "requestedByUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      "planType" TEXT NOT NULL,
      "selectedApps" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "purpose" TEXT NOT NULL DEFAULT 'PLAN',
      "branchSlotsQty" INTEGER NOT NULL DEFAULT 1,
      "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "provider" TEXT NOT NULL DEFAULT 'TRANSFER',
      "cbu" TEXT NOT NULL,
      "checkoutUrl" TEXT,
      "mercadoPagoPreferenceId" TEXT,
      "mercadoPagoPaymentId" TEXT,
      "mercadoPagoStatus" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "confirmedAt" TIMESTAMPTZ,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "PaymentRequest_planType_check" CHECK ("planType" IN ('PAID_FULL')),
      CONSTRAINT "PaymentRequest_purpose_check" CHECK ("purpose" IN ('PLAN','ADD_BRANCH')),
      CONSTRAINT "PaymentRequest_branchSlotsQty_check" CHECK ("branchSlotsQty" >= 1),
      CONSTRAINT "PaymentRequest_billingCycle_check" CHECK ("billingCycle" IN ('MONTHLY','ANNUAL')),
      CONSTRAINT "PaymentRequest_status_check" CHECK ("status" IN ('PENDING','CONFIRMED','REJECTED')),
      CONSTRAINT "PaymentRequest_provider_check" CHECK ("provider" IN ('TRANSFER','MERCADOPAGO'))
    )
  `);

  await db.query(`ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'TRANSFER'`);
  await db.query(`ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'PLAN'`);
  await db.query(`ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "branchSlotsQty" INTEGER NOT NULL DEFAULT 1`);
  await db.query(`ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY'`);
  await db.query(`ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "checkoutUrl" TEXT`);
  await db.query(`ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "mercadoPagoPreferenceId" TEXT`);
  await db.query(`ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "mercadoPagoPaymentId" TEXT`);
  await db.query(`ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "mercadoPagoStatus" TEXT`);
  await db.query(`ALTER TABLE "PaymentRequest" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
  await db.query('CREATE INDEX IF NOT EXISTS "PaymentRequest_tenant_status_idx" ON "PaymentRequest" ("tenantId", "status")');

  // Migración de compatibilidad: el plan estándar fue removido y se normaliza a Profesional.
  await db.query(
    `
      UPDATE "AdminTenantPlan"
      SET
        "planType" = 'PAID_FULL',
        "enabledApps" = $1::jsonb,
        "demoEndsAt" = NULL,
        "updatedAt" = NOW()
      WHERE "planType" = 'PAID_CUSTOM'
    `,
    [JSON.stringify([...ALL_APPS])],
  );
  await db.query(
    `
      UPDATE "PaymentRequest"
      SET
        "planType" = 'PAID_FULL',
        "selectedApps" = $1::jsonb,
        "updatedAt" = NOW()
      WHERE "planType" = 'PAID_CUSTOM'
    `,
    [JSON.stringify([...ALL_APPS])],
  );

  // Compatibilidad histórica: si un tenant ya tiene más de una sucursal, lo marcamos como FULL pago.
  await db.query(
    `
      INSERT INTO "AdminTenantPlan" ("tenantId", "planType", "isPaid", "enabledApps", "demoEndsAt", "paidBranchSlots", "updatedAt")
      SELECT
        t.id,
        'PAID_FULL',
        TRUE,
        $1::jsonb,
        NULL,
        (
          SELECT COUNT(*)
          FROM "Branch" b
          WHERE b."tenantId" = t.id
        )::integer,
        NOW()
      FROM "Tenant" t
      WHERE t."archivedAt" IS NULL
        AND (
          SELECT COUNT(*)
          FROM "Branch" b
          WHERE b."tenantId" = t.id
        ) > 1
        AND NOT EXISTS (
          SELECT 1
          FROM "AdminTenantPlan" p
          WHERE p."tenantId" = t.id
        )
    `,
    [JSON.stringify([...ALL_APPS])],
  );

  await db.query(
    `
      UPDATE "AdminTenantPlan" p
      SET
        "planType" = 'PAID_FULL',
        "isPaid" = TRUE,
        "enabledApps" = $1::jsonb,
        "demoEndsAt" = NULL,
        "paidBranchSlots" = GREATEST(p."paidBranchSlots", multi."branchCount"),
        "updatedAt" = NOW()
      FROM (
        SELECT
          t.id,
          (
            SELECT COUNT(*)
            FROM "Branch" b
            WHERE b."tenantId" = t.id
          )::integer AS "branchCount"
        FROM "Tenant" t
        WHERE t."archivedAt" IS NULL
          AND (
            SELECT COUNT(*)
            FROM "Branch" b
            WHERE b."tenantId" = t.id
          ) > 1
      ) multi
      WHERE p."tenantId" = multi.id
        AND (p."planType" <> 'PAID_FULL' OR p."isPaid" = FALSE)
    `,
    [JSON.stringify([...ALL_APPS])],
  );

  await db.query(
    `
      UPDATE "AdminTenantPlan"
      SET
        "enabledApps" = $1::jsonb,
        "demoEndsAt" = NULL,
        "updatedAt" = NOW()
      WHERE "planType" = 'DEMO'
        AND (
          "demoEndsAt" IS NOT NULL
          OR COALESCE("enabledApps", '[]'::jsonb) <> $1::jsonb
        )
    `,
    [JSON.stringify([...FREE_APPS])],
  );
}

async function getTenantBranchCount(tenantId: string) {
  const branchRes = await db.query<{ total: string }>(
    `
      SELECT COUNT(*)::text AS total
      FROM "Branch"
      WHERE "tenantId" = $1
    `,
    [tenantId],
  );
  return Number(branchRes.rows[0]?.total ?? 0);
}

export async function listUsersWithMemberships(): Promise<AdminUserView[]> {
  await ensureAdminTables();

  const { rows } = await db.query<{
    id: string;
    email: string;
    fullName: string | null;
    passwordHash: string | null;
    createdAt: Date;
    memberships: UserMembershipView[] | null;
  }>(`
    SELECT
      u.id,
      u.email,
      u."fullName",
      u."passwordHash",
      u."createdAt",
      COALESCE((
        SELECT json_agg(json_build_object(
          'membershipId', m.id,
          'role', m.role,
          'tenantId', t.id,
          'tenantSlug', t.slug,
          'tenantName', t.name,
          'plan', json_build_object(
            'tenantId', t.id,
            'planType', COALESCE(p."planType", 'DEMO'),
            'isPaid', COALESCE(p."isPaid", false),
            'enabledApps', COALESCE(p."enabledApps", '[]'::jsonb),
            'demoEndsAt', p."demoEndsAt",
            'paidBranchSlots', COALESCE(p."paidBranchSlots", 1),
            'updatedAt', COALESCE(p."updatedAt", NOW())
          )
        ) ORDER BY m."createdAt" DESC)
        FROM "Membership" m
        INNER JOIN "Tenant" t ON t.id = m."tenantId"
        LEFT JOIN "AdminTenantPlan" p ON p."tenantId" = t.id
        WHERE m."userId" = u.id
      ), '[]'::json) AS memberships
    FROM "User" u
    ORDER BY u."createdAt" DESC
    LIMIT 1000
  `);

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt.toISOString(),
    memberships: Array.isArray(row.memberships) ? row.memberships : [],
  }));
}

export async function listTenantsWithMembers(): Promise<AdminTenantView[]> {
  await ensureAdminTables();

  const { rows } = await db.query<{
    tenantId: string;
    tenantSlug: string;
    tenantName: string;
    plan: TenantPlan;
    members: AdminTenantMemberView[] | null;
  }>(`
    SELECT
      t.id as "tenantId",
      t.slug as "tenantSlug",
      t.name as "tenantName",
      json_build_object(
        'tenantId', t.id,
        'planType', COALESCE(p."planType", 'DEMO'),
        'isPaid', COALESCE(p."isPaid", false),
        'enabledApps', COALESCE(p."enabledApps", '[]'::jsonb),
        'demoEndsAt', p."demoEndsAt",
        'paidBranchSlots', COALESCE(p."paidBranchSlots", 1),
        'updatedAt', COALESCE(p."updatedAt", NOW())
      ) as plan,
      COALESCE((
        SELECT json_agg(json_build_object(
          'membershipId', m.id,
          'role', m.role,
          'userId', u.id,
          'email', u.email,
          'fullName', u."fullName",
          'createdAt', m."createdAt",
          'branchAccessCount', (
            SELECT COUNT(*)
            FROM "BranchAccess" ba
            WHERE ba."membershipId" = m.id
          )
        ) ORDER BY
          CASE m.role WHEN 'OWNER' THEN 1 WHEN 'MANAGER' THEN 2 ELSE 3 END,
          u.email ASC
        )
        FROM "Membership" m
        INNER JOIN "User" u ON u.id = m."userId"
        WHERE m."tenantId" = t.id
      ), '[]'::json) as members
    FROM "Tenant" t
    LEFT JOIN "AdminTenantPlan" p ON p."tenantId" = t.id
    WHERE t."archivedAt" IS NULL
    ORDER BY t.name ASC
    LIMIT 1000
  `);

  return rows.map((row) => ({
    tenantId: row.tenantId,
    tenantSlug: row.tenantSlug,
    tenantName: row.tenantName,
    plan: serializeTenantPlan(row.plan),
    members: Array.isArray(row.members)
      ? row.members.map((member) => ({
          ...member,
          createdAt: new Date(member.createdAt).toISOString(),
          branchAccessCount: Number(member.branchAccessCount ?? 0),
        }))
      : [],
  }));
}

export async function listPendingPaymentRequests(): Promise<PaymentRequestView[]> {
  await ensureAdminTables();

  const { rows } = await db.query<{
    id: string;
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    requestedByUserId: string;
    requestedByEmail: string;
    planType: PlanType;
    selectedApps: string[];
    purpose: 'PLAN' | 'ADD_BRANCH';
    branchSlotsQty: number;
    status: PaymentRequestStatus;
    provider: PaymentProvider;
    billingCycle: BillingCycle;
    cbu: string;
    checkoutUrl: string | null;
    mercadoPagoPreferenceId: string | null;
    mercadoPagoPaymentId: string | null;
    mercadoPagoStatus: string | null;
    createdAt: Date;
    confirmedAt: Date | null;
  }>(`
    SELECT
      pr.id,
      pr."tenantId",
      t.name as "tenantName",
      t.slug as "tenantSlug",
      pr."requestedByUserId",
      u.email as "requestedByEmail",
      pr."planType",
      pr."selectedApps",
      pr.purpose,
      pr."branchSlotsQty",
      pr.status,
      pr.provider,
      pr."billingCycle",
      pr.cbu,
      pr."checkoutUrl",
      pr."mercadoPagoPreferenceId",
      pr."mercadoPagoPaymentId",
      pr."mercadoPagoStatus",
      pr."createdAt",
      pr."confirmedAt"
    FROM "PaymentRequest" pr
    INNER JOIN "Tenant" t ON t.id = pr."tenantId"
    INNER JOIN "User" u ON u.id = pr."requestedByUserId"
    WHERE pr.status = 'PENDING'
    ORDER BY pr."createdAt" DESC
  `);

  return rows.map((row) => ({
    ...row,
    selectedApps: Array.isArray(row.selectedApps) ? row.selectedApps : [],
    purpose: row.purpose === 'ADD_BRANCH' ? 'ADD_BRANCH' : 'PLAN',
    branchSlotsQty: Math.max(1, Number(row.branchSlotsQty ?? 1)),
    provider: row.provider === 'MERCADOPAGO' ? 'MERCADOPAGO' : 'TRANSFER',
    billingCycle: row.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
    checkoutUrl: row.checkoutUrl,
    mercadoPagoPreferenceId: row.mercadoPagoPreferenceId,
    mercadoPagoPaymentId: row.mercadoPagoPaymentId,
    mercadoPagoStatus: row.mercadoPagoStatus,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
  }));
}

export async function confirmPaymentRequest(requestId: string) {
  await ensureAdminTables();
  await db.query('BEGIN');
  try {
    const reqResult = await db.query<{
      id: string;
      tenantId: string;
      planType: PlanType;
      selectedApps: string[];
      purpose: 'PLAN' | 'ADD_BRANCH';
      branchSlotsQty: number;
      status: PaymentRequestStatus;
    }>(
      `SELECT id, "tenantId", "planType", "selectedApps", purpose, "branchSlotsQty", status FROM "PaymentRequest" WHERE id = $1 FOR UPDATE`,
      [requestId],
    );

    const request = reqResult.rows[0];
    if (!request || request.status !== 'PENDING') {
      await db.query('ROLLBACK');
      return null;
    }

    const enabledApps = getEnabledAppsForPlan(request.planType, request.selectedApps);

    await db.query(
      `
        UPDATE "PaymentRequest"
        SET status = 'CONFIRMED',
            "confirmedAt" = NOW(),
            "updatedAt" = NOW()
        WHERE id = $1
      `,
      [requestId],
    );

    const currentPlanRes = await db.query<{ paidBranchSlots: number }>(
      `SELECT COALESCE("paidBranchSlots", 1) AS "paidBranchSlots" FROM "AdminTenantPlan" WHERE "tenantId" = $1 LIMIT 1`,
      [request.tenantId],
    );
    const currentSlots = Math.max(1, Number(currentPlanRes.rows[0]?.paidBranchSlots ?? 1));
    const nextSlots =
      request.purpose === 'ADD_BRANCH'
        ? currentSlots + Math.max(1, Number(request.branchSlotsQty ?? 1))
        : Math.max(1, Number(request.branchSlotsQty ?? 1));

    await upsertTenantPlan({
      tenantId: request.tenantId,
      planType: request.planType,
      isPaid: true,
      enabledApps,
      demoEndsAt: null,
      paidBranchSlots: nextSlots,
    });

    await db.query('COMMIT');
    return { tenantId: request.tenantId, planType: request.planType };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function updateUserPassword(userId: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.query(
    `
      UPDATE "User"
      SET "passwordHash" = $1,
          "updatedAt" = NOW()
      WHERE id = $2
      RETURNING id, email
    `,
    [passwordHash, userId],
  );

  return result.rows[0] ?? null;
}

export async function updateMembershipRole(membershipId: string, role: 'OWNER' | 'MANAGER' | 'EMPLOYEE') {
  await db.query('BEGIN');
  try {
    const membershipRes = await db.query<{ id: string; tenantId: string; role: 'OWNER' | 'MANAGER' | 'EMPLOYEE' }>(
      `
        SELECT id, "tenantId", role
        FROM "Membership"
        WHERE id = $1
        FOR UPDATE
      `,
      [membershipId],
    );

    const membership = membershipRes.rows[0];
    if (!membership) {
      await db.query('ROLLBACK');
      return null;
    }

    if (membership.role === 'OWNER' && role !== 'OWNER') {
      const ownersRes = await db.query<{ total: string }>(
        `
          SELECT COUNT(*)::text as total
          FROM "Membership"
          WHERE "tenantId" = $1 AND role = 'OWNER'
        `,
        [membership.tenantId],
      );
      const ownersTotal = Number(ownersRes.rows[0]?.total ?? '0');
      if (ownersTotal <= 1) {
        throw new Error('No podés remover el último OWNER del negocio');
      }
    }

    const updatedRes = await db.query<{ id: string; tenantId: string; role: 'OWNER' | 'MANAGER' | 'EMPLOYEE' }>(
      `
        UPDATE "Membership"
        SET role = $1,
            "updatedAt" = NOW()
        WHERE id = $2
        RETURNING id, "tenantId", role
      `,
      [role, membershipId],
    );

    await db.query('COMMIT');
    return updatedRes.rows[0] ?? null;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function upsertTenantPlan(input: {
  tenantId: string;
  planType: PlanType;
  isPaid: boolean;
  enabledApps: string[];
  demoEndsAt: string | null;
  paidBranchSlots?: number;
}) {
  await ensureAdminTables();

  if (!PLAN_TYPES.includes(input.planType)) {
    throw new Error('Plan inválido');
  }

  const result = await db.query(
    `
      INSERT INTO "AdminTenantPlan" ("tenantId", "planType", "isPaid", "enabledApps", "demoEndsAt", "paidBranchSlots", "updatedAt")
      VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW())
      ON CONFLICT ("tenantId") DO UPDATE
      SET "planType" = EXCLUDED."planType",
          "isPaid" = EXCLUDED."isPaid",
          "enabledApps" = EXCLUDED."enabledApps",
          "demoEndsAt" = EXCLUDED."demoEndsAt",
          "paidBranchSlots" = EXCLUDED."paidBranchSlots",
          "updatedAt" = NOW()
      RETURNING "tenantId", "planType", "isPaid", "enabledApps", "demoEndsAt", "paidBranchSlots", "updatedAt"
    `,
    [
      input.tenantId,
      input.planType,
      input.isPaid,
      JSON.stringify(getEnabledAppsForPlan(input.planType, input.enabledApps)),
      input.demoEndsAt,
      Math.max(1, Math.floor(Number(input.paidBranchSlots ?? 1))),
    ],
  );

  return serializeTenantPlan(result.rows[0]);
}

export async function startDemoForTenant(tenantId: string) {
  const branchCount = await getTenantBranchCount(tenantId);
  if (branchCount > 1) {
    throw new Error('Con más de una sucursal, este negocio requiere plan profesional pago.');
  }

  return upsertTenantPlan({
    tenantId,
    planType: 'DEMO',
    isPaid: false,
    enabledApps: [...FREE_APPS],
    demoEndsAt: null,
    paidBranchSlots: 1,
  });
}

export async function createPaymentRequest(input: {
  tenantId: string;
  requestedByUserId: string;
  planType: 'PAID_FULL';
  selectedApps: string[];
  billingCycle?: BillingCycle;
  preferredProvider?: PaymentProvider;
  purpose?: 'PLAN' | 'ADD_BRANCH';
  branchSlotsQty?: number;
}) {
  await ensureAdminTables();
  const branchCount = await getTenantBranchCount(input.tenantId);
  const purpose: 'PLAN' | 'ADD_BRANCH' = input.purpose === 'ADD_BRANCH' ? 'ADD_BRANCH' : 'PLAN';
  const branchSlotsQty = Math.max(1, Math.floor(Number(input.branchSlotsQty ?? 1)));
  if (purpose === 'ADD_BRANCH') {
    const planRes = await db.query<{ planType: PlanType; isPaid: boolean }>(
      `SELECT "planType", "isPaid" FROM "AdminTenantPlan" WHERE "tenantId" = $1 LIMIT 1`,
      [input.tenantId],
    );
    const plan = planRes.rows[0];
    if (!plan || plan.planType !== 'PAID_FULL' || !plan.isPaid) {
      throw new Error('Primero activá el Plan Profesional para poder agregar sucursales.');
    }
  }

  const billingCycle: BillingCycle = input.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
  const selectedApps = getEnabledAppsForPlan(input.planType, input.selectedApps);
  const canUseMp = hasMercadoPagoConfig();
  const provider: PaymentProvider =
    input.preferredProvider === 'TRANSFER'
      ? 'TRANSFER'
      : canUseMp
        ? 'MERCADOPAGO'
        : 'TRANSFER';

  const existing = await db.query<{
    id: string;
    planType: PlanType;
    selectedApps: string[];
    purpose: 'PLAN' | 'ADD_BRANCH';
    branchSlotsQty: number;
    provider: PaymentProvider;
    billingCycle: BillingCycle;
    cbu: string;
    checkoutUrl: string | null;
  }>(
    `
      SELECT id, "planType", "selectedApps", purpose, "branchSlotsQty", provider, "billingCycle", cbu, "checkoutUrl"
      FROM "PaymentRequest"
      WHERE "tenantId" = $1 AND status = 'PENDING'
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
    [input.tenantId],
  );

  if (existing.rows[0]) {
    let existingCheckoutUrl = existing.rows[0].checkoutUrl;
    let existingProvider: PaymentProvider = existing.rows[0].provider === 'MERCADOPAGO' ? 'MERCADOPAGO' : 'TRANSFER';
    let existingBillingCycle: BillingCycle = existing.rows[0].billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';

    await db.query(
      `
        UPDATE "PaymentRequest"
        SET "planType" = $1,
            "selectedApps" = $2::jsonb,
            purpose = $3,
            "branchSlotsQty" = $4,
            "billingCycle" = $5,
            provider = $6,
            "checkoutUrl" = CASE WHEN $6 = 'TRANSFER' THEN NULL ELSE "checkoutUrl" END,
            "updatedAt" = NOW()
        WHERE id = $7
      `,
      [input.planType, JSON.stringify(selectedApps), purpose, branchSlotsQty, billingCycle, provider, existing.rows[0].id],
    );
    existingProvider = provider;
    existingBillingCycle = billingCycle;
    if (existingProvider === 'TRANSFER') {
      existingCheckoutUrl = null;
    }
    const looksSandbox = Boolean(existingCheckoutUrl && /(sandbox|beta-sandbox|test_user)/i.test(existingCheckoutUrl));
    const looksLegacyPreference = Boolean(existingCheckoutUrl && /pref_id=/i.test(existingCheckoutUrl));
    const shouldForceRecurrenceRefresh = Boolean(isMercadoPagoRecurrenceEnabled() && looksLegacyPreference);

    if (provider === 'MERCADOPAGO' && hasMercadoPagoConfig() && (!existingCheckoutUrl || looksSandbox || shouldForceRecurrenceRefresh)) {
      const tenantRes = await db.query<{ slug: string; name: string }>(
        `SELECT slug, name FROM "Tenant" WHERE id = $1 LIMIT 1`,
        [input.tenantId],
      );
      const tenant = tenantRes.rows[0];
      const userRes = await db.query<{ email: string }>(`SELECT email FROM "User" WHERE id = $1 LIMIT 1`, [
        input.requestedByUserId,
      ]);
      const payerEmail = userRes.rows[0]?.email;
      const requestPlanType = 'PAID_FULL';
      const planLabel = 'Plan Profesional';
      const amountArs = getPlanFirstPaymentAmountArs(
        existingBillingCycle,
        purpose === 'ADD_BRANCH' ? branchSlotsQty : Math.max(1, branchCount),
      );
      const appBase = getPublicBaseUrl();
      const checkout = await createMercadoPagoCheckout({
        externalReference: existing.rows[0].id,
        reason:
          purpose === 'ADD_BRANCH'
            ? `Galto - ${planLabel} +${branchSlotsQty} sucursal(es) (${tenant?.name ?? input.tenantId})`
            : `Galto - ${planLabel} (${tenant?.name ?? input.tenantId})`,
        title:
          purpose === 'ADD_BRANCH'
            ? `Galto - Agregar ${branchSlotsQty} sucursal(es)`
            : `Galto - ${planLabel} (${tenant?.name ?? input.tenantId})`,
        amountArs,
        payerEmail,
        backUrl: `${appBase}/app/planes`,
        successUrl: `${appBase}/app/planes?mp_status=success`,
        failureUrl: `${appBase}/app/planes?mp_status=failure`,
        pendingUrl: `${appBase}/app/planes?mp_status=pending`,
        notificationUrl: `${appBase}/api/billing/mercadopago/webhook`,
        metadata: {
          paymentRequestId: existing.rows[0].id,
          tenantId: input.tenantId,
          tenantSlug: tenant?.slug ?? null,
          planType: requestPlanType,
          purpose,
          branchSlotsQty,
        },
      });

      existingCheckoutUrl = checkout.checkoutUrl;
      existingProvider = 'MERCADOPAGO';

      await db.query(
        `
          UPDATE "PaymentRequest"
          SET provider = 'MERCADOPAGO',
              "mercadoPagoPreferenceId" = $1,
              "checkoutUrl" = $2,
              "updatedAt" = NOW()
          WHERE id = $3
        `,
        [checkout.preferenceId, existingCheckoutUrl, existing.rows[0].id],
      );
    }

    return {
      id: existing.rows[0].id,
      provider: existingProvider,
      cbu: existing.rows[0].cbu,
      checkoutUrl: existingCheckoutUrl,
      status: 'PENDING' as const,
      purpose,
      branchSlotsQty,
      publicKey: getMercadoPagoPublicKey(),
    };
  }

  const id = crypto.randomUUID();
  await db.query(
    `
      INSERT INTO "PaymentRequest" (
        id,
        "tenantId",
        "requestedByUserId",
        "planType",
        "selectedApps",
        purpose,
        "branchSlotsQty",
        "billingCycle",
        status,
        provider,
        cbu
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, 'PENDING', $9, $10)
    `,
    [
      id,
      input.tenantId,
      input.requestedByUserId,
      input.planType,
      JSON.stringify(selectedApps),
      purpose,
      branchSlotsQty,
      billingCycle,
      provider,
      TRANSFER_CBU,
    ],
  );

  await upsertTenantPlan({
    tenantId: input.tenantId,
    planType: input.planType,
    isPaid: false,
    enabledApps: selectedApps,
    demoEndsAt: null,
    paidBranchSlots: Math.max(1, branchCount),
  });

  let checkoutUrl: string | null = null;

  if (provider === 'MERCADOPAGO') {
    const tenantRes = await db.query<{ slug: string; name: string }>(
      `SELECT slug, name FROM "Tenant" WHERE id = $1 LIMIT 1`,
      [input.tenantId],
    );
    const userRes = await db.query<{ email: string }>(`SELECT email FROM "User" WHERE id = $1 LIMIT 1`, [
      input.requestedByUserId,
    ]);
    const payerEmail = userRes.rows[0]?.email;
    const tenant = tenantRes.rows[0];
    const appBase = getPublicBaseUrl();
    const planLabel = 'Plan Profesional';
    const amountArs = getPlanFirstPaymentAmountArs(
      billingCycle,
      purpose === 'ADD_BRANCH' ? branchSlotsQty : Math.max(1, branchCount),
    );
    const checkout = await createMercadoPagoCheckout({
      externalReference: id,
      reason:
        purpose === 'ADD_BRANCH'
          ? `Galto - ${planLabel} +${branchSlotsQty} sucursal(es) (${tenant?.name ?? input.tenantId})`
          : `Galto - ${planLabel} (${tenant?.name ?? input.tenantId})`,
      title:
        purpose === 'ADD_BRANCH'
          ? `Galto - Agregar ${branchSlotsQty} sucursal(es)`
          : `Galto - ${planLabel} (${tenant?.name ?? input.tenantId})`,
      amountArs,
      payerEmail,
      backUrl: `${appBase}/app/planes`,
      successUrl: `${appBase}/app/planes?mp_status=success`,
      failureUrl: `${appBase}/app/planes?mp_status=failure`,
      pendingUrl: `${appBase}/app/planes?mp_status=pending`,
      notificationUrl: `${appBase}/api/billing/mercadopago/webhook`,
      metadata: {
        paymentRequestId: id,
        tenantId: input.tenantId,
        tenantSlug: tenant?.slug ?? null,
        planType: input.planType,
        purpose,
        branchSlotsQty,
      },
    });

    checkoutUrl = checkout.checkoutUrl;

    await db.query(
      `
        UPDATE "PaymentRequest"
        SET "mercadoPagoPreferenceId" = $1,
            "checkoutUrl" = $2,
            "updatedAt" = NOW()
        WHERE id = $3
      `,
      [checkout.preferenceId, checkoutUrl, id],
    );
  }

  return {
    id,
    provider,
    cbu: TRANSFER_CBU,
    checkoutUrl,
    status: 'PENDING' as const,
    purpose,
    branchSlotsQty,
    publicKey: getMercadoPagoPublicKey(),
  };
}

export async function verifyAndApplyMercadoPagoPaymentById(paymentId: string) {
  await ensureAdminTables();

  const payment = await getMercadoPagoPayment(paymentId);
  const externalReference = payment.externalReference || String(payment.metadata?.paymentRequestId ?? '');
  if (!externalReference) {
    throw new Error('Mercado Pago no devolvió referencia de solicitud');
  }

  await db.query('BEGIN');
  try {
    const reqRes = await db.query<{
      id: string;
      tenantId: string;
      planType: PlanType;
      selectedApps: string[];
      purpose: 'PLAN' | 'ADD_BRANCH';
      branchSlotsQty: number;
      status: PaymentRequestStatus;
    }>(
      `
        SELECT id, "tenantId", "planType", "selectedApps", purpose, "branchSlotsQty", status
        FROM "PaymentRequest"
        WHERE id = $1
        FOR UPDATE
      `,
      [externalReference],
    );

    const request = reqRes.rows[0];
    if (!request) {
      await db.query('ROLLBACK');
      throw new Error('Solicitud de pago no encontrada');
    }

    await db.query(
      `
        UPDATE "PaymentRequest"
        SET "mercadoPagoPaymentId" = $1,
            "mercadoPagoStatus" = $2,
            provider = 'MERCADOPAGO',
            "updatedAt" = NOW()
        WHERE id = $3
      `,
      [payment.id, payment.status, request.id],
    );

    if (payment.status === 'approved' && request.status === 'PENDING') {
      const enabledApps = getEnabledAppsForPlan(request.planType, request.selectedApps);

      await db.query(
        `
          UPDATE "PaymentRequest"
          SET status = 'CONFIRMED',
              "confirmedAt" = NOW(),
              "updatedAt" = NOW()
          WHERE id = $1
        `,
        [request.id],
      );

      await upsertTenantPlan({
        tenantId: request.tenantId,
        planType: request.planType,
        isPaid: true,
        enabledApps,
        demoEndsAt: null,
        paidBranchSlots:
          request.purpose === 'ADD_BRANCH'
            ? Math.max(
                1,
                Number(
                  (
                    await db.query<{ paidBranchSlots: number }>(
                      `SELECT COALESCE("paidBranchSlots", 1) AS "paidBranchSlots" FROM "AdminTenantPlan" WHERE "tenantId" = $1 LIMIT 1`,
                      [request.tenantId],
                    )
                  ).rows[0]?.paidBranchSlots ?? 1,
                ),
              ) + Math.max(1, Number(request.branchSlotsQty ?? 1))
            : Math.max(1, Number(request.branchSlotsQty ?? 1)),
      });
    }

    await db.query('COMMIT');
    return {
      requestId: request.id,
      status: payment.status,
      applied: payment.status === 'approved',
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function verifyAndApplyMercadoPagoPreapprovalById(preapprovalId: string) {
  await ensureAdminTables();

  const preapproval = await getMercadoPagoPreapproval(preapprovalId);
  const externalReference = preapproval.externalReference;
  if (!externalReference) {
    throw new Error('Mercado Pago no devolvió referencia de solicitud');
  }

  await db.query('BEGIN');
  try {
    const reqRes = await db.query<{
      id: string;
      tenantId: string;
      planType: PlanType;
      selectedApps: string[];
      purpose: 'PLAN' | 'ADD_BRANCH';
      branchSlotsQty: number;
      status: PaymentRequestStatus;
    }>(
      `
        SELECT id, "tenantId", "planType", "selectedApps", purpose, "branchSlotsQty", status
        FROM "PaymentRequest"
        WHERE id = $1
        FOR UPDATE
      `,
      [externalReference],
    );

    const request = reqRes.rows[0];
    if (!request) {
      await db.query('ROLLBACK');
      throw new Error('Solicitud de pago no encontrada');
    }

    await db.query(
      `
        UPDATE "PaymentRequest"
        SET "mercadoPagoPaymentId" = $1,
            "mercadoPagoStatus" = $2,
            provider = 'MERCADOPAGO',
            "updatedAt" = NOW()
        WHERE id = $3
      `,
      [preapproval.id, preapproval.status, request.id],
    );

    if ((preapproval.status === 'authorized' || preapproval.status === 'active') && request.status === 'PENDING') {
      const enabledApps = getEnabledAppsForPlan(request.planType, request.selectedApps);

      await db.query(
        `
          UPDATE "PaymentRequest"
          SET status = 'CONFIRMED',
              "confirmedAt" = NOW(),
              "updatedAt" = NOW()
          WHERE id = $1
        `,
        [request.id],
      );

      await upsertTenantPlan({
        tenantId: request.tenantId,
        planType: request.planType,
        isPaid: true,
        enabledApps,
        demoEndsAt: null,
        paidBranchSlots:
          request.purpose === 'ADD_BRANCH'
            ? Math.max(
                1,
                Number(
                  (
                    await db.query<{ paidBranchSlots: number }>(
                      `SELECT COALESCE("paidBranchSlots", 1) AS "paidBranchSlots" FROM "AdminTenantPlan" WHERE "tenantId" = $1 LIMIT 1`,
                      [request.tenantId],
                    )
                  ).rows[0]?.paidBranchSlots ?? 1,
                ),
              ) + Math.max(1, Number(request.branchSlotsQty ?? 1))
            : Math.max(1, Number(request.branchSlotsQty ?? 1)),
      });
    }

    await db.query('COMMIT');
    return {
      requestId: request.id,
      status: preapproval.status,
      applied: preapproval.status === 'authorized' || preapproval.status === 'active',
    };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function getTenantBillingStatus(tenantId: string) {
  await ensureAdminTables();
  const branchCount = await getTenantBranchCount(tenantId);
  const requiresPaidFull = branchCount > 1;
  const canUseDemo = branchCount <= 1;

  const planRow = await db.query(
    `
      SELECT "tenantId", "planType", "isPaid", "enabledApps", "demoEndsAt", "paidBranchSlots", "updatedAt"
      FROM "AdminTenantPlan"
      WHERE "tenantId" = $1
      LIMIT 1
    `,
    [tenantId],
  );

  const pendingRow = await db.query<{
    id: string;
    requestedByUserId: string;
    planType: PlanType;
    purpose: 'PLAN' | 'ADD_BRANCH';
    branchSlotsQty: number;
    status: PaymentRequestStatus;
    provider: PaymentProvider;
    billingCycle: BillingCycle;
    cbu: string;
    checkoutUrl: string | null;
    mercadoPagoPreferenceId: string | null;
    mercadoPagoPaymentId: string | null;
    mercadoPagoStatus: string | null;
    selectedApps: string[];
    createdAt: Date;
  }>(
    `
      SELECT id, "requestedByUserId", "planType", purpose, "branchSlotsQty", status, provider, "billingCycle", cbu, "checkoutUrl", "mercadoPagoPreferenceId", "mercadoPagoPaymentId", "mercadoPagoStatus", "selectedApps", "createdAt"
      FROM "PaymentRequest"
      WHERE "tenantId" = $1 AND status = 'PENDING'
      ORDER BY "createdAt" DESC
      LIMIT 1
    `,
    [tenantId],
  );

  const latestConfirmedRes = await db.query<{
    provider: PaymentProvider;
    billingCycle: BillingCycle;
    confirmedAt: Date | null;
    createdAt: Date;
  }>(
    `
      SELECT provider, "billingCycle", "confirmedAt", "createdAt"
      FROM "PaymentRequest"
      WHERE "tenantId" = $1
        AND status = 'CONFIRMED'
      ORDER BY COALESCE("confirmedAt", "createdAt") DESC
      LIMIT 1
    `,
    [tenantId],
  );

  const pending = pendingRow.rows[0];
  if (pending && hasMercadoPagoConfig() && pending.provider === 'MERCADOPAGO') {
    const looksSandbox = Boolean(pending.checkoutUrl && /(sandbox|beta-sandbox|test_user)/i.test(pending.checkoutUrl));
    const looksLegacyPreference = Boolean(pending.checkoutUrl && /pref_id=/i.test(pending.checkoutUrl));
    const shouldForceRecurrenceRefresh = Boolean(isMercadoPagoRecurrenceEnabled() && looksLegacyPreference);
    const missingCheckout = !pending.checkoutUrl;
    if (looksSandbox || missingCheckout || shouldForceRecurrenceRefresh) {
      const tenantRes = await db.query<{ slug: string; name: string }>(
        `SELECT slug, name FROM "Tenant" WHERE id = $1 LIMIT 1`,
        [tenantId],
      );
      const userRes = await db.query<{ email: string }>(
        `SELECT email FROM "User" WHERE id = $1 LIMIT 1`,
        [pending.requestedByUserId],
      );
      const appBase = getPublicBaseUrl();
      const planType = 'PAID_FULL';
      const planLabel = 'Plan Profesional';
      const pendingPurpose = pending.purpose === 'ADD_BRANCH' ? 'ADD_BRANCH' : 'PLAN';
      const pendingSlotsQty = Math.max(1, Number(pending.branchSlotsQty ?? 1));
      const amountArs = getPlanFirstPaymentAmountArs(
        pending.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
        pendingPurpose === 'ADD_BRANCH' ? pendingSlotsQty : Math.max(1, branchCount),
      );
      try {
        const checkout = await createMercadoPagoCheckout({
          externalReference: pending.id,
          reason:
            pendingPurpose === 'ADD_BRANCH'
              ? `Galto - ${planLabel} +${pendingSlotsQty} sucursal(es) (${tenantRes.rows[0]?.name ?? tenantId})`
              : `Galto - ${planLabel} (${tenantRes.rows[0]?.name ?? tenantId})`,
          title:
            pendingPurpose === 'ADD_BRANCH'
              ? `Galto - Agregar ${pendingSlotsQty} sucursal(es)`
              : `Galto - ${planLabel} (${tenantRes.rows[0]?.name ?? tenantId})`,
          amountArs,
          payerEmail: userRes.rows[0]?.email,
          backUrl: `${appBase}/app/planes`,
          successUrl: `${appBase}/app/planes?mp_status=success`,
          failureUrl: `${appBase}/app/planes?mp_status=failure`,
          pendingUrl: `${appBase}/app/planes?mp_status=pending`,
          notificationUrl: `${appBase}/api/billing/mercadopago/webhook`,
          metadata: {
            paymentRequestId: pending.id,
            tenantId,
            tenantSlug: tenantRes.rows[0]?.slug ?? null,
            planType,
            purpose: pendingPurpose,
            branchSlotsQty: pendingSlotsQty,
          },
        });

        await db.query(
          `
            UPDATE "PaymentRequest"
            SET provider = 'MERCADOPAGO',
                "checkoutUrl" = $1,
                "mercadoPagoPreferenceId" = $2,
                "updatedAt" = NOW()
            WHERE id = $3
          `,
          [checkout.checkoutUrl, checkout.preferenceId, pending.id],
        );

        pending.checkoutUrl = checkout.checkoutUrl;
        pending.provider = 'MERCADOPAGO';
        pending.mercadoPagoPreferenceId = checkout.preferenceId;
      } catch {
        // Keep pending transfer/manual state if MP checkout refresh fails.
      }
    }
  }

  const plan = planRow.rows[0] ? serializeTenantPlan(planRow.rows[0]) : null;
  const latestConfirmed = latestConfirmedRes.rows[0];
  const renewalBaseDate =
    latestConfirmed?.confirmedAt ??
    latestConfirmed?.createdAt ??
    (plan?.updatedAt ? new Date(plan.updatedAt) : null);
  const renewal =
    plan && plan.planType !== 'DEMO' && renewalBaseDate
      ? {
          provider: latestConfirmed?.provider === 'MERCADOPAGO' ? 'MERCADOPAGO' : latestConfirmed?.provider === 'TRANSFER' ? 'TRANSFER' : null,
          currentPeriodStart: renewalBaseDate.toISOString(),
          nextRenewalAt: getNextRenewal(renewalBaseDate, latestConfirmed?.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY').toISOString(),
        }
      : null;
  const paidBranchSlots = Math.max(1, Number(plan?.paidBranchSlots ?? 1));
  const includedBranchSlots = plan?.planType === 'DEMO' ? 1 : plan?.planType === 'PAID_FULL' ? paidBranchSlots : 1;
  const availableBranchSlots = Math.max(0, includedBranchSlots - branchCount);

  return {
    branchCount,
    requiresPaidFull,
    canUseDemo,
    includedBranchSlots,
    availableBranchSlots,
    plan,
    pendingPayment: pending
      ? {
          id: pending.id,
          planType: pending.planType,
          status: pending.status,
          provider: pending.provider === 'MERCADOPAGO' ? 'MERCADOPAGO' : 'TRANSFER',
          billingCycle: pending.billingCycle === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY',
          purpose: pending.purpose === 'ADD_BRANCH' ? 'ADD_BRANCH' : 'PLAN',
          branchSlotsQty: Math.max(1, Number(pending.branchSlotsQty ?? 1)),
          cbu: pending.cbu,
          checkoutUrl: pending.checkoutUrl,
          mercadoPagoPreferenceId: pending.mercadoPagoPreferenceId,
          mercadoPagoPaymentId: pending.mercadoPagoPaymentId,
          mercadoPagoStatus: pending.mercadoPagoStatus,
          publicKey: getMercadoPagoPublicKey(),
          selectedApps: getEnabledAppsForPlan(pending.planType, pending.selectedApps),
          createdAt: pending.createdAt.toISOString(),
        }
      : null,
    renewal,
  };
}

export async function getTenantAccountAccessSnapshot(tenantId: string): Promise<AccountAccessSnapshot> {
  await ensureAdminTables();

  const [planRes, pendingRes] = await Promise.all([
    db.query(
      `
        SELECT "tenantId", "planType", "isPaid", "enabledApps", "demoEndsAt", "paidBranchSlots", "updatedAt"
        FROM "AdminTenantPlan"
        WHERE "tenantId" = $1
        LIMIT 1
      `,
      [tenantId],
    ),
    db.query<{ id: string }>(
      `
        SELECT id
        FROM "PaymentRequest"
        WHERE "tenantId" = $1 AND status = 'PENDING'
        LIMIT 1
      `,
      [tenantId],
    ),
  ]);

  const hasPendingPayment = Boolean(pendingRes.rows[0]?.id);
  const plan = planRes.rows[0] ? serializeTenantPlan(planRes.rows[0]) : null;

  if (!plan) {
    return {
      mode: 'DEMO',
      isPaid: false,
      demoEndsAt: null,
      enabledApps: [...FREE_APPS],
      planName: 'Plan gratis',
      hasChosenPlan: false,
      paymentStatus: hasPendingPayment ? 'PENDING' : 'NONE',
    };
  }

  return {
    mode: plan.planType,
    isPaid: plan.isPaid,
    demoEndsAt: plan.demoEndsAt,
    enabledApps: plan.planType === 'PAID_FULL' ? [...ALL_APPS] : plan.enabledApps,
    planName:
      plan.planType === 'DEMO'
        ? 'Plan gratis'
        : 'Plan Profesional',
    hasChosenPlan: true,
    paymentStatus: hasPendingPayment ? 'PENDING' : plan.isPaid ? 'CONFIRMED' : 'NONE',
  };
}

export async function listUserOwnedTenants(userId: string) {
  await ensureAdminTables();

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

export async function deleteTenantById(tenantId: string) {
  await ensureAdminTables();
  await ensureAppointmentLineServiceFkDeleteSetNull();

  await db.query(
    `
      UPDATE "AppointmentLine" l
      SET "serviceId" = NULL
      FROM "Service" s
      WHERE l."serviceId" = s.id
        AND s."tenantId" = $1
    `,
    [tenantId],
  );

  const result = await db.query<{ id: string; slug: string; name: string }>(
    `
      DELETE FROM "Tenant"
      WHERE id = $1
      RETURNING id, slug, name
    `,
    [tenantId],
  );

  return result.rows[0] ?? null;
}

export async function archiveTenantById(tenantId: string) {
  await ensureAdminTables();

  const result = await db.query<{ id: string; slug: string; name: string }>(
    `
      UPDATE "Tenant"
      SET "archivedAt" = NOW()
      WHERE id = $1 AND "archivedAt" IS NULL
      RETURNING id, slug, name
    `,
    [tenantId],
  );

  return result.rows[0] ?? null;
}

export async function getAdminGlobalStats() {
  await ensureAdminTables();

  const [tenantsRes, branchesRes, customersRes, appointmentsRes, pendingRes] = await Promise.all([
    db.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM "Tenant" WHERE "archivedAt" IS NULL`),
    db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM "Branch" b
        INNER JOIN "Tenant" t ON t.id = b."tenantId"
        WHERE t."archivedAt" IS NULL
      `,
    ),
    db.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM "CustomerUser" WHERE "archivedAt" IS NULL`),
    db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM "Appointment" a
        INNER JOIN "Tenant" t ON t.id = a."tenantId"
        WHERE t."archivedAt" IS NULL
      `,
    ),
    db.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM "PaymentRequest" WHERE status = 'PENDING'`),
  ]);

  return {
    tenants: Number(tenantsRes.rows[0]?.total ?? 0),
    branches: Number(branchesRes.rows[0]?.total ?? 0),
    customers: Number(customersRes.rows[0]?.total ?? 0),
    appointments: Number(appointmentsRes.rows[0]?.total ?? 0),
    pendingPayments: Number(pendingRes.rows[0]?.total ?? 0),
  };
}

function normalizeApps(apps: unknown): string[] {
  if (!Array.isArray(apps)) {
    return [];
  }

  return apps.filter((value): value is string => {
    return typeof value === 'string' && (ALL_APPS as readonly string[]).includes(value);
  });
}

function serializeTenantPlan(row: any): TenantPlan {
  const planType = row.planType as PlanType;
  return {
    tenantId: row.tenantId,
    planType,
    isPaid: Boolean(row.isPaid),
    enabledApps: getEnabledAppsForPlan(planType, row.enabledApps),
    demoEndsAt: planType === 'DEMO' ? null : row.demoEndsAt ? new Date(row.demoEndsAt).toISOString() : null,
    paidBranchSlots: Math.max(1, Number(row.paidBranchSlots ?? 1)),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function getNextRenewal(base: Date, cycle: BillingCycle): Date {
  const start = new Date(base);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const day = start.getUTCDate();
  const hour = start.getUTCHours();
  const minute = start.getUTCMinutes();
  const second = start.getUTCSeconds();
  const ms = start.getUTCMilliseconds();

  const monthJump = cycle === 'ANNUAL' ? 12 : 1;
  const targetMonth = month + monthJump;
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
  const normalizedDay = Math.min(day, lastDay);

  return new Date(Date.UTC(year, targetMonth, normalizedDay, hour, minute, second, ms));
}
