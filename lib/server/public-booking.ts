import { db } from './db';
import { ensureCuentasTables } from './cuentas-data';
import { hasBranchWhatsappConfiguredBySlug } from './customer-accounts';

type Json = Record<string, unknown>;

function normalizeBaseUrl(raw?: string | null): string {
  const candidate = (raw ?? '').trim();
  if (!candidate) {
    return 'http://127.0.0.1:3001/v1';
  }

  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    return candidate.endsWith('/') ? candidate.slice(0, -1) : candidate;
  }

  const path = candidate.startsWith('/') ? candidate : `/${candidate}`;
  return `http://127.0.0.1:3001${path}`.replace(/\/+$/, '');
}

function getBackendBaseUrl() {
  return normalizeBaseUrl(process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL);
}

async function backendRequest<T>(path: string, init?: RequestInit): Promise<{ status: number; data: T }> {
  const base = getBackendBaseUrl();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : ({} as T);
  return { status: response.status, data: payload };
}

export async function ensurePublicBookingTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "TenantBookingPublicConfig" (
      "tenantId" TEXT PRIMARY KEY REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "maxAdvanceDays" INTEGER NOT NULL DEFAULT 30,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "TenantBookingPublicConfig_maxAdvanceDays_check" CHECK ("maxAdvanceDays" >= 1 AND "maxAdvanceDays" <= 180)
    )
  `);
}

async function getTenantMaxAdvanceDays(tenantId: string): Promise<number> {
  await ensurePublicBookingTables();

  const result = await db.query<{ maxAdvanceDays: number }>(
    `
      INSERT INTO "TenantBookingPublicConfig" ("tenantId")
      VALUES ($1)
      ON CONFLICT ("tenantId") DO NOTHING
    `,
    [tenantId],
  );
  void result;

  const row = await db.query<{ maxAdvanceDays: number }>(
    `SELECT "maxAdvanceDays" FROM "TenantBookingPublicConfig" WHERE "tenantId" = $1 LIMIT 1`,
    [tenantId],
  );

  return Number(row.rows[0]?.maxAdvanceDays ?? 30);
}

async function ensureTenantVisualTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "TenantVisualProfile" (
      "tenantId" TEXT PRIMARY KEY REFERENCES "Tenant"(id) ON DELETE CASCADE,
      "logoPhotoUrl" TEXT,
      "bannerPhotoUrl" TEXT,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getTenantBranches(tenantSlug: string) {
  await ensureTenantVisualTable();
  const remote = await backendRequest<{
    tenant?: { id: string; slug: string; name: string };
    branches?: Array<{ id: string; slug: string; name: string; allowChooseEmployee?: boolean; assignmentStrategy?: string }>;
    message?: string;
  }>(`/public/${encodeURIComponent(tenantSlug)}/branches`);

  if (remote.status >= 400) {
    return { status: remote.status, payload: remote.data };
  }

  const tenant = remote.data.tenant;
  if (!tenant) {
    return { status: 404, payload: { message: 'Tenant no encontrado' } };
  }

  const branchIds = Array.isArray(remote.data.branches) ? remote.data.branches.map((branch) => branch.id) : [];
  const profiles = branchIds.length
    ? await db.query<{
        branchId: string;
        profilePhotoUrl: string | null;
        bannerPhotoUrl: string | null;
      }>(
        `
          SELECT "branchId", "profilePhotoUrl", "bannerPhotoUrl"
          FROM "BranchProfile"
          WHERE "branchId" = ANY($1::text[])
        `,
        [branchIds],
      )
    : { rows: [] as Array<{ branchId: string; profilePhotoUrl: string | null; bannerPhotoUrl: string | null }> };

  const profileMap = new Map(profiles.rows.map((row) => [row.branchId, row]));
  const maxAdvanceDays = await getTenantMaxAdvanceDays(tenant.id);
  const tenantVisualRes = await db.query<{ logoPhotoUrl: string | null; bannerPhotoUrl: string | null }>(
    `
      SELECT "logoPhotoUrl", "bannerPhotoUrl"
      FROM "TenantVisualProfile"
      WHERE "tenantId" = $1
      LIMIT 1
    `,
    [tenant.id],
  );
  const tenantVisual = tenantVisualRes.rows[0] ?? { logoPhotoUrl: null, bannerPhotoUrl: null };

  return {
    status: 200,
    payload: {
      tenant: {
        ...tenant,
        logoPhotoUrl: tenantVisual.logoPhotoUrl,
        bannerPhotoUrl: tenantVisual.bannerPhotoUrl,
      },
      maxAdvanceDays,
      branches: (remote.data.branches ?? []).map((branch) => ({
        ...branch,
        profilePhotoUrl: profileMap.get(branch.id)?.profilePhotoUrl ?? null,
        bannerPhotoUrl: profileMap.get(branch.id)?.bannerPhotoUrl ?? null,
      })),
    },
  };
}

export async function getBranchCatalog(tenantSlug: string, branchSlug: string) {
  await ensureTenantVisualTable();
  await ensureCuentasTables();

  const [servicesResponse, employeesResponse, branchesResponse] = await Promise.all([
    backendRequest<{
      branch?: { id: string; name: string; slug: string };
      services?: Array<{
        id: string;
        name: string;
        durationMins: number;
        priceCents: number;
        isActive: boolean;
        category?: { id: string; name: string; sortOrder?: number } | null;
      }>;
      message?: string;
    }>(`/public/${encodeURIComponent(tenantSlug)}/branches/${encodeURIComponent(branchSlug)}/services`),
    backendRequest<{
      branch?: { id: string; name: string; slug: string };
      employees?: Array<{
        id: string;
        fullName: string;
        isActive: boolean;
        ratingAvg?: number;
        ratingCount?: number;
        services?: Array<{ id: string; name: string }>;
      }>;
      message?: string;
    }>(`/public/${encodeURIComponent(tenantSlug)}/branches/${encodeURIComponent(branchSlug)}/employees`),
    backendRequest<{
      tenant?: { id: string; slug: string; name: string };
      branches?: Array<{ id: string; slug: string; name: string; allowChooseEmployee?: boolean; assignmentStrategy?: string }>;
      message?: string;
    }>(`/public/${encodeURIComponent(tenantSlug)}/branches`),
  ]);

  if (servicesResponse.status >= 400) {
    return { status: servicesResponse.status, payload: servicesResponse.data };
  }

  if (employeesResponse.status >= 400) {
    return { status: employeesResponse.status, payload: employeesResponse.data };
  }

  if (branchesResponse.status >= 400) {
    return { status: branchesResponse.status, payload: branchesResponse.data };
  }

  const branch = servicesResponse.data.branch;
  const tenant = branchesResponse.data.tenant;
  if (!branch || !tenant) {
    return { status: 404, payload: { message: 'Sucursal no encontrada' } };
  }

  const branchFromList = (branchesResponse.data.branches ?? []).find((item) => item.slug === branch.slug);
  const maxAdvanceDays = await getTenantMaxAdvanceDays(tenant.id);
  const hasWhatsappConfigured = await hasBranchWhatsappConfiguredBySlug({ tenantSlug, branchSlug });

  const branchRow = await db.query<{
    id: string;
    timeZone: string;
    address: string | null;
    phone: string | null;
    showServicePrices: boolean | null;
    policyText: string | null;
    cancellationEnabled: boolean;
    depositType: 'NONE' | 'PERCENTAGE' | 'FIXED';
    depositAmount: number;
    publicNote: string | null;
    profilePhotoUrl: string | null;
    bannerPhotoUrl: string | null;
    carouselPhotoUrls: unknown;
  }>(
    `
      SELECT
        b.id,
        b."timeZone",
        p."address",
        p."phone",
        p."showServicePrices",
        p."policyText",
        p."cancellationEnabled",
        p."depositType",
        p."depositAmount",
        p."publicNote",
        p."profilePhotoUrl",
        p."bannerPhotoUrl",
        p."carouselPhotoUrls"
      FROM "Branch" b
      LEFT JOIN "BranchProfile" p ON p."branchId" = b.id
      WHERE b.id = $1
      LIMIT 1
    `,
    [branch.id],
  );

  const branchConfig = branchRow.rows[0];
  const tenantVisualRes = await db.query<{ logoPhotoUrl: string | null; bannerPhotoUrl: string | null }>(
    `
      SELECT "logoPhotoUrl", "bannerPhotoUrl"
      FROM "TenantVisualProfile"
      WHERE "tenantId" = $1
      LIMIT 1
    `,
    [tenant.id],
  );
  const tenantVisual = tenantVisualRes.rows[0] ?? { logoPhotoUrl: null, bannerPhotoUrl: null };
  const services = (servicesResponse.data.services ?? []).filter((service) => service.isActive !== false);

  const localEmployeesRes = await db.query<{
    id: string;
    fullName: string;
    isActive: boolean;
    ratingAvg: number | null;
    ratingCount: number;
  }>(
    `
      SELECT
        e.id,
        e."fullName",
        e."isActive",
        COALESCE(AVG(r.score), 0)::float as "ratingAvg",
        COUNT(r.id)::int as "ratingCount"
      FROM "Employee" e
      LEFT JOIN "Rating" r ON r."employeeId" = e.id
      WHERE e."tenantId" = $1
        AND e."branchId" = $2
      GROUP BY e.id
      ORDER BY e."fullName" ASC
    `,
    [tenant.id, branch.id],
  );

  const localEmployeeIds = localEmployeesRes.rows.map((row) => row.id);
  const localAssignmentsRes = localEmployeeIds.length
    ? await db.query<{ employeeId: string; serviceId: string; serviceName: string }>(
        `
          SELECT
            sa."employeeId",
            s.id as "serviceId",
            s.name as "serviceName"
          FROM "ServiceAssignment" sa
          INNER JOIN "Service" s
            ON s.id = sa."serviceId"
          WHERE sa."employeeId" = ANY($1::text[])
            AND s."tenantId" = $2
            AND s."branchId" = $3
            AND s."isActive" = TRUE
        `,
        [localEmployeeIds, tenant.id, branch.id],
      )
    : { rows: [] as Array<{ employeeId: string; serviceId: string; serviceName: string }> };

  const localServicesByEmployee = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of localAssignmentsRes.rows) {
    const current = localServicesByEmployee.get(row.employeeId) ?? [];
    current.push({ id: row.serviceId, name: row.serviceName });
    localServicesByEmployee.set(row.employeeId, current);
  }

  const mergedEmployees = new Map<
    string,
    {
      id: string;
      fullName: string;
      isActive: boolean;
      ratingAvg?: number;
      ratingCount?: number;
      services?: Array<{ id: string; name: string }>;
    }
  >();

  for (const row of localEmployeesRes.rows) {
    mergedEmployees.set(row.id, {
      id: row.id,
      fullName: row.fullName,
      isActive: Boolean(row.isActive),
      ratingAvg: Number(row.ratingAvg ?? 0),
      ratingCount: Number(row.ratingCount ?? 0),
      services: localServicesByEmployee.get(row.id) ?? [],
    });
  }

  for (const employee of employeesResponse.data.employees ?? []) {
    const existing = mergedEmployees.get(employee.id);
    mergedEmployees.set(employee.id, {
      id: employee.id,
      fullName: employee.fullName || existing?.fullName || 'Trabajadora',
      isActive: employee.isActive ?? existing?.isActive ?? true,
      ratingAvg: employee.ratingAvg ?? existing?.ratingAvg ?? 0,
      ratingCount: employee.ratingCount ?? existing?.ratingCount ?? 0,
      services:
        employee.services && employee.services.length
          ? employee.services
          : existing?.services ?? localServicesByEmployee.get(employee.id) ?? [],
    });
  }

  const rawEmployees = Array.from(mergedEmployees.values()).filter((employee) => employee.isActive !== false);
  const rawEmployeeIds = rawEmployees.map((employee) => employee.id);

  const linkedEmployees = rawEmployeeIds.length
    ? await db.query<{
        employeeId: string;
        role: string;
        fullName: string | null;
        instagram: string | null;
        bio: string | null;
      }>(
        `
          SELECT
            e.id as "employeeId",
            COALESCE(m.role::text, 'EMPLOYEE') as role,
            COALESCE(NULLIF(u."fullName", ''), NULLIF(e."fullName", ''), 'Trabajadora') as "fullName",
            sp.instagram,
            sp.bio
          FROM "Employee" e
          LEFT JOIN "Membership" m ON m.id = e."membershipId" AND m."tenantId" = e."tenantId"
          LEFT JOIN "User" u ON u.id = m."userId"
          LEFT JOIN "StaffProfile" sp ON sp."membershipId" = m.id
          WHERE e.id = ANY($1::text[])
            AND e."tenantId" = $2
            AND e."branchId" = $3
            AND e."isActive" = TRUE
        `,
        [rawEmployeeIds, tenant.id, branch.id],
      )
    : { rows: [] as Array<{ employeeId: string; role: string; fullName: string | null; instagram: string | null; bio: string | null }> };

  const linkedEmployeeMap = new Map(linkedEmployees.rows.map((row) => [row.employeeId, row]));
  const employees = rawEmployees
    .filter((employee) => linkedEmployeeMap.has(employee.id))
    .map((employee) => {
      const linked = linkedEmployeeMap.get(employee.id)!;
      return {
        ...employee,
        fullName: linked.fullName ?? employee.fullName,
        role: linked.role,
        profile: {
          instagram: linked.instagram ?? null,
          bio: linked.bio ?? null,
        },
      };
    });

  return {
    status: 200,
    payload: {
      tenant: {
        ...tenant,
        logoPhotoUrl: tenantVisual.logoPhotoUrl,
        bannerPhotoUrl: tenantVisual.bannerPhotoUrl,
      },
      branch: {
        ...branch,
        timeZone: branchConfig?.timeZone ?? 'America/Argentina/Buenos_Aires',
        allowChooseEmployee: Boolean(branchFromList?.allowChooseEmployee),
        assignmentStrategy: String(branchFromList?.assignmentStrategy ?? 'ROTATIVE'),
      },
      maxAdvanceDays,
      requiresCustomerAuth: hasWhatsappConfigured,
      profile: {
        address: branchConfig?.address ?? null,
        phone: branchConfig?.phone ?? null,
        showServicePrices: branchConfig?.showServicePrices ?? true,
        policyText: branchConfig?.policyText ?? null,
        cancellationEnabled: Boolean(branchConfig?.cancellationEnabled),
        depositType: branchConfig?.depositType ?? 'NONE',
        depositAmount: Number(branchConfig?.depositAmount ?? 0),
        publicNote: branchConfig?.publicNote ?? null,
        profilePhotoUrl: branchConfig?.profilePhotoUrl ?? null,
        bannerPhotoUrl: branchConfig?.bannerPhotoUrl ?? null,
        carouselPhotoUrls: parseJsonStringArray(branchConfig?.carouselPhotoUrls),
      },
      services,
      employees,
    },
  };
}

export async function getAvailability(input: {
  tenantSlug: string;
  branchSlug: string;
  date: string;
  serviceIds: string[];
  employeeId?: string;
}) {
  const params = new URLSearchParams();
  params.set('date', input.date);
  params.set('serviceIds', input.serviceIds.join(','));
  if (input.employeeId) {
    params.set('employeeId', input.employeeId);
  }

  const remote = await backendRequest<{
    branch?: Json;
    date?: string;
    durationMins?: number;
    slots?: Array<{
      startsAt: string;
      employeeIds: string[];
      employees: Array<{ id: string; fullName: string }>;
    }>;
    message?: string;
  }>(`/public/${encodeURIComponent(input.tenantSlug)}/branches/${encodeURIComponent(input.branchSlug)}/availability?${params.toString()}`);

  return { status: remote.status, payload: remote.data };
}

export async function createPublicAppointment(input: {
  tenantSlug: string;
  branchSlug: string;
  serviceIds: string[];
  startsAt: string;
  employeeId?: string;
  customer: {
    fullName: string;
    phone: string;
  };
}) {
  const remote = await backendRequest<{
    appointment?: Json;
    message?: string | string[];
    error?: string;
    statusCode?: number;
  }>(`/public/${encodeURIComponent(input.tenantSlug)}/branches/${encodeURIComponent(input.branchSlug)}/appointments`, {
    method: 'POST',
    body: JSON.stringify({
      serviceIds: input.serviceIds,
      startsAt: input.startsAt,
      employeeId: input.employeeId,
      customer: input.customer,
    }),
  });

  return { status: remote.status, payload: remote.data };
}

function parseJsonStringArray(raw: unknown): string[] {
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
