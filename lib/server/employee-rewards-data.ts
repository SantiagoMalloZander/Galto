import { db } from './db';
import { assertTenantAccess, listCalendarBranchesForUser } from './reservas-data';

export type RewardMetricType = 'RATING' | 'REVENUE' | 'SERVICES';

type RewardsContextInput = {
  userId: string;
  tenantId: string;
  month?: string;
  branchIds?: string[];
};

function parseMonthRange(monthRaw?: string) {
  const now = new Date();
  const fallback = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const month = /^\d{4}-\d{2}$/.test(monthRaw ?? '') ? String(monthRaw) : fallback;
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Math.max(0, Math.min(11, Number(monthStr) - 1));
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));
  return {
    month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function ensureEmployeeRewardsTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "EmployeeRewardGoal" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "name" TEXT NOT NULL,
      "metricType" TEXT NOT NULL,
      "targetValue" DOUBLE PRECISION NOT NULL,
      "rewardTitle" TEXT NOT NULL,
      "rewardNote" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "EmployeeRewardGoal_metricType_check" CHECK ("metricType" IN ('RATING','REVENUE','SERVICES')),
      CONSTRAINT "EmployeeRewardGoal_targetValue_check" CHECK ("targetValue" > 0)
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "EmployeeRewardGoal_tenant_idx"
    ON "EmployeeRewardGoal"("tenantId", "isActive", "createdAt" DESC)
  `);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function metricValue(metric: RewardMetricType, row: { ratingAvg: number | null; revenueCents: number; services: number }) {
  if (metric === 'RATING') return Number(row.ratingAvg ?? 0);
  if (metric === 'REVENUE') return Number(row.revenueCents ?? 0);
  return Number(row.services ?? 0);
}

export async function getEmployeeRewardsContext(input: RewardsContextInput) {
  await ensureEmployeeRewardsTables();

  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) {
    throw new Error('Sin acceso al tenant');
  }

  const branches = await listCalendarBranchesForUser({
    tenantId: input.tenantId,
    userId: input.userId,
  });

  const allowedBranchIds = new Set(branches.map((branch) => branch.id));
  const selectedBranchIds = (input.branchIds ?? []).filter((branchId) => allowedBranchIds.has(branchId));
  const effectiveBranchIds = selectedBranchIds.length ? selectedBranchIds : branches.map((branch) => branch.id);

  const { month, start, end } = parseMonthRange(input.month);

  if (!effectiveBranchIds.length) {
    return {
      month,
      range: { start, end },
      branches,
      selectedBranchIds: [],
      canWrite: membership.role === 'OWNER' || membership.role === 'MANAGER',
      goals: [],
      ranking: {
        byRevenue: [],
        byServices: [],
        byRating: [],
      },
    };
  }

  const [employeesRes, aggRes, ratingsRes, goalsRes] = await Promise.all([
    db.query<{ employeeId: string; employeeName: string }>(
      `
        SELECT e.id as "employeeId", e."fullName" as "employeeName"
        FROM "Employee" e
        WHERE e."tenantId" = $1
          AND e."branchId" = ANY($2::text[])
          AND e."isActive" = TRUE
        ORDER BY e."fullName" ASC
      `,
      [input.tenantId, effectiveBranchIds],
    ),
    db.query<{ employeeId: string; services: number; revenueCents: number }>(
      `
        WITH appointment_line_totals AS (
          SELECT
            a.id,
            a."employeeId",
            COUNT(l.id)::int as "services",
            COALESCE(NULLIF(SUM(l."priceCents"), 0), a."totalChargedCents", 0)::int as "revenueCents"
          FROM "Appointment" a
          LEFT JOIN "AppointmentLine" l ON l."appointmentId" = a.id
          WHERE a."tenantId" = $1
            AND a."branchId" = ANY($2::text[])
            AND a.status <> 'CANCELLED'
            AND a."startsAt" >= $3::timestamptz
            AND a."startsAt" < $4::timestamptz
          GROUP BY a.id, a."employeeId", a."totalChargedCents"
        )
        SELECT
          "employeeId",
          COALESCE(SUM("services"), 0)::int as "services",
          COALESCE(SUM("revenueCents"), 0)::int as "revenueCents"
        FROM appointment_line_totals
        GROUP BY "employeeId"
      `,
      [input.tenantId, effectiveBranchIds, start, end],
    ),
    db.query<{ employeeId: string; ratingAvg: number; ratingCount: number }>(
      `
        SELECT
          r."employeeId",
          AVG(r.score)::float as "ratingAvg",
          COUNT(r.id)::int as "ratingCount"
        FROM "Rating" r
        INNER JOIN "Appointment" a ON a.id = r."appointmentId"
        WHERE a."tenantId" = $1
          AND a."branchId" = ANY($2::text[])
          AND a."startsAt" >= $3::timestamptz
          AND a."startsAt" < $4::timestamptz
        GROUP BY r."employeeId"
      `,
      [input.tenantId, effectiveBranchIds, start, end],
    ).catch(() => ({ rows: [] as Array<{ employeeId: string; ratingAvg: number; ratingCount: number }> })),
    db.query<{
      id: string;
      name: string;
      metricType: RewardMetricType;
      targetValue: number;
      rewardTitle: string;
      rewardNote: string | null;
      isActive: boolean;
      createdAt: Date;
    }>(
      `
        SELECT id, name, "metricType", "targetValue", "rewardTitle", "rewardNote", "isActive", "createdAt"
        FROM "EmployeeRewardGoal"
        WHERE "tenantId" = $1
        ORDER BY "isActive" DESC, "createdAt" DESC
      `,
      [input.tenantId],
    ),
  ]);

  const aggMap = new Map(aggRes.rows.map((row) => [row.employeeId, row]));
  const ratingsMap = new Map(ratingsRes.rows.map((row) => [row.employeeId, row]));

  const employees = employeesRes.rows.map((employee) => {
    const metrics = aggMap.get(employee.employeeId);
    const rating = ratingsMap.get(employee.employeeId);
    return {
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      services: Number(metrics?.services ?? 0),
      revenueCents: Number(metrics?.revenueCents ?? 0),
      ratingAvg: rating ? Number(Number(rating.ratingAvg).toFixed(2)) : null,
      ratingCount: Number(rating?.ratingCount ?? 0),
    };
  });

  const byRevenue = [...employees].sort((a, b) => b.revenueCents - a.revenueCents);
  const byServices = [...employees].sort((a, b) => b.services - a.services);
  const byRating = [...employees].sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0));

  const goals = goalsRes.rows.map((goal) => {
    const standings = [...employees]
      .map((employee) => {
        const value = metricValue(goal.metricType, {
          ratingAvg: employee.ratingAvg,
          revenueCents: employee.revenueCents,
          services: employee.services,
        });
        return {
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          value,
          reached: value >= Number(goal.targetValue),
          progressPct: Number(Math.min(100, (value / Number(goal.targetValue || 1)) * 100).toFixed(1)),
        };
      })
      .sort((a, b) => b.value - a.value);

    return {
      id: goal.id,
      name: goal.name,
      metricType: goal.metricType,
      targetValue: Number(goal.targetValue),
      rewardTitle: goal.rewardTitle,
      rewardNote: goal.rewardNote,
      isActive: Boolean(goal.isActive),
      createdAt: goal.createdAt.toISOString(),
      standings,
    };
  });

  return {
    month,
    range: { start, end },
    branches,
    selectedBranchIds: effectiveBranchIds,
    canWrite: membership.role === 'OWNER' || membership.role === 'MANAGER',
    goals,
    ranking: {
      byRevenue,
      byServices,
      byRating,
    },
  };
}

export async function createEmployeeRewardGoal(input: {
  userId: string;
  tenantId: string;
  name: string;
  metricType: RewardMetricType;
  targetValue: number;
  rewardTitle: string;
  rewardNote?: string | null;
}) {
  await ensureEmployeeRewardsTables();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');
  if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') {
    throw new Error('No tenés permisos para crear recompensas');
  }

  const name = normalizeText(input.name);
  const rewardTitle = normalizeText(input.rewardTitle);
  const rewardNote = normalizeText(input.rewardNote);
  const inputTargetValue = Number(input.targetValue);

  if (!name || name.length < 3) throw new Error('Ingresá un objetivo válido');
  if (!rewardTitle || rewardTitle.length < 2) throw new Error('Ingresá una recompensa válida');
  if (!['RATING', 'REVENUE', 'SERVICES'].includes(input.metricType)) throw new Error('Métrica inválida');
  if (!Number.isFinite(inputTargetValue) || inputTargetValue <= 0) throw new Error('Objetivo inválido');
  const targetValue = input.metricType === 'REVENUE' ? Math.round(inputTargetValue * 100) : inputTargetValue;

  const result = await db.query<{ id: string }>(
    `
      INSERT INTO "EmployeeRewardGoal" (
        id, "tenantId", name, "metricType", "targetValue", "rewardTitle", "rewardNote", "isActive", "createdAt", "updatedAt"
      )
      VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, TRUE, NOW(), NOW())
      RETURNING id
    `,
    [input.tenantId, name, input.metricType, targetValue, rewardTitle, rewardNote],
  );

  return result.rows[0];
}

export async function updateEmployeeRewardGoal(input: {
  userId: string;
  tenantId: string;
  goalId: string;
  name: string;
  metricType: RewardMetricType;
  targetValue: number;
  rewardTitle: string;
  rewardNote?: string | null;
  isActive: boolean;
}) {
  await ensureEmployeeRewardsTables();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');
  if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') {
    throw new Error('No tenés permisos para editar recompensas');
  }

  const name = normalizeText(input.name);
  const rewardTitle = normalizeText(input.rewardTitle);
  const rewardNote = normalizeText(input.rewardNote);
  const inputTargetValue = Number(input.targetValue);

  if (!name || name.length < 3) throw new Error('Ingresá un objetivo válido');
  if (!rewardTitle || rewardTitle.length < 2) throw new Error('Ingresá una recompensa válida');
  if (!['RATING', 'REVENUE', 'SERVICES'].includes(input.metricType)) throw new Error('Métrica inválida');
  if (!Number.isFinite(inputTargetValue) || inputTargetValue <= 0) throw new Error('Objetivo inválido');
  const targetValue = input.metricType === 'REVENUE' ? Math.round(inputTargetValue * 100) : inputTargetValue;

  await db.query(
    `
      UPDATE "EmployeeRewardGoal"
      SET name = $1,
          "metricType" = $2,
          "targetValue" = $3,
          "rewardTitle" = $4,
          "rewardNote" = $5,
          "isActive" = $6,
          "updatedAt" = NOW()
      WHERE id = $7 AND "tenantId" = $8
    `,
    [name, input.metricType, targetValue, rewardTitle, rewardNote, input.isActive, input.goalId, input.tenantId],
  );
}

export async function deleteEmployeeRewardGoal(input: { userId: string; tenantId: string; goalId: string }) {
  await ensureEmployeeRewardsTables();
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) throw new Error('Sin acceso al tenant');
  if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') {
    throw new Error('No tenés permisos para borrar recompensas');
  }

  await db.query(`DELETE FROM "EmployeeRewardGoal" WHERE id = $1 AND "tenantId" = $2`, [input.goalId, input.tenantId]);
}
