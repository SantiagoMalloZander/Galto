'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getStoredAuthSession } from '@/lib/auth';
import { useBranchContext } from '@/hooks/use-branch-context';
import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  DollarSign,
  HandCoins,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

type Branch = {
  id: string;
  name: string;
  slug: string;
};

type Employee = {
  id: string;
  fullName: string;
};

type DashboardResponse = {
  mode: 'MONTHLY' | 'YEARLY';
  range: {
    start: string;
    end: string;
    month: string | null;
    year: number;
  } | null;
  filters: {
    branches: Branch[];
    selectedBranchIds: string[];
    employees: Employee[];
    selectedEmployeeId: string | null;
  };
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
  comparisons: {
    servicesRealizadosPct: number;
    facturacionPct: number;
    ticketPromedioPct: number;
    gastosTotalesPct: number;
    margenContribucionPct: number;
    resultadoOperativoPct: number;
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

const PRIMARY_BLUE = '#1f4f82';
const SECONDARY_BLUE = '#4f8a9d';

function formatMoney(cents: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format((Number(cents || 0) || 0) / 100);
}

function formatCompactMoney(cents: number) {
  const value = Number(cents || 0) / 100;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

function formatMonthInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function deltaMeta(value: number) {
  const positive = value >= 0;
  return {
    label: `${positive ? '+' : ''}${value.toFixed(1)}% vs período anterior`,
    positive,
  };
}

export default function DashboardPage() {
  const [session] = useState(() => getStoredAuthSession());
  const { loading: loadingBranchContext, tenant, activeBranchId } = useBranchContext();
  const [tenantId, setTenantId] = useState('');

  const [mode, setMode] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [month, setMonth] = useState(() => formatMonthInput(new Date()));
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [yearInput, setYearInput] = useState(() => String(new Date().getFullYear()));
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState<string>('ALL');

  const [loading, setLoading] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    setLoading(loadingBranchContext);
    if (!loadingBranchContext) {
      setTenantId(tenant?.tenantId ?? '');
      if (activeBranchId) setSelectedBranchIds([activeBranchId]);
    }
  }, [loadingBranchContext, tenant?.tenantId, activeBranchId]);

  const branchIdsParam = useMemo(() => selectedBranchIds.join(','), [selectedBranchIds]);

  useEffect(() => {
    if (!session?.user?.id || !tenantId) return;

    const loadDashboard = async () => {
      setLoadingDashboard(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          userId: session.user.id,
          tenantId,
          mode,
        });
        if (mode === 'MONTHLY') params.set('month', month);
        else params.set('year', String(year));
        if (branchIdsParam) params.set('branchIds', branchIdsParam);
        if (employeeId !== 'ALL') params.set('employeeId', employeeId);

        const response = await fetch(`/api/dashboard/overview?${params.toString()}`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message ?? 'No se pudo cargar dashboard');

        const parsed = payload as DashboardResponse;
        setData(parsed);
        if (!selectedBranchIds.length && parsed.filters.selectedBranchIds.length) {
          setSelectedBranchIds(parsed.filters.selectedBranchIds);
        }
        if (employeeId !== 'ALL' && !parsed.filters.employees.some((employee) => employee.id === employeeId)) {
          setEmployeeId('ALL');
        }
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando dashboard');
        setData(null);
      } finally {
        setLoadingDashboard(false);
      }
    };

    void loadDashboard();
  }, [session?.user?.id, tenantId, mode, month, year, branchIdsParam, employeeId]);

  useEffect(() => {
    setYearInput(String(year));
  }, [year]);

  const revenueBreakdown = useMemo(() => {
    const rows = data?.charts.revenueSources ?? [];
    const max = Math.max(1, ...rows.map((row) => row.valueCents), 1);
    return rows.map((row) => ({
      ...row,
      widthPct: Math.max(5, Math.round((row.valueCents / max) * 100)),
    }));
  }, [data?.charts.revenueSources]);

  const expenseBreakdown = useMemo(() => {
    const rows = data?.charts.expenseSources ?? [];
    const max = Math.max(1, ...rows.map((row) => row.valueCents), 1);
    return rows.map((row) => ({
      ...row,
      widthPct: Math.max(5, Math.round((row.valueCents / max) * 100)),
    }));
  }, [data?.charts.expenseSources]);

  const reservasSplit = useMemo(() => {
    const rows = data?.charts.reservasVsWalkin ?? [];
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return rows.map((row) => ({
      ...row,
      pct: total > 0 ? Math.round((row.value / total) * 100) : 0,
    }));
  }, [data?.charts.reservasVsWalkin]);

  const maxServiceProfit = useMemo(() => {
    const values = (data?.charts.serviciosRentablesTop ?? []).map((row) => Math.max(0, row.profitCents));
    return Math.max(1, ...values, 1);
  }, [data?.charts.serviciosRentablesTop]);

  const maxTrendIncome = useMemo(() => {
    const values = (data?.charts.financialTrend ?? []).map((row) => row.ingresosCents);
    return Math.max(1, ...values, 1);
  }, [data?.charts.financialTrend]);

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-sm text-muted-foreground">Cargando dashboard...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1240px] mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-display font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Facturación, gastos y rentabilidad pre-impuestos.</p>
      </header>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section className="rounded-2xl border bg-white p-4 md:p-5 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 w-fit">
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === 'MONTHLY' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'}`}
              onClick={() => setMode('MONTHLY')}
            >
              Mensual
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === 'YEARLY' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600'}`}
              onClick={() => setMode('YEARLY')}
            >
              Anual
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-2 md:items-center">
            <div className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm inline-flex items-center">
              {tenant?.tenantName ?? '-'}
            </div>
            {mode === 'MONTHLY' ? (
              <input
                type="month"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            ) : (
              <input
                type="number"
                className="h-10 w-28 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={yearInput}
                min={2020}
                max={2100}
                onChange={(event) => setYearInput(event.target.value)}
                onBlur={() => {
                  const nextYear = Number(yearInput || new Date().getFullYear());
                  if (Number.isFinite(nextYear)) setYear(Math.min(2100, Math.max(2020, Math.round(nextYear))));
                }}
              />
            )}

            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="ALL">Todos los empleados</option>
              {(data?.filters.employees ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(data?.filters.branches ?? []).map((branch) => {
            const checked = selectedBranchIds.includes(branch.id);
            return (
              <button
                key={branch.id}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  checked ? 'border-[#1f4f82] bg-[#1f4f82]/10 text-[#1f4f82]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => {
                  const next = checked ? selectedBranchIds.filter((id) => id !== branch.id) : [...selectedBranchIds, branch.id];
                  setSelectedBranchIds(next);
                }}
              >
                {branch.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <MetricCard
          icon={ChartNoAxesCombined}
          title="Servicios realizados"
          value={String(data?.metrics.servicesRealizados ?? 0)}
          delta={deltaMeta(data?.comparisons.servicesRealizadosPct ?? 0)}
        />
        <MetricCard
          icon={Wallet}
          title="Facturación total"
          value={formatMoney(data?.metrics.facturacionCents ?? 0)}
          delta={deltaMeta(data?.comparisons.facturacionPct ?? 0)}
        />
        <MetricCard
          icon={DollarSign}
          title="Ticket promedio"
          value={formatMoney(data?.metrics.ticketPromedioCents ?? 0)}
          delta={deltaMeta(data?.comparisons.ticketPromedioPct ?? 0)}
        />
        <MetricCard
          icon={CircleDollarSign}
          title="Gastos variables"
          value={formatMoney(data?.metrics.gastosVariablesCents ?? 0)}
          delta={deltaMeta(data?.comparisons.gastosTotalesPct ?? 0)}
        />
        <MetricCard
          icon={CalendarDays}
          title="Gastos fijos"
          value={formatMoney(data?.metrics.gastosFijosCents ?? 0)}
          delta={deltaMeta(data?.comparisons.gastosTotalesPct ?? 0)}
        />
        <MetricCard
          icon={HandCoins}
          title="Margen contribución"
          value={formatMoney(data?.metrics.margenContribucionCents ?? 0)}
          delta={deltaMeta(data?.comparisons.margenContribucionPct ?? 0)}
        />
      </section>

      <section className="grid xl:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">Ingresos (juntos y separados)</CardTitle>
            <CardDescription>Reservas, atenciones directas y productos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {revenueBreakdown.map((row, idx) => (
              <div key={row.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium text-slate-700">{row.name}</p>
                  <p className="font-semibold text-slate-700">{formatMoney(row.valueCents)}</p>
                </div>
                <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${row.widthPct}%`, background: idx === 0 ? PRIMARY_BLUE : idx === 1 ? SECONDARY_BLUE : '#0f766e' }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">Gastos (pre-impuestos)</CardTitle>
            <CardDescription>Fijos y variables del período.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {expenseBreakdown.map((row, idx) => (
              <div key={row.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium text-slate-700">{row.name}</p>
                  <p className="font-semibold text-slate-700">{formatMoney(row.valueCents)}</p>
                </div>
                <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${row.widthPct}%`, background: idx === 0 ? '#be123c' : '#7c3aed' }}
                  />
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              <p className="text-sm text-slate-600">Resultado operativo (ingresos - variables - fijos)</p>
              <p className="text-2xl font-bold text-slate-900">{formatMoney(data?.metrics.resultadoOperativoCents ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid xl:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">Top servicios más rentables</CardTitle>
            <CardDescription>Rentabilidad por servicio considerando solo costos variables.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.charts.serviciosRentablesTop ?? []).slice(0, 8).map((row) => {
              const width = Math.max(4, Math.round((Math.max(0, row.profitCents) / maxServiceProfit) * 100));
              return (
                <div key={`${row.serviceId ?? row.name}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-700 truncate">{row.name}</p>
                    <p className="text-sm font-semibold text-emerald-700">{formatMoney(row.profitCents)}</p>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${width}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Ingreso: {formatMoney(row.revenueCents)} | Costo variable: {formatMoney(row.variableCostCents)} | Margen:{' '}
                    {row.marginPct == null ? '-' : `${row.marginPct}%`}
                  </p>
                </div>
              );
            })}
            {(data?.charts.serviciosRentablesTop?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">Sin datos de rentabilidad por servicio para este filtro.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">Tendencia financiera</CardTitle>
            <CardDescription>Ingresos y resultado por período.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.charts.financialTrend ?? []).slice(-8).map((row) => {
              const width = Math.max(4, Math.round((row.ingresosCents / maxTrendIncome) * 100));
              const positive = row.resultadoCents >= 0;
              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-medium text-slate-700">{row.key}</p>
                    <p className={`font-semibold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>{formatMoney(row.resultadoCents)}</p>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full bg-[#1f4f82]" style={{ width: `${width}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Ingresos: {formatMoney(row.ingresosCents)} | Variables: {formatMoney(row.gastosVariablesCents)} | Fijos:{' '}
                    {formatMoney(row.gastosFijosCents)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid xl:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">Cancelaciones y no-show (aparte)</CardTitle>
            <CardDescription>Pérdida de ingresos estimada del período.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-sm text-slate-500">Cancelaciones</p>
              <p className="text-2xl font-bold text-slate-800">{data?.metrics.cancelacionesCount ?? 0}</p>
              <p className="text-xs text-rose-700">Pérdida estimada: {formatMoney(data?.metrics.perdidaCancelacionesCents ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-sm text-slate-500">No-show estimado (turnos pasados sin cerrar)</p>
              <p className="text-2xl font-bold text-slate-800">{data?.metrics.noShowEstimadoCount ?? 0}</p>
              <p className="text-xs text-rose-700">Pérdida estimada: {formatMoney(data?.metrics.perdidaNoShowEstimadaCents ?? 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">Rendimiento por empleados</CardTitle>
            <CardDescription>Facturación y margen aproximado por empleado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.charts.rendimientoEmpleados ?? []).slice(0, 6).map((row) => (
              <div key={row.employeeId} className="rounded-xl border border-slate-100 p-3 space-y-2">
                <p className="font-semibold text-slate-800">{row.employeeName}</p>
                <div className="grid grid-cols-3 gap-2">
                  <MiniMetric label="Servicios" value={String(row.services)} />
                  <MiniMetric label="Facturación" value={formatCompactMoney(row.facturacionCents)} />
                  <MiniMetric label="Margen" value={formatCompactMoney(row.profitCents)} />
                </div>
                <p className="text-[11px] text-slate-500">
                  Costo variable asignado: {formatMoney(row.variableCostCents)} {row.ratingAvg != null ? `| Rating: ${row.ratingAvg}` : ''}
                </p>
              </div>
            ))}
            {(data?.charts.rendimientoEmpleados?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">Sin datos de rendimiento para este filtro.</p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid xl:grid-cols-2 gap-4">
        <Card className="rounded-2xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">Visitas con reserva vs sin reserva</CardTitle>
            <CardDescription>Distribución de visitas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {reservasSplit.map((row, index) => (
              <div key={row.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium text-slate-700">{row.name}</p>
                  <p className="font-semibold text-slate-700">{row.pct}%</p>
                </div>
                <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${row.pct}%`,
                      background: index === 0 ? PRIMARY_BLUE : SECONDARY_BLUE,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">{row.value} visitas</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">Top 10 clientes</CardTitle>
            <CardDescription>Por gasto total del período.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.tables.topClientes ?? []).slice(0, 10).map((row, index) => (
              <div key={`${row.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                <div className="h-8 w-8 rounded-full border bg-slate-50 text-slate-700 grid place-items-center text-sm font-semibold">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-800 truncate">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.visits} visitas</p>
                </div>
                <p className="font-semibold text-slate-800">{formatMoney(row.totalCents)}</p>
              </div>
            ))}
            {loadingDashboard ? <p className="text-xs text-slate-500">Actualizando datos...</p> : null}
            {(data?.tables.topClientes?.length ?? 0) === 0 ? <p className="text-sm text-slate-500">Sin clientes para este filtro.</p> : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  delta,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  delta: { label: string; positive: boolean };
}) {
  return (
    <Card className="rounded-2xl border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p className="text-3xl leading-tight font-bold text-slate-800 mt-1">{value}</p>
          </div>
          <div className="h-12 w-12 rounded-xl bg-slate-100 grid place-items-center text-slate-600">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className={`mt-3 inline-flex items-center gap-1 text-sm ${delta.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {delta.positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span>{delta.label}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-lg font-bold text-[#1f4f82] leading-tight">{value}</p>
    </div>
  );
}
