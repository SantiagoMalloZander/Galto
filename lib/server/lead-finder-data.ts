import { db } from './db';
import { listAccessibleBranchesForUser } from './branch-context';
import { assertTenantAccess } from './reservas-data';
import { sendWhatsappMessage, type BranchWhatsappConfig } from './customer-accounts';

type Segment = 'HABITUAL' | 'CASI_HABITUAL' | 'UNA_VISITA';

type BranchLeadFinderConfig = {
  id: string;
  name: string;
  timeZone: string;
  whatsappConfig: BranchWhatsappConfig | null;
  whatsappConfigured: boolean;
};

type CompletedServiceRow = {
  appointmentId: string;
  startsAt: Date;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  serviceId: string;
  serviceName: string;
};

type PatternStats = {
  samples: number;
  meanIntervalDays: number;
  stdIntervalDays: number;
  regressionSlopeDays: number;
  regressionNextIntervalDays: number;
  predictedIntervalDays: number;
  lowerIntervalDays: number;
  upperIntervalDays: number;
  confidencePct: number;
};

export type LeadFinderCustomer = {
  customerId: string;
  fullName: string;
  phone: string | null;
  totalVisits: number;
  segment: Segment;
  dominantService: {
    serviceId: string;
    serviceName: string;
    visits: number;
  } | null;
  lastVisitAt: string | null;
  prediction: {
    nextVisitAt: string | null;
    windowStartAt: string | null;
    windowEndAt: string | null;
    confidencePct: number | null;
    method: 'REGRESSION_INTERVAL' | 'INTERVAL_ONLY' | 'NONE';
    stats: PatternStats | null;
  };
  inRiskWindow: boolean;
  riskScore: number;
  daysSinceLastVisit: number | null;
  daysUntilRiskWindowStart: number | null;
  recommendation: string;
  lastMessageSentAt: string | null;
  cooldownUntil: string | null;
  canSendWhatsapp: boolean;
};

export type LeadFinderAnalysisPayload = {
  computedAt: string;
  snapshotDate: string;
  branch: {
    branchId: string;
    branchName: string;
    timeZone: string;
    whatsappConfigured: boolean;
  };
  summary: {
    totalCustomers: number;
    habitualCount: number;
    almostHabitualCount: number;
    oneVisitCount: number;
    actionableNowCount: number;
  };
  customers: LeadFinderCustomer[];
};

type RawCustomerModel = {
  customerId: string;
  fullName: string;
  phone: string | null;
  visits: Map<number, { startsAt: Date; serviceIds: Set<string> }>;
  services: Map<string, { serviceId: string; serviceName: string; dates: Date[] }>;
};

const COOLDOWN_DAYS = 7;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function daysBetween(a: Date, b: Date) {
  return (a.getTime() - b.getTime()) / 86_400_000;
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 86_400_000);
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stdDev(values: number[], avg: number) {
  if (values.length <= 1) return 0;
  const variance = values.reduce((acc, value) => acc + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(Math.max(0, variance));
}

function regressionNext(values: number[]) {
  const n = values.length;
  if (n <= 1) {
    return values[0] ?? 0;
  }
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i + 1;
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const denominator = n * sumX2 - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return {
    slope,
    next: intercept + slope * (n + 1),
  };
}

function buildPatternStats(sortedDates: Date[]): PatternStats | null {
  if (sortedDates.length < 2) return null;
  const intervals = sortedDates
    .slice(1)
    .map((date, index) => daysBetween(date, sortedDates[index]))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!intervals.length) return null;

  const avg = mean(intervals);
  const deviation = stdDev(intervals, avg);
  const regression = regressionNext(intervals);
  const regressionNextInterval = clamp(Number.isFinite(regression.next) ? regression.next : avg, 1, 180);
  const predicted = clamp(avg * 0.6 + regressionNextInterval * 0.4, 1, 180);
  const margin = Math.max(1, 1.96 * (deviation / Math.sqrt(Math.max(1, intervals.length))) + 1);
  const lower = Math.max(1, predicted - margin);
  const upper = Math.max(lower + 0.5, predicted + margin);
  const confidencePct = clamp(Math.round(100 - (margin / Math.max(predicted, 1)) * 100), 35, 95);

  return {
    samples: intervals.length,
    meanIntervalDays: round(avg),
    stdIntervalDays: round(deviation),
    regressionSlopeDays: round(regression.slope),
    regressionNextIntervalDays: round(regressionNextInterval),
    predictedIntervalDays: round(predicted),
    lowerIntervalDays: round(lower),
    upperIntervalDays: round(upper),
    confidencePct,
  };
}

function getDateKeyInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const data = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${String(data.year)}-${String(data.month)}-${String(data.day)}`;
}

function ensureE164(phone: string | null) {
  if (!phone) return null;
  const normalized = phone.trim();
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return null;
  return normalized;
}

function buildRecommendation(input: {
  segment: Segment;
  name: string;
  serviceName: string | null;
  inRiskWindow: boolean;
  overdue: boolean;
}) {
  const serviceLabel = input.serviceName ?? 'tu servicio';
  if (input.segment === 'HABITUAL') {
    if (input.overdue) {
      return `Hola ${input.name}, vimos que ya pasó tu ventana habitual para ${serviceLabel}. Si querés, te reservo un turno esta semana.`;
    }
    if (input.inRiskWindow) {
      return `Hola ${input.name}, estás en tu ventana ideal para ${serviceLabel}. ¿Te agendo un turno para estos días?`;
    }
    return `Hola ${input.name}, se acerca tu próxima fecha para ${serviceLabel}. Avisame y te dejo turno listo.`;
  }

  if (input.segment === 'CASI_HABITUAL') {
    return `Hola ${input.name}, ya viniste más de una vez y queremos que mantengas tu ritmo de ${serviceLabel}. ¿Te reservo un turno?`;
  }

  return `Hola ${input.name}, gracias por visitarnos. Si querés volver, te ayudo a encontrar el mejor horario para vos.`;
}

async function ensureLeadFinderTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "LeadFinderDailySnapshot" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "branchId" TEXT NOT NULL REFERENCES "Branch"(id) ON DELETE CASCADE,
      "snapshotDate" DATE NOT NULL,
      "payload" JSONB NOT NULL,
      "computedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE ("tenantId", "branchId", "snapshotDate")
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS "LeadFinderContactLog" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "branchId" TEXT NOT NULL REFERENCES "Branch"(id) ON DELETE CASCADE,
      "customerId" TEXT NOT NULL REFERENCES "Customer"(id) ON DELETE CASCADE,
      "serviceId" TEXT,
      "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
      "messageBody" TEXT NOT NULL,
      "createdByUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      "sentAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS "LeadFinderContactLog_branch_customer_sent_idx"
    ON "LeadFinderContactLog" ("tenantId", "branchId", "customerId", "sentAt" DESC)
  `);

  await db.query(`
    ALTER TABLE "BranchProfile"
    ADD COLUMN IF NOT EXISTS "useCustomWhatsappApi" BOOLEAN NOT NULL DEFAULT FALSE
  `);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaAccessToken" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaPhoneNumberId" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaGraphVersion" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaOtpTemplateName" TEXT`);
  await db.query(`ALTER TABLE "BranchProfile" ADD COLUMN IF NOT EXISTS "whatsappMetaOtpTemplateLang" TEXT`);
}

async function assertLeadFinderBranchAccess(input: { userId: string; tenantId: string; branchId: string }) {
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) {
    throw new Error('Sin acceso al tenant');
  }

  if (membership.role === 'OWNER') {
    return membership;
  }

  const branches = await listAccessibleBranchesForUser({ userId: input.userId, tenantId: input.tenantId });
  const hasBranch = branches.some((branch) => branch.id === input.branchId);
  if (!hasBranch) {
    throw new Error('Sin acceso a la sucursal');
  }

  return membership;
}

async function getBranchLeadFinderConfig(input: { tenantId: string; branchId: string }): Promise<BranchLeadFinderConfig> {
  const result = await db.query<{
    id: string;
    name: string;
    timeZone: string;
    whatsappMetaAccessToken: string | null;
    whatsappMetaPhoneNumberId: string | null;
    whatsappMetaGraphVersion: string | null;
    whatsappMetaOtpTemplateName: string | null;
    whatsappMetaOtpTemplateLang: string | null;
  }>(
    `
      SELECT
        b.id,
        b.name,
        b."timeZone",
        bp."whatsappMetaAccessToken",
        bp."whatsappMetaPhoneNumberId",
        bp."whatsappMetaGraphVersion",
        bp."whatsappMetaOtpTemplateName",
        bp."whatsappMetaOtpTemplateLang"
      FROM "Branch" b
      LEFT JOIN "BranchProfile" bp ON bp."branchId" = b.id
      WHERE b.id = $1 AND b."tenantId" = $2
      LIMIT 1
    `,
    [input.branchId, input.tenantId],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error('Sucursal no encontrada');
  }

  const hasWhatsapp = Boolean(row.whatsappMetaAccessToken?.trim() && row.whatsappMetaPhoneNumberId?.trim());
  return {
    id: row.id,
    name: row.name,
    timeZone: row.timeZone || 'America/Argentina/Buenos_Aires',
    whatsappConfigured: hasWhatsapp,
    whatsappConfig: hasWhatsapp
      ? {
          useCustomMetaApi: true,
          metaAccessToken: row.whatsappMetaAccessToken ?? null,
          metaPhoneNumberId: row.whatsappMetaPhoneNumberId ?? null,
          metaGraphVersion: row.whatsappMetaGraphVersion ?? null,
          metaOtpTemplateName: row.whatsappMetaOtpTemplateName ?? null,
          metaOtpTemplateLang: row.whatsappMetaOtpTemplateLang ?? null,
        }
      : null,
  };
}

async function getCompletedServiceRows(input: { tenantId: string; branchId: string }) {
  const result = await db.query<CompletedServiceRow>(
    `
      SELECT
        a.id AS "appointmentId",
        a."startsAt",
        a."customerId",
        c."fullName" AS "customerName",
        c.phone AS "customerPhone",
        COALESCE(l."serviceId", 'snapshot:' || md5(COALESCE(NULLIF(l."serviceNameSnapshot", ''), 'Servicio'))) AS "serviceId",
        COALESCE(NULLIF(l."serviceNameSnapshot", ''), 'Servicio') AS "serviceName"
      FROM "Appointment" a
      INNER JOIN "Customer" c ON c.id = a."customerId" AND c."archivedAt" IS NULL
      LEFT JOIN "AppointmentLine" l ON l."appointmentId" = a.id
      WHERE a."tenantId" = $1
        AND a."branchId" = $2
        AND a.status = 'COMPLETED'
        AND a."customerId" IS NOT NULL
      ORDER BY a."startsAt" ASC
    `,
    [input.tenantId, input.branchId],
  );

  return result.rows;
}

function buildCustomerModels(rows: CompletedServiceRow[]) {
  const map = new Map<string, RawCustomerModel>();
  for (const row of rows) {
    const rowDate = new Date(row.startsAt);
    const rowTime = rowDate.getTime();
    if (!map.has(row.customerId)) {
      map.set(row.customerId, {
        customerId: row.customerId,
        fullName: row.customerName?.trim() || 'Cliente',
        phone: ensureE164(row.customerPhone),
        visits: new Map(),
        services: new Map(),
      });
    }
    const current = map.get(row.customerId)!;
    if (!current.visits.has(rowTime)) {
      current.visits.set(rowTime, {
        startsAt: rowDate,
        serviceIds: new Set<string>(),
      });
    }
    current.visits.get(rowTime)!.serviceIds.add(row.serviceId);
    if (!current.services.has(row.serviceId)) {
      current.services.set(row.serviceId, {
        serviceId: row.serviceId,
        serviceName: row.serviceName || 'Servicio',
        dates: [],
      });
    }
    const service = current.services.get(row.serviceId)!;
    if (!service.dates.some((date) => date.getTime() === rowDate.getTime())) {
      service.dates.push(rowDate);
    }
  }
  return Array.from(map.values());
}

function resolveHabitualServiceFromFirstThreeVisits(input: {
  services: Array<{ serviceId: string; serviceName: string; dates: Date[] }>;
  firstThreeVisits: Array<{ startsAt: Date; serviceIds: Set<string> }>;
}) {
  if (input.firstThreeVisits.length < 3) return null;
  const [first, second, third] = input.firstThreeVisits;
  const candidates: string[] = [];
  for (const serviceId of first.serviceIds) {
    if (second.serviceIds.has(serviceId) && third.serviceIds.has(serviceId)) {
      candidates.push(serviceId);
    }
  }
  if (!candidates.length) return null;
  return (
    input.services
      .filter((service) => candidates.includes(service.serviceId))
      .sort((a, b) => {
        if (b.dates.length !== a.dates.length) return b.dates.length - a.dates.length;
        const aLast = a.dates[a.dates.length - 1]?.getTime() ?? 0;
        const bLast = b.dates[b.dates.length - 1]?.getTime() ?? 0;
        return bLast - aLast;
      })[0] ?? null
  );
}

function buildCustomerPredictionModels(input: {
  customers: RawCustomerModel[];
  now: Date;
}): LeadFinderCustomer[] {
  return input.customers.map((customer) => {
    const visits = Array.from(customer.visits.values()).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    const appointmentDates = visits.map((visit) => visit.startsAt);
    const totalVisits = appointmentDates.length;
    const lastVisit = appointmentDates[appointmentDates.length - 1] ?? null;

    const services = Array.from(customer.services.values())
      .map((service) => ({
        ...service,
        dates: service.dates.slice().sort((a, b) => a.getTime() - b.getTime()),
      }))
      .sort((a, b) => {
        if (b.dates.length !== a.dates.length) return b.dates.length - a.dates.length;
        const aLast = a.dates[a.dates.length - 1]?.getTime() ?? 0;
        const bLast = b.dates[b.dates.length - 1]?.getTime() ?? 0;
        return bLast - aLast;
      });

    const habitualService = resolveHabitualServiceFromFirstThreeVisits({
      services,
      firstThreeVisits: visits.slice(0, 3),
    });
    const dominantService = habitualService ?? services[0] ?? null;
    const segment: Segment =
      totalVisits === 1
        ? 'UNA_VISITA'
        : habitualService
          ? 'HABITUAL'
          : 'CASI_HABITUAL';

    const pattern =
      dominantService && dominantService.dates.length >= 2 ? buildPatternStats(dominantService.dates) : null;
    const method: LeadFinderCustomer['prediction']['method'] =
      pattern && pattern.samples > 1 ? 'REGRESSION_INTERVAL' : pattern ? 'INTERVAL_ONLY' : 'NONE';

    const predictionLastVisit =
      dominantService?.dates[dominantService.dates.length - 1] ?? lastVisit ?? null;
    const nextVisitAt = pattern && predictionLastVisit ? addDays(predictionLastVisit, pattern.predictedIntervalDays) : null;
    const windowStartAt = pattern && predictionLastVisit ? addDays(predictionLastVisit, pattern.lowerIntervalDays) : null;
    const windowEndAt = pattern && predictionLastVisit ? addDays(predictionLastVisit, pattern.upperIntervalDays) : null;

    const daysSinceLastVisit = lastVisit ? Math.max(0, Math.floor(daysBetween(input.now, lastVisit))) : null;
    const daysUntilRiskWindowStart =
      windowStartAt && input.now < windowStartAt ? Math.ceil(daysBetween(windowStartAt, input.now)) : 0;

    const inRiskWindow = Boolean(windowStartAt && input.now >= windowStartAt);
    const overdue = Boolean(windowEndAt && input.now > windowEndAt);

    let riskScore = 20;
    if (segment === 'UNA_VISITA') {
      riskScore = (daysSinceLastVisit ?? 0) >= 21 ? 55 : 30;
    } else if (overdue) {
      riskScore = 95;
    } else if (inRiskWindow && windowStartAt && windowEndAt) {
      const totalWindow = Math.max(1, daysBetween(windowEndAt, windowStartAt));
      const progressed = clamp(daysBetween(input.now, windowStartAt) / totalWindow, 0, 1);
      riskScore = Math.round(70 + progressed * 20);
    } else if (windowStartAt) {
      const daysLeft = Math.ceil(daysBetween(windowStartAt, input.now));
      riskScore = daysLeft <= 2 ? 55 : daysLeft <= 7 ? 45 : 30;
    }

    return {
      customerId: customer.customerId,
      fullName: customer.fullName,
      phone: customer.phone,
      totalVisits,
      segment,
      dominantService: dominantService
        ? {
            serviceId: dominantService.serviceId,
            serviceName: dominantService.serviceName,
            visits: dominantService.dates.length,
          }
        : null,
      lastVisitAt: toIso(lastVisit),
      prediction: {
        nextVisitAt: toIso(nextVisitAt),
        windowStartAt: toIso(windowStartAt),
        windowEndAt: toIso(windowEndAt),
        confidencePct: pattern?.confidencePct ?? null,
        method,
        stats: pattern,
      },
      inRiskWindow,
      riskScore: clamp(riskScore, 0, 100),
      daysSinceLastVisit,
      daysUntilRiskWindowStart: daysUntilRiskWindowStart ?? null,
      recommendation: buildRecommendation({
        segment,
        name: customer.fullName,
        serviceName: dominantService?.serviceName ?? null,
        inRiskWindow,
        overdue,
      }),
      lastMessageSentAt: null,
      cooldownUntil: null,
      canSendWhatsapp: Boolean(customer.phone),
    };
  });
}

async function readTodaySnapshot(input: { tenantId: string; branchId: string; snapshotDate: string }) {
  const result = await db.query<{ payload: unknown }>(
    `
      SELECT payload
      FROM "LeadFinderDailySnapshot"
      WHERE "tenantId" = $1
        AND "branchId" = $2
        AND "snapshotDate" = $3::date
      LIMIT 1
    `,
    [input.tenantId, input.branchId, input.snapshotDate],
  );

  const row = result.rows[0];
  if (!row) return null;
  if (typeof row.payload === 'string') {
    try {
      return JSON.parse(row.payload) as LeadFinderAnalysisPayload;
    } catch {
      return null;
    }
  }
  return row.payload as LeadFinderAnalysisPayload;
}

async function upsertSnapshot(input: {
  tenantId: string;
  branchId: string;
  snapshotDate: string;
  payload: LeadFinderAnalysisPayload;
}) {
  await db.query(
    `
      INSERT INTO "LeadFinderDailySnapshot" (
        "id", "tenantId", "branchId", "snapshotDate", "payload", "computedAt", "updatedAt"
      )
      VALUES (
        gen_random_uuid()::text, $1, $2, $3::date, $4::jsonb, NOW(), NOW()
      )
      ON CONFLICT ("tenantId", "branchId", "snapshotDate")
      DO UPDATE SET
        "payload" = EXCLUDED."payload",
        "computedAt" = NOW(),
        "updatedAt" = NOW()
    `,
    [input.tenantId, input.branchId, input.snapshotDate, JSON.stringify(input.payload)],
  );
}

async function attachContactState(input: {
  tenantId: string;
  branchId: string;
  base: LeadFinderAnalysisPayload;
  whatsappConfigured: boolean;
}) {
  if (!input.base.customers.length) {
    return {
      ...input.base,
      branch: {
        ...input.base.branch,
        whatsappConfigured: input.whatsappConfigured,
      },
    };
  }

  const customerIds = input.base.customers.map((customer) => customer.customerId);
  const sentRes = await db.query<{ customerId: string; lastSentAt: Date }>(
    `
      SELECT
        "customerId",
        MAX("sentAt") as "lastSentAt"
      FROM "LeadFinderContactLog"
      WHERE "tenantId" = $1
        AND "branchId" = $2
        AND "customerId" = ANY($3::text[])
      GROUP BY "customerId"
    `,
    [input.tenantId, input.branchId, customerIds],
  );
  const sentByCustomer = new Map(sentRes.rows.map((row) => [row.customerId, row.lastSentAt]));
  const now = new Date();

  return {
    ...input.base,
    branch: {
      ...input.base.branch,
      whatsappConfigured: input.whatsappConfigured,
    },
    customers: input.base.customers.map((customer) => {
      const lastSentAt = sentByCustomer.get(customer.customerId) ?? null;
      const cooldownUntil = lastSentAt ? addDays(lastSentAt, COOLDOWN_DAYS) : null;
      const cooldownActive = Boolean(cooldownUntil && now < cooldownUntil);
      return {
        ...customer,
        lastMessageSentAt: toIso(lastSentAt),
        cooldownUntil: toIso(cooldownUntil),
        canSendWhatsapp:
          Boolean(customer.phone) &&
          input.whatsappConfigured &&
          customer.inRiskWindow &&
          !cooldownActive,
      };
    }),
  } satisfies LeadFinderAnalysisPayload;
}

async function computeFreshAnalysis(input: {
  tenantId: string;
  branchId: string;
  branchName: string;
  timeZone: string;
  snapshotDate: string;
}) {
  const rows = await getCompletedServiceRows({ tenantId: input.tenantId, branchId: input.branchId });
  const customersRaw = buildCustomerModels(rows);
  const now = new Date();
  const customers = buildCustomerPredictionModels({ customers: customersRaw, now }).sort((a, b) => {
    if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
    return (a.daysUntilRiskWindowStart ?? 9999) - (b.daysUntilRiskWindowStart ?? 9999);
  });

  return {
    computedAt: now.toISOString(),
    snapshotDate: input.snapshotDate,
    branch: {
      branchId: input.branchId,
      branchName: input.branchName,
      timeZone: input.timeZone,
      whatsappConfigured: false,
    },
    summary: {
      totalCustomers: customers.length,
      habitualCount: customers.filter((customer) => customer.segment === 'HABITUAL').length,
      almostHabitualCount: customers.filter((customer) => customer.segment === 'CASI_HABITUAL').length,
      oneVisitCount: customers.filter((customer) => customer.segment === 'UNA_VISITA').length,
      actionableNowCount: customers.filter((customer) => customer.inRiskWindow).length,
    },
    customers,
  } satisfies LeadFinderAnalysisPayload;
}

export async function getLeadFinderAnalysis(input: {
  userId: string;
  tenantId: string;
  branchId: string;
  forceRefresh?: boolean;
}) {
  await ensureLeadFinderTables();
  await assertLeadFinderBranchAccess(input);
  const branchConfig = await getBranchLeadFinderConfig({ tenantId: input.tenantId, branchId: input.branchId });
  const snapshotDate = getDateKeyInTimeZone(new Date(), branchConfig.timeZone);

  let base = !input.forceRefresh
    ? await readTodaySnapshot({ tenantId: input.tenantId, branchId: input.branchId, snapshotDate })
    : null;

  if (!base) {
    base = await computeFreshAnalysis({
      tenantId: input.tenantId,
      branchId: input.branchId,
      branchName: branchConfig.name,
      timeZone: branchConfig.timeZone,
      snapshotDate,
    });
    await upsertSnapshot({
      tenantId: input.tenantId,
      branchId: input.branchId,
      snapshotDate,
      payload: base,
    });
  }

  return attachContactState({
    tenantId: input.tenantId,
    branchId: input.branchId,
    base,
    whatsappConfigured: branchConfig.whatsappConfigured,
  });
}

function buildSendMessage(input: {
  customerName: string;
  serviceName: string | null;
  customMessage?: string | null;
}) {
  if (input.customMessage && input.customMessage.trim().length > 0) {
    return input.customMessage.trim();
  }
  const serviceText = input.serviceName ? ` para ${input.serviceName}` : '';
  return `Hola ${input.customerName}, vimos que podría ser un buen momento para volver${serviceText}. Si querés, te reservamos un turno.`;
}

export async function sendLeadFinderWhatsapp(input: {
  userId: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  serviceId?: string | null;
  serviceName?: string | null;
  message?: string | null;
}) {
  await ensureLeadFinderTables();
  await assertLeadFinderBranchAccess(input);
  const analysis = await getLeadFinderAnalysis({
    userId: input.userId,
    tenantId: input.tenantId,
    branchId: input.branchId,
  });
  const analysisCustomer = analysis.customers.find((customer) => customer.customerId === input.customerId);
  if (!analysisCustomer) {
    throw new Error('Cliente no encontrado en Lead Finder para esta sucursal');
  }
  if (!analysisCustomer.inRiskWindow) {
    throw new Error('El cliente todavía no está en la ventana de riesgo');
  }
  if (analysisCustomer.cooldownUntil && new Date() < new Date(analysisCustomer.cooldownUntil)) {
    throw new Error(`Cooldown activo hasta ${analysisCustomer.cooldownUntil}`);
  }

  const branchConfig = await getBranchLeadFinderConfig({ tenantId: input.tenantId, branchId: input.branchId });

  if (!branchConfig.whatsappConfigured || !branchConfig.whatsappConfig) {
    throw new Error('WhatsApp Business no está configurado en esta sucursal');
  }

  const customerRes = await db.query<{ id: string; fullName: string | null; phone: string | null }>(
    `
      SELECT id, "fullName", phone
      FROM "Customer"
      WHERE id = $1
        AND "tenantId" = $2
        AND "archivedAt" IS NULL
      LIMIT 1
    `,
    [input.customerId, input.tenantId],
  );
  const customer = customerRes.rows[0];
  if (!customer) {
    throw new Error('Cliente no encontrado');
  }

  const phone = ensureE164(customer.phone);
  if (!phone) {
    throw new Error('El cliente no tiene teléfono válido en formato E.164');
  }

  const lastSentRes = await db.query<{ lastSentAt: Date }>(
    `
      SELECT MAX("sentAt") as "lastSentAt"
      FROM "LeadFinderContactLog"
      WHERE "tenantId" = $1
        AND "branchId" = $2
        AND "customerId" = $3
    `,
    [input.tenantId, input.branchId, input.customerId],
  );
  const lastSentAt = lastSentRes.rows[0]?.lastSentAt ?? null;
  if (lastSentAt) {
    const cooldownUntil = addDays(lastSentAt, COOLDOWN_DAYS);
    if (new Date() < cooldownUntil) {
      throw new Error(`Cooldown activo hasta ${cooldownUntil.toISOString()}`);
    }
  }

  const fullName = customer.fullName?.trim() || 'Cliente';
  const messageBody = buildSendMessage({
    customerName: fullName,
    serviceName: input.serviceName ?? null,
    customMessage: input.message ?? null,
  });

  await sendWhatsappMessage({
    phone,
    text: messageBody,
    branchWhatsappConfig: branchConfig.whatsappConfig,
  });

  await db.query(
    `
      INSERT INTO "LeadFinderContactLog" (
        "id",
        "tenantId",
        "branchId",
        "customerId",
        "serviceId",
        "channel",
        "messageBody",
        "createdByUserId",
        "sentAt",
        "createdAt"
      )
      VALUES (
        gen_random_uuid()::text,
        $1, $2, $3, $4, 'WHATSAPP', $5, $6, NOW(), NOW()
      )
    `,
    [input.tenantId, input.branchId, input.customerId, input.serviceId ?? null, messageBody, input.userId],
  );

  return {
    customerId: input.customerId,
    sentAt: new Date().toISOString(),
    cooldownUntil: addDays(new Date(), COOLDOWN_DAYS).toISOString(),
  };
}
