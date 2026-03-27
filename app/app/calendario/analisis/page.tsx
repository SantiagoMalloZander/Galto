'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getStoredAuthSession } from '@/lib/auth';
import { useBranchContext } from '@/hooks/use-branch-context';

type HeatmapCell = {
  weekday: number;
  weekdayLabel: string;
  slotStartMin: number;
  slotEndMin: number;
  available: number;
  occupied: number;
  occupancyPct: number;
  analyzedDays: number;
};

type AnalysisPayload = {
  meta: {
    branch: { id: string; name: string; slug: string | null };
    timeZone: string;
    from: string;
    to: string;
    intervalMins: number;
    employeeId: string | null;
    generatedAt: string;
  };
  employees: Array<{ id: string; fullName: string }>;
  weekdays: Array<{ weekday: number; label: string; daysInRange: number }>;
  slots: number[];
  cells: HeatmapCell[];
};

const PRESETS = [
  { id: 'LAST_30', label: 'Últimos 30 días' },
  { id: 'LAST_90', label: 'Últimos 90 días' },
  { id: 'THIS_MONTH', label: 'Mes actual' },
  { id: 'CUSTOM', label: 'Personalizado' },
] as const;

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function applyPreset(id: (typeof PRESETS)[number]['id']) {
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (id === 'LAST_30') return { from: dateKey(new Date(end.getTime() - 29 * 86400000)), to: dateKey(end) };
  if (id === 'LAST_90') return { from: dateKey(new Date(end.getTime() - 89 * 86400000)), to: dateKey(end) };
  return { from: dateKey(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))), to: dateKey(end) };
}

function formatMinute(minute: number) {
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function tone(pct: number) {
  if (pct <= 0) return 'bg-slate-100 text-slate-600';
  if (pct < 25) return 'bg-red-200 text-red-900';
  if (pct < 50) return 'bg-orange-200 text-orange-900';
  if (pct < 75) return 'bg-yellow-200 text-yellow-900';
  if (pct < 90) return 'bg-lime-200 text-lime-900';
  return 'bg-emerald-300 text-emerald-900';
}

export default function CalendarioAnalisisPage() {
  const [session] = useState(() => getStoredAuthSession());
  const { loading: loadingBranchContext, tenant, branches, activeBranchId, setActiveBranchId } = useBranchContext();

  const [branchId, setBranchId] = useState('');
  const [intervalMins, setIntervalMins] = useState('30');
  const [employeeId, setEmployeeId] = useState('ALL');
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('LAST_30');
  const [fromDate, setFromDate] = useState(() => applyPreset('LAST_30').from);
  const [toDate, setToDate] = useState(() => applyPreset('LAST_30').to);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalysisPayload | null>(null);

  useEffect(() => {
    setLoading(loadingBranchContext);
    if (!loadingBranchContext) {
      if (activeBranchId) setBranchId(activeBranchId);
      else if (branches[0]?.id) setBranchId(branches[0].id);
    }
  }, [loadingBranchContext, activeBranchId, branches]);

  useEffect(() => {
    if (preset === 'CUSTOM') return;
    const range = applyPreset(preset);
    setFromDate(range.from);
    setToDate(range.to);
  }, [preset]);

  useEffect(() => {
    async function run() {
      if (!session?.user?.id || !tenant?.tenantId || !branchId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          userId: session.user.id,
          tenantId: tenant.tenantId,
          from: fromDate,
          to: toDate,
          intervalMins,
        });
        if (employeeId !== 'ALL') params.set('employeeId', employeeId);
        const response = await fetch(`/api/calendario/branches/${encodeURIComponent(branchId)}/analysis?${params}`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message ?? 'No se pudo cargar análisis');
        setData(payload as AnalysisPayload);
      } catch (err: any) {
        setData(null);
        setError(err?.message ?? 'Error al cargar análisis');
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, [session?.user?.id, tenant?.tenantId, branchId, intervalMins, employeeId, fromDate, toDate]);

  const cellsByKey = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    for (const cell of data?.cells ?? []) map.set(`${cell.slotStartMin}:${cell.weekday}`, cell);
    return map;
  }, [data?.cells]);

  function exportCsv() {
    if (!data) return;
    const lines = ['dia,desde,hasta,ocupacion_pct,ocupados,disponibles,dias_analizados'];
    for (const row of data.cells) {
      lines.push(
        [
          row.weekdayLabel,
          formatMinute(row.slotStartMin),
          formatMinute(row.slotEndMin),
          row.occupancyPct,
          row.occupied,
          row.available,
          row.analyzedDays,
        ].join(','),
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendario-analisis-${data.meta.from}-${data.meta.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1250px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold">Análisis de calendario</h1>
          <p className="text-sm text-muted-foreground">
            Ocupación semanal por franja (15/30/60 min). Confirmados + completados.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/app/calendario">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Link>
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Seleccioná sucursal, rango, intervalo y trabajador.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2 xl:col-span-2">
            <Label>Sucursal</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={branchId}
              onChange={async (event) => {
                const value = event.target.value;
                setBranchId(value);
                await setActiveBranchId(value);
              }}
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Preset</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={preset}
              onChange={(event) => setPreset(event.target.value as (typeof PRESETS)[number]['id'])}
            >
              {PRESETS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Desde</Label>
            <input
              type="date"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={fromDate}
              onChange={(event) => {
                setPreset('CUSTOM');
                setFromDate(event.target.value);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Hasta</Label>
            <input
              type="date"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={toDate}
              onChange={(event) => {
                setPreset('CUSTOM');
                setToDate(event.target.value);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Intervalo</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={intervalMins}
              onChange={(event) => setIntervalMins(event.target.value)}
            >
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="60">60 minutos</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label>Trabajador</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="ALL">Todos</option>
              {(data?.employees ?? []).map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Heatmap semanal</CardTitle>
            <CardDescription>Zona horaria: {data?.meta.timeZone ?? '-'}</CardDescription>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!data}>
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculando ocupación...
            </div>
          ) : null}

          {!loading && data ? (
            <div className="overflow-auto rounded-lg border">
              <table className="min-w-[980px] w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="sticky left-0 z-20 border-r border-b px-3 py-2 text-left bg-slate-100">Hora</th>
                    {data.weekdays.map((day) => (
                      <th key={day.weekday} className="border-r border-b px-3 py-2 text-left">
                        <div className="font-semibold">{day.label}</div>
                        <div className="text-[11px] text-muted-foreground">{day.daysInRange} días</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slots.map((slotStart) => (
                    <tr key={slotStart}>
                      <td className="sticky left-0 z-10 border-r border-b px-3 py-2 bg-white font-medium">{formatMinute(slotStart)}</td>
                      {data.weekdays.map((day) => {
                        const cell = cellsByKey.get(`${slotStart}:${day.weekday}`);
                        if (!cell || cell.available === 0) {
                          return (
                            <td key={`${slotStart}-${day.weekday}`} className="border-r border-b px-2 py-2 bg-slate-50 text-slate-400">
                              -
                            </td>
                          );
                        }
                        const title = `${day.label} ${formatMinute(cell.slotStartMin)}-${formatMinute(cell.slotEndMin)} · ${cell.occupancyPct}%`;
                        return (
                          <td key={`${slotStart}-${day.weekday}`} className={`border-r border-b px-2 py-2 ${tone(cell.occupancyPct)}`} title={title}>
                            <div className="font-semibold">{cell.occupancyPct}%</div>
                            <div className="text-[10px] opacity-80">
                              {cell.occupied}/{cell.available}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

