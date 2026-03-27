import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { db } from '@/lib/server/db';
import { ensureReservasTables } from '@/lib/server/reservas-data';
import { ensureCustomerAccountTables } from '@/lib/server/customer-accounts';
import { ensureCuentasTables } from '@/lib/server/cuentas-data';

type TenantMembership = {
  membershipId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
};

type OnboardingStepId =
  | 'createBranch'
  | 'configureBranchData'
  | 'createService'
  | 'addWorker'
  | 'assignWorkerServices'
  | 'addAndDeleteCustomer'
  | 'configureBooking'
  | 'createBooking'
  | 'workerProfile'
  | 'workerSchedules'
  | 'workerServices'
  | 'workerCalendar'
  | 'workerTestCustomer'
  | 'workerTurns';

const ONBOARDING_STEPS: OnboardingStepId[] = [
  'createBranch',
  'configureBranchData',
  'createService',
  'addWorker',
  'assignWorkerServices',
  'addAndDeleteCustomer',
  'configureBooking',
  'createBooking',
  'workerProfile',
  'workerSchedules',
  'workerServices',
  'workerCalendar',
  'workerTestCustomer',
  'workerTurns',
];

let onboardingTablesReadyPromise: Promise<void> | null = null;

function ensureOnboardingTablesReady() {
  if (!onboardingTablesReadyPromise) {
    onboardingTablesReadyPromise = Promise.all([
      ensureReservasTables(),
      ensureCustomerAccountTables(),
      ensureCuentasTables(),
      db.query(`
        CREATE TABLE IF NOT EXISTS "UserOnboardingProgress" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
          "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
          "stepId" TEXT NOT NULL,
          "completedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT "UserOnboardingProgress_step_check" CHECK (
            "stepId" IN (
              'createBranch',
              'configureBranchData',
              'createService',
              'addWorker',
              'assignWorkerServices',
              'addAndDeleteCustomer',
              'configureBooking',
              'createBooking',
              'workerProfile',
              'workerSchedules',
              'workerServices',
              'workerCalendar',
              'workerTestCustomer',
              'workerTurns'
            )
          )
        )
      `),
      db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "UserOnboardingProgress_user_tenant_step_idx"
        ON "UserOnboardingProgress"("userId", "tenantId", "stepId")
      `),
    ]).then(() => {});
  }
  return onboardingTablesReadyPromise;
}

function isOnboardingStepId(value: string): value is OnboardingStepId {
  return (ONBOARDING_STEPS as string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const requestedTenantId = request.nextUrl.searchParams.get('tenantId') ?? '';

  if (!userId) {
    return NextResponse.json({ message: 'userId es obligatorio' }, { status: 400 });
  }

  await ensureOnboardingTablesReady();

  const membershipsRes = await db.query<TenantMembership>(
    `
      SELECT
        m.id as "membershipId",
        m."tenantId" as "tenantId",
        t.slug as "tenantSlug",
        t.name as "tenantName",
        m.role
      FROM "Membership" m
      INNER JOIN "Tenant" t ON t.id = m."tenantId"
      WHERE m."userId" = $1
        AND t."archivedAt" IS NULL
        ORDER BY
        CASE m.role WHEN 'OWNER' THEN 1 WHEN 'MANAGER' THEN 2 ELSE 3 END,
        m."createdAt" ASC
    `,
    [userId],
  );

  const memberships = membershipsRes.rows;
  if (!memberships.length) {
    return NextResponse.json({
      tenant: null,
      actor: null,
      stats: {
        branches: 0,
        branchDataConfigured: 0,
        services: 0,
        workers: 0,
        workerServiceAssignments: 0,
        customers: 0,
        archivedCustomers: 0,
        bookingConfigured: 0,
        appointments: 0,
      },
      steps: {
        createBranch: false,
        configureBranchData: false,
        createService: false,
        addWorker: false,
        assignWorkerServices: false,
        addAndDeleteCustomer: false,
        configureBooking: false,
        createBooking: false,
        workerProfile: false,
        workerSchedules: false,
        workerServices: false,
        workerCalendar: false,
        workerTestCustomer: false,
        workerTurns: false,
      },
    });
  }

  const activeTenant =
    memberships.find((row) => row.tenantId === requestedTenantId) ??
    memberships[0];

  const tenantId = activeTenant.tenantId;

  const [
    branchStatsRes,
    servicesRes,
    workersRes,
    workerAssignmentsRes,
    workerProfileRes,
    workerSchedulesRes,
    workerServicesRes,
    customersRes,
    archivedCustomersRes,
    bookingConfiguredRes,
    appointmentsRes,
  ] = await Promise.all([
    db.query<{ total: string; configured: string }>(
      `
        SELECT
          COUNT(*)::text as total,
          COUNT(*) FILTER (
            WHERE
              EXISTS (
                SELECT 1 FROM "BranchSchedule" bs WHERE bs."branchId" = b.id
              )
              OR EXISTS (
                SELECT 1
                FROM "BranchProfile" bp
                WHERE bp."branchId" = b.id
                  AND (
                    COALESCE(bp.address, '') <> ''
                    OR COALESCE(bp.phone, '') <> ''
                    OR COALESCE(bp."policyText", '') <> ''
                  )
              )
          )::text as configured
        FROM "Branch" b
        WHERE b."tenantId" = $1
      `,
      [tenantId],
    ),
    db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text as total
        FROM "Service"
        WHERE "tenantId" = $1
          AND "isActive" = TRUE
      `,
      [tenantId],
    ),
    db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text as total
        FROM "Membership"
        WHERE "tenantId" = $1
          AND role IN ('MANAGER', 'EMPLOYEE')
      `,
      [tenantId],
    ),
    db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text as total
        FROM "ServiceAssignment" sa
        INNER JOIN "Employee" e ON e.id = sa."employeeId"
        WHERE e."tenantId" = $1
      `,
      [tenantId],
    ),
    db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text as total
        FROM "StaffProfile"
        WHERE "membershipId" = $1
          AND (
            COALESCE(instagram, '') <> ''
            OR COALESCE(bio, '') <> ''
            OR COALESCE("personalPhone", '') <> ''
          )
      `,
      [activeTenant.membershipId],
    ),
    db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text as total
        FROM "EmployeeSchedule" es
        WHERE es."employeeId" IN (
          SELECT id
          FROM "Employee"
          WHERE "tenantId" = $1
            AND "membershipId" = $2
        )
      `,
      [tenantId, activeTenant.membershipId],
    ),
    db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text as total
        FROM "ServiceAssignment" sa
        WHERE sa."employeeId" IN (
          SELECT id
          FROM "Employee"
          WHERE "tenantId" = $1
            AND "membershipId" = $2
        )
      `,
      [tenantId, activeTenant.membershipId],
    ),
    db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text as total
        FROM "Customer"
        WHERE "tenantId" = $1
          AND COALESCE("isTest", FALSE) = FALSE
      `,
      [tenantId],
    ),
    db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text as total
        FROM "CustomerIdentity" ci
        INNER JOIN "Customer" c ON c.id = ci."customerId"
        INNER JOIN "CustomerUser" cu ON cu.id = ci."customerUserId"
        WHERE c."tenantId" = $1
          AND cu."archivedAt" IS NOT NULL
      `,
      [tenantId],
    ),
    db.query<{ total: string }>(
      `
        SELECT CASE
          WHEN EXISTS (
            SELECT 1
            FROM "TenantVisualProfile" tvp
            WHERE tvp."tenantId" = $1
              AND COALESCE(tvp."logoPhotoUrl", '') <> ''
          )
          THEN '1'
          ELSE '0'
        END as total
      `,
      [tenantId],
    ),
    db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text as total
        FROM "Appointment"
        WHERE "tenantId" = $1
      `,
      [tenantId],
    ),
  ]);

  const branches = Number(branchStatsRes.rows[0]?.total ?? 0);
  const branchDataConfigured = Number(branchStatsRes.rows[0]?.configured ?? 0);
  const services = Number(servicesRes.rows[0]?.total ?? 0);
  const workers = Number(workersRes.rows[0]?.total ?? 0);
  const workerServiceAssignments = Number(workerAssignmentsRes.rows[0]?.total ?? 0);
  const workerProfileConfigured = Number(workerProfileRes.rows[0]?.total ?? 0);
  const workerSchedulesConfigured = Number(workerSchedulesRes.rows[0]?.total ?? 0);
  const workerServicesConfigured = Number(workerServicesRes.rows[0]?.total ?? 0);
  const customers = Number(customersRes.rows[0]?.total ?? 0);
  const archivedCustomers = Number(archivedCustomersRes.rows[0]?.total ?? 0);
  const bookingConfigured = Number(bookingConfiguredRes.rows[0]?.total ?? 0);
  const appointments = Number(appointmentsRes.rows[0]?.total ?? 0);

  const manualStepsRes = await db.query<{ stepId: OnboardingStepId }>(
    `
      SELECT "stepId"
      FROM "UserOnboardingProgress"
      WHERE "userId" = $1
        AND "tenantId" = $2
    `,
    [userId, tenantId],
  );

  const manualSteps = new Set(manualStepsRes.rows.map((row) => row.stepId));
  const steps = {
    createBranch: branches > 0 || manualSteps.has('createBranch'),
    configureBranchData: branchDataConfigured > 0 || manualSteps.has('configureBranchData'),
    createService: services > 1 || manualSteps.has('createService'),
    addWorker: workers > 0 || manualSteps.has('addWorker'),
    assignWorkerServices: workerServiceAssignments > 0 || manualSteps.has('assignWorkerServices'),
    addAndDeleteCustomer: (customers > 0 && archivedCustomers > 0) || manualSteps.has('addAndDeleteCustomer'),
    configureBooking: bookingConfigured > 0 || manualSteps.has('configureBooking'),
    createBooking: manualSteps.has('createBooking'),
    workerProfile: workerProfileConfigured > 0 || manualSteps.has('workerProfile'),
    workerSchedules: workerSchedulesConfigured > 0 || manualSteps.has('workerSchedules'),
    workerServices: workerServicesConfigured > 0 || manualSteps.has('workerServices'),
    workerCalendar: manualSteps.has('workerCalendar'),
    workerTestCustomer: manualSteps.has('workerTestCustomer'),
    workerTurns: manualSteps.has('workerTurns'),
  };

  return NextResponse.json({
    tenant: {
      id: activeTenant.tenantId,
      slug: activeTenant.tenantSlug,
      name: activeTenant.tenantName,
    },
    actor: {
      membershipId: activeTenant.membershipId,
      role: activeTenant.role,
    },
    stats: {
      branches,
      branchDataConfigured,
      services,
      workers,
      workerServiceAssignments,
      customers,
      archivedCustomers,
      bookingConfigured,
      appointments,
    },
    steps,
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  await ensureOnboardingTablesReady();

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : '';
  const stepId = typeof body.stepId === 'string' ? body.stepId : '';
  const completed = body.completed !== false;

  if (!userId || !tenantId || !stepId) {
    return NextResponse.json({ message: 'userId, tenantId y stepId son obligatorios' }, { status: 400 });
  }
  if (!isOnboardingStepId(stepId)) {
    return NextResponse.json({ message: 'stepId inválido' }, { status: 400 });
  }

  const membershipRes = await db.query(
    `
      SELECT id
      FROM "Membership"
      WHERE "userId" = $1
        AND "tenantId" = $2
      LIMIT 1
    `,
    [userId, tenantId],
  );

  if (!membershipRes.rows[0]) {
    return NextResponse.json({ message: 'Sin acceso al tenant' }, { status: 403 });
  }

  if (completed) {
    await db.query(
      `
        INSERT INTO "UserOnboardingProgress" ("id", "userId", "tenantId", "stepId", "completedAt", "createdAt")
        VALUES (gen_random_uuid()::text, $1, $2, $3, NOW(), NOW())
        ON CONFLICT ("userId", "tenantId", "stepId") DO UPDATE
        SET "completedAt" = NOW()
      `,
      [userId, tenantId, stepId],
    );
  } else {
    await db.query(
      `
        DELETE FROM "UserOnboardingProgress"
        WHERE "userId" = $1
          AND "tenantId" = $2
          AND "stepId" = $3
      `,
      [userId, tenantId, stepId],
    );
  }

  return NextResponse.json({ ok: true });
}
