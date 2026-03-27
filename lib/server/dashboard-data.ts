import { db } from './db';
import { ensureGastosTables } from './gastos-data';
import { assertTenantAccess, listCalendarBranchesForUser } from './reservas-data';

type DashboardMode = 'MONTHLY' | 'YEARLY';

type DashboardInput = {
  userId: string;
  tenantId: string;
  mode: DashboardMode;
  month?: string;
  year?: number;
  branchIds?: string[];
  employeeId?: string;
};

type PeriodRange = {
  start: Date;
  end: Date;
  year: number;
  monthIndex?: number;
  mode: DashboardMode;
};

type AppointmentRow = {
  appointmentId: string;
  status: string;
  createdBy: string;
  startsAt: Date;
  totalChargedCents: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  employeeId: string;
  employeeName: string;
  lineId: string | null;
  lineServiceId: string | null;
  serviceName: string | null;
  linePriceCents: number | null;
};

type ProductSaleRow = {
  saleId: string;
  soldAt: Date;
  productId: string | null;
  productName: string;
  employeeId: string | null;
  quantity: number;
  totalPriceCents: number;
};

type RatingRow = {
  id: string;
  score: number;
  employeeId: string;
  appointmentId: string;
};

type ExpenseRow = {
  id: string;
  name: string;
  amountPreTaxCents: number;
  isFixed: boolean;
  recurrence: 'ONE_TIME' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | string;
  createdAt: Date;
};

type ExpenseServiceLinkRow = {
  expenseId: string;
  serviceId: string;
};

type ExpenseProductLinkRow = {
  expenseId: string;
  productId: string;
};

type AggregatedPeriodData = {
  metrics: {
    servicesRealizados: number;
    facturacionCents: number;
    ticketPromedioCents: number;
    calificacionPromedio: number | null;
    revenueReservasCents: number;
    revenueWalkinsCents: number;
    revenueProductosCents: number;
    revenueTotalCents: number;
    gastosVariablesCents: number;
    gastosFijosCents: number;
    margenContribucionCents: number;
    resultadoOperativoCents: number;
    rentabilidadPct: number | null;
    cancelacionesCount: number;
    noShowEstimadoCount: number;
    perdidaCancelacionesCents: number;
    perdidaNoShowEstimadaCents: number;
  };
  charts: {
    trend: Array<{
      key: string;
      servicios: number;
      facturacionCents: number;
      facturacion: number;
    }>;
    financialTrend: Array<{
      key: string;
      ingresosCents: number;
      gastosVariablesCents: number;
      gastosFijosCents: number;
      resultadoCents: number;
    }>;
    reservasVsWalkin: Array<{ name: string; value: number }>;
    revenueSources: Array<{ name: string; valueCents: number }>;
    expenseSources: Array<{ name: string; valueCents: number }>;
    serviciosTop: Array<{ name: string; value: number }>;
    serviciosRentablesTop: Array<{
      serviceId: string | null;
      name: string;
      quantity: number;
      revenueCents: number;
      variableCostCents: number;
      profitCents: number;
      marginPct: number | null;
    }>;
    productosRentablesTop: Array<{
      productId: string | null;
      name: string;
      quantity: number;
      revenueCents: number;
      variableCostCents: number;
      profitCents: number;
      marginPct: number | null;
    }>;
    rendimientoEmpleados: Array<{
      employeeId: string;
      employeeName: string;
      appointments: number;
      services: number;
      facturacionCents: number;
      facturacion: number;
      variableCostCents: number;
      profitCents: number;
      ratingAvg: number | null;
    }>;
  };
  tables: {
    topClientes: Array<{
      name: string;
      phone: string | null;
      visits: number;
      totalCents: number;
    }>;
  };
};

function safeInt(input: string | null | undefined, fallback: number) {
  const value = Number(input);
  return Number.isInteger(value) ? value : fallback;
}

function formatMoney(cents: number) {
  return Number((Number(cents || 0) / 100).toFixed(2));
}

function dayKeyUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKeyUtc(date: Date) {
  return date.toISOString().slice(0, 7);
}

function listPeriodKeys(period: PeriodRange) {
  const keys: string[] = [];
  if (period.mode === 'YEARLY') {
    for (let month = 0; month < 12; month += 1) {
      keys.push(`${period.year}-${String(month + 1).padStart(2, '0')}`);
    }
    return keys;
  }

  const cursor = new Date(period.start);
  while (cursor < period.end) {
    keys.push(dayKeyUtc(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function keyForDate(period: PeriodRange, date: Date) {
  return period.mode === 'YEARLY' ? monthKeyUtc(date) : dayKeyUtc(date);
}

function monthRange(month: string, offset = 0): PeriodRange {
  const [yearRaw, monthRaw] = month.split('-');
  const year = safeInt(yearRaw, new Date().getUTCFullYear());
  const monthIndex = Math.min(11, Math.max(0, safeInt(monthRaw, 1) - 1));
  const cursor = new Date(Date.UTC(year, monthIndex + offset, 1, 0, 0, 0));
  const start = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 0, 0, 0));
  return { start, end, year: start.getUTCFullYear(), monthIndex: start.getUTCMonth(), mode: 'MONTHLY' };
}

function yearRange(year: number, offset = 0): PeriodRange {
  const validYear = Math.min(2100, Math.max(2020, year + offset));
  const start = new Date(Date.UTC(validYear, 0, 1, 0, 0, 0));
  const end = new Date(Date.UTC(validYear + 1, 0, 1, 0, 0, 0));
  return { start, end, year: validYear, mode: 'YEARLY' };
}

function percentageDelta(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}

function computeAppointmentRevenue(appointment: {
  services: Array<{ priceCents: number }>;
  totalChargedCents: number;
}) {
  const linesTotal = appointment.services.reduce((sum, service) => sum + Number(service.priceCents || 0), 0);
  return linesTotal > 0 ? linesTotal : Number(appointment.totalChargedCents || 0);
}

function estimateExpenseForPeriod(expense: ExpenseRow, period: PeriodRange) {
  const amount = Number(expense.amountPreTaxCents || 0);
  const dayCount = Math.max(1, Math.round((period.end.getTime() - period.start.getTime()) / 86_400_000));

  switch (expense.recurrence) {
    case 'ONE_TIME':
      return expense.createdAt >= period.start && expense.createdAt < period.end ? amount : 0;
    case 'WEEKLY':
      return Math.round(amount * (dayCount / 7));
    case 'YEARLY':
      return period.mode === 'YEARLY' ? amount : Math.round(amount / 12);
    case 'MONTHLY':
    default:
      return period.mode === 'YEARLY' ? amount * 12 : amount;
  }
}

async function loadExpensesForTenantBranches(input: { tenantId: string; branchIds: string[] }) {
  await ensureGastosTables();
  const expensesRes = await db.query<ExpenseRow>(
    `
      SELECT
        id,
        name,
        "amountPreTaxCents",
        "isFixed",
        recurrence,
        "createdAt"
      FROM "BranchExpense"
      WHERE "tenantId" = $1
        AND "branchId" = ANY($2::text[])
        AND "isActive" = TRUE
    `,
    [input.tenantId, input.branchIds],
  );

  const expenseIds = expensesRes.rows.map((row) => row.id);
  if (!expenseIds.length) {
    return {
      expenses: [] as ExpenseRow[],
      serviceLinks: [] as ExpenseServiceLinkRow[],
      productLinks: [] as ExpenseProductLinkRow[],
    };
  }

  const [serviceLinksRes, productLinksRes] = await Promise.all([
    db.query<ExpenseServiceLinkRow>(
      `
        SELECT "expenseId", "serviceId"
        FROM "BranchExpenseServiceLink"
        WHERE "expenseId" = ANY($1::text[])
      `,
      [expenseIds],
    ),
    db.query<ExpenseProductLinkRow>(
      `
        SELECT "expenseId", "productId"
        FROM "BranchExpenseProductLink"
        WHERE "expenseId" = ANY($1::text[])
      `,
      [expenseIds],
    ),
  ]);

  return {
    expenses: expensesRes.rows,
    serviceLinks: serviceLinksRes.rows,
    productLinks: productLinksRes.rows,
  };
}

async function loadPeriodAppointments(input: {
  tenantId: string;
  branchIds: string[];
  period: PeriodRange;
  employeeId: string | null;
}) {
  const appointmentWhereEmployee = input.employeeId ? 'AND a."employeeId" = $5' : '';
  const appointmentParams = input.employeeId
    ? [input.tenantId, input.branchIds, input.period.start.toISOString(), input.period.end.toISOString(), input.employeeId]
    : [input.tenantId, input.branchIds, input.period.start.toISOString(), input.period.end.toISOString()];

  const appointmentsRes = await db.query<AppointmentRow>(
    `
      SELECT
        a.id as "appointmentId",
        a.status::text as status,
        a."createdBy"::text as "createdBy",
        a."startsAt",
        a."totalChargedCents",
        a."customerId",
        c."fullName" as "customerName",
        c.phone as "customerPhone",
        e.id as "employeeId",
        e."fullName" as "employeeName",
        l.id as "lineId",
        l."serviceId" as "lineServiceId",
        l."serviceNameSnapshot" as "serviceName",
        l."priceCents" as "linePriceCents"
      FROM "Appointment" a
      INNER JOIN "Employee" e ON e.id = a."employeeId"
      LEFT JOIN "Customer" c ON c.id = a."customerId" AND c."archivedAt" IS NULL
      LEFT JOIN "AppointmentLine" l ON l."appointmentId" = a.id
      WHERE a."tenantId" = $1
        AND a."branchId" = ANY($2::text[])
        AND a."startsAt" >= $3::timestamptz
        AND a."startsAt" < $4::timestamptz
        AND (a."customerId" IS NULL OR COALESCE(c."isTest", FALSE) = FALSE)
        ${appointmentWhereEmployee}
      ORDER BY a."startsAt" ASC
    `,
    appointmentParams,
  );

  let ratingsRows: RatingRow[] = [];
  try {
    const ratingsWhereEmployee = input.employeeId ? 'AND r."employeeId" = $5' : '';
    const ratingsParams = input.employeeId
      ? [input.tenantId, input.branchIds, input.period.start.toISOString(), input.period.end.toISOString(), input.employeeId]
      : [input.tenantId, input.branchIds, input.period.start.toISOString(), input.period.end.toISOString()];

    const ratingsRes = await db.query<RatingRow>(
      `
        SELECT r.id, r.score, r."employeeId", r."appointmentId"
        FROM "Rating" r
        INNER JOIN "Appointment" a ON a.id = r."appointmentId"
        WHERE a."tenantId" = $1
          AND a."branchId" = ANY($2::text[])
          AND a."startsAt" >= $3::timestamptz
          AND a."startsAt" < $4::timestamptz
          ${ratingsWhereEmployee}
      `,
      ratingsParams,
    );
    ratingsRows = ratingsRes.rows;
  } catch {
    ratingsRows = [];
  }

  const productSalesWhereEmployee = input.employeeId ? 'AND psl."employeeId" = $5' : '';
  const productSalesParams = input.employeeId
    ? [input.tenantId, input.branchIds, input.period.start.toISOString(), input.period.end.toISOString(), input.employeeId]
    : [input.tenantId, input.branchIds, input.period.start.toISOString(), input.period.end.toISOString()];

  const productSalesRes = await db.query<ProductSaleRow>(
    `
      SELECT
        ps.id as "saleId",
        ps."createdAt" as "soldAt",
        psl."productId",
        COALESCE(bp.name, psl.description, 'Producto') as "productName",
        psl."employeeId",
        psl.quantity,
        psl."totalPriceCents"
      FROM "PosSale" ps
      INNER JOIN "PosSaleLine" psl ON psl."saleId" = ps.id
      LEFT JOIN "BranchProduct" bp ON bp.id = psl."productId"
      WHERE ps."tenantId" = $1
        AND ps."branchId" = ANY($2::text[])
        AND ps."createdAt" >= $3::timestamptz
        AND ps."createdAt" < $4::timestamptz
        AND ps.status = 'PAID'
        AND psl."lineType" = 'PRODUCT'
        ${productSalesWhereEmployee}
    `,
    productSalesParams,
  );

  return {
    appointmentRows: appointmentsRes.rows,
    ratingsRows,
    productSalesRows: productSalesRes.rows,
  };
}

function aggregatePeriodData(input: {
  period: PeriodRange;
  appointmentRows: AppointmentRow[];
  ratingsRows: RatingRow[];
  productSalesRows: ProductSaleRow[];
  expenses: ExpenseRow[];
  serviceLinks: ExpenseServiceLinkRow[];
  productLinks: ExpenseProductLinkRow[];
}) {
  const appointmentMap = new Map<
    string,
    {
      id: string;
      status: string;
      createdBy: string;
      startsAt: Date;
      totalChargedCents: number;
      customerId: string | null;
      customerName: string | null;
      customerPhone: string | null;
      employeeId: string;
      employeeName: string;
      services: Array<{ serviceId: string | null; name: string; priceCents: number }>;
    }
  >();

  for (const row of input.appointmentRows) {
    const existing = appointmentMap.get(row.appointmentId);
    if (!existing) {
      appointmentMap.set(row.appointmentId, {
        id: row.appointmentId,
        status: row.status,
        createdBy: row.createdBy,
        startsAt: row.startsAt,
        totalChargedCents: Number(row.totalChargedCents ?? 0),
        customerId: row.customerId,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        services: row.serviceName
          ? [{ serviceId: row.lineServiceId, name: row.serviceName, priceCents: Number(row.linePriceCents ?? 0) }]
          : [],
      });
      continue;
    }

    if (row.serviceName) {
      existing.services.push({
        serviceId: row.lineServiceId,
        name: row.serviceName,
        priceCents: Number(row.linePriceCents ?? 0),
      });
    }
  }

  const allAppointments = Array.from(appointmentMap.values());
  const cancelledAppointments = allAppointments.filter((appointment) => appointment.status === 'CANCELLED');
  const noShowEstimatedAppointments = allAppointments.filter((appointment) =>
    appointment.startsAt < new Date() && (appointment.status === 'PENDING' || appointment.status === 'CONFIRMED'),
  );
  const nonCancelled = allAppointments.filter((appointment) => appointment.status !== 'CANCELLED');

  const servicesRealizados = nonCancelled.reduce((sum, appointment) => sum + appointment.services.length, 0);
  const facturacionCents = nonCancelled.reduce((sum, appointment) => sum + computeAppointmentRevenue(appointment), 0);
  const ticketPromedioCents = nonCancelled.length ? Math.round(facturacionCents / nonCancelled.length) : 0;

  const calificacionPromedio = input.ratingsRows.length
    ? Number((input.ratingsRows.reduce((sum, row) => sum + Number(row.score || 0), 0) / input.ratingsRows.length).toFixed(2))
    : null;

  const reservasCount = nonCancelled.filter((appointment) => appointment.createdBy === 'CUSTOMER').length;
  const walkinsCount = nonCancelled.filter((appointment) => appointment.createdBy === 'STAFF').length;

  let revenueReservasCents = 0;
  let revenueWalkinsCents = 0;
  for (const appointment of nonCancelled) {
    const revenue = computeAppointmentRevenue(appointment);
    if (appointment.createdBy === 'CUSTOMER') revenueReservasCents += revenue;
    else revenueWalkinsCents += revenue;
  }

  const revenueProductosCents = input.productSalesRows.reduce((sum, row) => sum + Number(row.totalPriceCents || 0), 0);
  const revenueTotalCents = facturacionCents + revenueProductosCents;

  const serviceTopCounter = new Map<string, number>();
  const serviceProfitMap = new Map<
    string,
    {
      serviceId: string | null;
      name: string;
      quantity: number;
      revenueCents: number;
      variableCostCents: number;
      profitCents: number;
      marginPct: number | null;
    }
  >();

  for (const appointment of nonCancelled) {
    for (const service of appointment.services) {
      serviceTopCounter.set(service.name, (serviceTopCounter.get(service.name) ?? 0) + 1);
      const key = service.serviceId ? `id:${service.serviceId}` : `name:${service.name}`;
      const current = serviceProfitMap.get(key) ?? {
        serviceId: service.serviceId,
        name: service.name,
        quantity: 0,
        revenueCents: 0,
        variableCostCents: 0,
        profitCents: 0,
        marginPct: null,
      };
      current.quantity += 1;
      current.revenueCents += Number(service.priceCents || 0);
      serviceProfitMap.set(key, current);
    }
  }

  const productProfitMap = new Map<
    string,
    {
      productId: string | null;
      name: string;
      quantity: number;
      revenueCents: number;
      variableCostCents: number;
      profitCents: number;
      marginPct: number | null;
    }
  >();

  for (const row of input.productSalesRows) {
    const key = row.productId ? `id:${row.productId}` : `name:${row.productName}`;
    const current = productProfitMap.get(key) ?? {
      productId: row.productId,
      name: row.productName,
      quantity: 0,
      revenueCents: 0,
      variableCostCents: 0,
      profitCents: 0,
      marginPct: null,
    };
    current.quantity += Number(row.quantity || 0);
    current.revenueCents += Number(row.totalPriceCents || 0);
    productProfitMap.set(key, current);
  }

  const servicesByExpense = new Map<string, string[]>();
  for (const row of input.serviceLinks) {
    const current = servicesByExpense.get(row.expenseId) ?? [];
    current.push(row.serviceId);
    servicesByExpense.set(row.expenseId, current);
  }

  const productsByExpense = new Map<string, string[]>();
  for (const row of input.productLinks) {
    const current = productsByExpense.get(row.expenseId) ?? [];
    current.push(row.productId);
    productsByExpense.set(row.expenseId, current);
  }

  let gastosFijosCents = 0;
  let gastosVariablesCents = 0;
  const variableServiceCostPool = new Map<string, number>();
  const variableProductCostPool = new Map<string, number>();

  for (const expense of input.expenses) {
    const periodCost = estimateExpenseForPeriod(expense, input.period);
    if (periodCost <= 0) continue;

    if (expense.isFixed) {
      gastosFijosCents += periodCost;
      continue;
    }

    gastosVariablesCents += periodCost;
    const linkedServices = servicesByExpense.get(expense.id) ?? [];
    const linkedProducts = productsByExpense.get(expense.id) ?? [];
    const totalLinks = linkedServices.length + linkedProducts.length;
    if (totalLinks <= 0) continue;

    const unit = periodCost / totalLinks;
    for (const serviceId of linkedServices) {
      variableServiceCostPool.set(serviceId, (variableServiceCostPool.get(serviceId) ?? 0) + unit);
    }
    for (const productId of linkedProducts) {
      variableProductCostPool.set(productId, (variableProductCostPool.get(productId) ?? 0) + unit);
    }
  }

  for (const row of serviceProfitMap.values()) {
    const variableCost = row.serviceId ? Math.round(variableServiceCostPool.get(row.serviceId) ?? 0) : 0;
    row.variableCostCents = variableCost;
    row.profitCents = row.revenueCents - variableCost;
    row.marginPct = row.revenueCents > 0 ? Number(((row.profitCents / row.revenueCents) * 100).toFixed(1)) : null;
  }

  for (const row of productProfitMap.values()) {
    const variableCost = row.productId ? Math.round(variableProductCostPool.get(row.productId) ?? 0) : 0;
    row.variableCostCents = variableCost;
    row.profitCents = row.revenueCents - variableCost;
    row.marginPct = row.revenueCents > 0 ? Number(((row.profitCents / row.revenueCents) * 100).toFixed(1)) : null;
  }

  const ratingsByEmployee = new Map<string, { sum: number; count: number }>();
  for (const rating of input.ratingsRows) {
    const current = ratingsByEmployee.get(rating.employeeId) ?? { sum: 0, count: 0 };
    current.sum += Number(rating.score || 0);
    current.count += 1;
    ratingsByEmployee.set(rating.employeeId, current);
  }

  const employeePerformanceMap = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      appointments: number;
      services: number;
      facturacionCents: number;
    }
  >();

  for (const appointment of nonCancelled) {
    const current = employeePerformanceMap.get(appointment.employeeId) ?? {
      employeeId: appointment.employeeId,
      employeeName: appointment.employeeName,
      appointments: 0,
      services: 0,
      facturacionCents: 0,
    };
    current.appointments += 1;
    current.services += appointment.services.length;
    current.facturacionCents += computeAppointmentRevenue(appointment);
    employeePerformanceMap.set(appointment.employeeId, current);
  }

  for (const product of input.productSalesRows) {
    if (!product.employeeId) continue;
    const current = employeePerformanceMap.get(product.employeeId);
    if (!current) continue;
    current.facturacionCents += Number(product.totalPriceCents || 0);
  }

  const totalServiceVariableCosts = Array.from(serviceProfitMap.values()).reduce((sum, row) => sum + row.variableCostCents, 0);
  const totalProductVariableCosts = Array.from(productProfitMap.values()).reduce((sum, row) => sum + row.variableCostCents, 0);
  const totalDistributableRevenue = Math.max(1, facturacionCents + revenueProductosCents);

  const rendimientoEmpleados = Array.from(employeePerformanceMap.values())
    .map((row) => {
      const revenueShare = row.facturacionCents / totalDistributableRevenue;
      const variableCostCents = Math.round((totalServiceVariableCosts + totalProductVariableCosts) * revenueShare);
      const ratings = ratingsByEmployee.get(row.employeeId);
      return {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        appointments: row.appointments,
        services: row.services,
        facturacionCents: row.facturacionCents,
        facturacion: formatMoney(row.facturacionCents),
        variableCostCents,
        profitCents: row.facturacionCents - variableCostCents,
        ratingAvg: ratings?.count ? Number((ratings.sum / ratings.count).toFixed(2)) : null,
      };
    })
    .sort((a, b) => b.facturacionCents - a.facturacionCents);

  const customerMap = new Map<
    string,
    {
      name: string;
      phone: string | null;
      totalCents: number;
      visits: number;
    }
  >();

  for (const appointment of nonCancelled) {
    const key = appointment.customerId || `guest:${appointment.customerPhone || appointment.customerName || appointment.id}`;
    const current = customerMap.get(key) ?? {
      name: appointment.customerName || 'Cliente',
      phone: appointment.customerPhone,
      totalCents: 0,
      visits: 0,
    };
    current.totalCents += computeAppointmentRevenue(appointment);
    current.visits += 1;
    customerMap.set(key, current);
  }

  const topClientes = Array.from(customerMap.values())
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 10)
    .map((row) => ({
      name: row.name,
      phone: row.phone,
      visits: row.visits,
      totalCents: row.totalCents,
    }));

  const trendMap = new Map<string, { servicios: number; facturacionCents: number; productosCents: number }>();
  const trendKeys = listPeriodKeys(input.period);
  for (const key of trendKeys) {
    trendMap.set(key, { servicios: 0, facturacionCents: 0, productosCents: 0 });
  }

  for (const appointment of nonCancelled) {
    const key = keyForDate(input.period, appointment.startsAt);
    const current = trendMap.get(key);
    if (!current) continue;
    current.servicios += appointment.services.length;
    current.facturacionCents += computeAppointmentRevenue(appointment);
  }

  for (const row of input.productSalesRows) {
    const key = keyForDate(input.period, row.soldAt);
    const current = trendMap.get(key);
    if (!current) continue;
    current.productosCents += Number(row.totalPriceCents || 0);
  }

  const trend = trendKeys.map((key) => {
    const current = trendMap.get(key) ?? { servicios: 0, facturacionCents: 0, productosCents: 0 };
    const facturacionPeriodCents = current.facturacionCents + current.productosCents;
    return {
      key,
      servicios: current.servicios,
      facturacionCents: facturacionPeriodCents,
      facturacion: formatMoney(facturacionPeriodCents),
    };
  });

  const estimatedVariablePerKey = trendKeys.length > 0 ? Math.round(gastosVariablesCents / trendKeys.length) : 0;
  const estimatedFixedPerKey = trendKeys.length > 0 ? Math.round(gastosFijosCents / trendKeys.length) : 0;

  const financialTrend = trendKeys.map((key) => {
    const current = trendMap.get(key) ?? { servicios: 0, facturacionCents: 0, productosCents: 0 };
    const ingresosCents = current.facturacionCents + current.productosCents;
    const gastosVariablesCentsKey = estimatedVariablePerKey;
    const gastosFijosCentsKey = estimatedFixedPerKey;
    return {
      key,
      ingresosCents,
      gastosVariablesCents: gastosVariablesCentsKey,
      gastosFijosCents: gastosFijosCentsKey,
      resultadoCents: ingresosCents - gastosVariablesCentsKey - gastosFijosCentsKey,
    };
  });

  const margenContribucionCents = revenueTotalCents - gastosVariablesCents;
  const resultadoOperativoCents = margenContribucionCents - gastosFijosCents;

  return {
    metrics: {
      servicesRealizados,
      facturacionCents: revenueTotalCents,
      ticketPromedioCents,
      calificacionPromedio,
      revenueReservasCents,
      revenueWalkinsCents,
      revenueProductosCents,
      revenueTotalCents,
      gastosVariablesCents,
      gastosFijosCents,
      margenContribucionCents,
      resultadoOperativoCents,
      rentabilidadPct: revenueTotalCents > 0 ? Number(((margenContribucionCents / revenueTotalCents) * 100).toFixed(1)) : null,
      cancelacionesCount: cancelledAppointments.length,
      noShowEstimadoCount: noShowEstimatedAppointments.length,
      perdidaCancelacionesCents: cancelledAppointments.reduce((sum, row) => sum + computeAppointmentRevenue(row), 0),
      perdidaNoShowEstimadaCents: noShowEstimatedAppointments.reduce((sum, row) => sum + computeAppointmentRevenue(row), 0),
    },
    charts: {
      trend,
      financialTrend,
      reservasVsWalkin: [
        { name: 'Con reserva', value: reservasCount },
        { name: 'Sin reserva', value: walkinsCount },
      ],
      revenueSources: [
        { name: 'Reservas', valueCents: revenueReservasCents },
        { name: 'Walk-in', valueCents: revenueWalkinsCents },
        { name: 'Productos', valueCents: revenueProductosCents },
      ],
      expenseSources: [
        { name: 'Variables', valueCents: gastosVariablesCents },
        { name: 'Fijos', valueCents: gastosFijosCents },
      ],
      serviciosTop: Array.from(serviceTopCounter.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      serviciosRentablesTop: Array.from(serviceProfitMap.values())
        .map((row) => ({
          ...row,
          variableCostCents: Math.round(row.variableCostCents),
          profitCents: Math.round(row.profitCents),
        }))
        .sort((a, b) => b.profitCents - a.profitCents)
        .slice(0, 10),
      productosRentablesTop: Array.from(productProfitMap.values())
        .map((row) => ({
          ...row,
          variableCostCents: Math.round(row.variableCostCents),
          profitCents: Math.round(row.profitCents),
        }))
        .sort((a, b) => b.profitCents - a.profitCents)
        .slice(0, 10),
      rendimientoEmpleados,
    },
    tables: {
      topClientes,
    },
  } satisfies AggregatedPeriodData;
}

export async function getDashboardOverview(input: DashboardInput) {
  const membership = await assertTenantAccess(input.userId, input.tenantId);
  if (!membership) {
    throw new Error('Sin acceso al tenant');
  }

  const allowedBranches = await listCalendarBranchesForUser({
    tenantId: input.tenantId,
    userId: input.userId,
  });

  const allowedBranchIds = new Set(allowedBranches.map((branch) => branch.id));
  const selectedBranchIds = (input.branchIds ?? []).filter((id) => allowedBranchIds.has(id));
  const effectiveBranchIds = selectedBranchIds.length ? selectedBranchIds : Array.from(allowedBranchIds);

  if (!effectiveBranchIds.length) {
    return {
      mode: input.mode,
      range: null,
      filters: {
        branches: allowedBranches,
        selectedBranchIds: [],
        employees: [],
        selectedEmployeeId: input.employeeId ?? null,
      },
      metrics: {
        servicesRealizados: 0,
        facturacionCents: 0,
        ticketPromedioCents: 0,
        calificacionPromedio: null as number | null,
        revenueReservasCents: 0,
        revenueWalkinsCents: 0,
        revenueProductosCents: 0,
        revenueTotalCents: 0,
        gastosVariablesCents: 0,
        gastosFijosCents: 0,
        margenContribucionCents: 0,
        resultadoOperativoCents: 0,
        rentabilidadPct: null as number | null,
        cancelacionesCount: 0,
        noShowEstimadoCount: 0,
        perdidaCancelacionesCents: 0,
        perdidaNoShowEstimadaCents: 0,
      },
      comparisons: {
        servicesRealizadosPct: 0,
        facturacionPct: 0,
        ticketPromedioPct: 0,
        gastosTotalesPct: 0,
        margenContribucionPct: 0,
        resultadoOperativoPct: 0,
      },
      charts: {
        trend: [],
        financialTrend: [],
        reservasVsWalkin: [
          { name: 'Con reserva', value: 0 },
          { name: 'Sin reserva', value: 0 },
        ],
        revenueSources: [
          { name: 'Reservas', valueCents: 0 },
          { name: 'Walk-in', valueCents: 0 },
          { name: 'Productos', valueCents: 0 },
        ],
        expenseSources: [
          { name: 'Variables', valueCents: 0 },
          { name: 'Fijos', valueCents: 0 },
        ],
        serviciosTop: [],
        serviciosRentablesTop: [],
        productosRentablesTop: [],
        rendimientoEmpleados: [],
      },
      tables: {
        topClientes: [],
      },
    };
  }

  const now = new Date();
  const periodMode = input.mode;
  const currentPeriod =
    periodMode === 'YEARLY'
      ? yearRange(input.year ?? now.getUTCFullYear(), 0)
      : monthRange(input.month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`, 0);

  const previousPeriod =
    periodMode === 'YEARLY'
      ? yearRange(currentPeriod.year, -1)
      : monthRange(`${currentPeriod.year}-${String((currentPeriod.monthIndex ?? 0) + 1).padStart(2, '0')}`, -1);

  const employeesRes = await db.query<{ id: string; fullName: string }>(
    `
      SELECT DISTINCT e.id, e."fullName"
      FROM "Employee" e
      WHERE e."tenantId" = $1
        AND e."branchId" = ANY($2::text[])
      ORDER BY e."fullName" ASC
    `,
    [input.tenantId, effectiveBranchIds],
  );

  const selectableEmployeeIds = new Set(employeesRes.rows.map((row) => row.id));
  const effectiveEmployeeId = input.employeeId && selectableEmployeeIds.has(input.employeeId) ? input.employeeId : null;

  const expensesPayload = await loadExpensesForTenantBranches({
    tenantId: input.tenantId,
    branchIds: effectiveBranchIds,
  });

  const [currentRows, previousRows] = await Promise.all([
    loadPeriodAppointments({
      tenantId: input.tenantId,
      branchIds: effectiveBranchIds,
      period: currentPeriod,
      employeeId: effectiveEmployeeId,
    }),
    loadPeriodAppointments({
      tenantId: input.tenantId,
      branchIds: effectiveBranchIds,
      period: previousPeriod,
      employeeId: effectiveEmployeeId,
    }),
  ]);

  const current = aggregatePeriodData({
    period: currentPeriod,
    appointmentRows: currentRows.appointmentRows,
    ratingsRows: currentRows.ratingsRows,
    productSalesRows: currentRows.productSalesRows,
    expenses: expensesPayload.expenses,
    serviceLinks: expensesPayload.serviceLinks,
    productLinks: expensesPayload.productLinks,
  });

  const previous = aggregatePeriodData({
    period: previousPeriod,
    appointmentRows: previousRows.appointmentRows,
    ratingsRows: previousRows.ratingsRows,
    productSalesRows: previousRows.productSalesRows,
    expenses: expensesPayload.expenses,
    serviceLinks: expensesPayload.serviceLinks,
    productLinks: expensesPayload.productLinks,
  });

  return {
    mode: periodMode,
    range: {
      start: currentPeriod.start.toISOString(),
      end: currentPeriod.end.toISOString(),
      month: periodMode === 'MONTHLY' ? `${currentPeriod.year}-${String((currentPeriod.monthIndex ?? 0) + 1).padStart(2, '0')}` : null,
      year: currentPeriod.year,
    },
    filters: {
      branches: allowedBranches,
      selectedBranchIds: effectiveBranchIds,
      employees: employeesRes.rows,
      selectedEmployeeId: effectiveEmployeeId,
    },
    metrics: current.metrics,
    comparisons: {
      servicesRealizadosPct: percentageDelta(current.metrics.servicesRealizados, previous.metrics.servicesRealizados),
      facturacionPct: percentageDelta(current.metrics.facturacionCents, previous.metrics.facturacionCents),
      ticketPromedioPct: percentageDelta(current.metrics.ticketPromedioCents, previous.metrics.ticketPromedioCents),
      gastosTotalesPct: percentageDelta(
        current.metrics.gastosFijosCents + current.metrics.gastosVariablesCents,
        previous.metrics.gastosFijosCents + previous.metrics.gastosVariablesCents,
      ),
      margenContribucionPct: percentageDelta(current.metrics.margenContribucionCents, previous.metrics.margenContribucionCents),
      resultadoOperativoPct: percentageDelta(current.metrics.resultadoOperativoCents, previous.metrics.resultadoOperativoCents),
    },
    charts: current.charts,
    tables: current.tables,
  };
}
