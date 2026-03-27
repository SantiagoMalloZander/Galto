'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trophy, Plus, Trash2, Medal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { getStoredAuthSession } from '@/lib/auth';

type Tenant = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
};

type RankingRow = {
  employeeId: string;
  employeeName: string;
  services: number;
  revenueCents: number;
  ratingAvg: number | null;
  ratingCount: number;
};

type GoalStanding = {
  employeeId: string;
  employeeName: string;
  value: number;
  reached: boolean;
  progressPct: number;
};

type Goal = {
  id: string;
  name: string;
  metricType: 'RATING' | 'REVENUE' | 'SERVICES';
  targetValue: number;
  rewardTitle: string;
  rewardNote: string | null;
  isActive: boolean;
  createdAt: string;
  standings: GoalStanding[];
};

type ContextPayload = {
  month: string;
  branches: Array<{ id: string; name: string; slug: string }>;
  selectedBranchIds: string[];
  canWrite: boolean;
  goals: Goal[];
  ranking: {
    byRevenue: RankingRow[];
    byServices: RankingRow[];
    byRating: RankingRow[];
  };
};

const METRIC_LABELS = {
  RATING: 'Calificaciones',
  REVENUE: 'Facturación',
  SERVICES: 'Servicios realizados',
} as const;

export default function RecompensasPage() {
  const [session] = useState(() => getStoredAuthSession());
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [context, setContext] = useState<ContextPayload | null>(null);

  const [goalName, setGoalName] = useState('');
  const [goalMetric, setGoalMetric] = useState<'RATING' | 'REVENUE' | 'SERVICES'>('SERVICES');
  const [goalTargetValue, setGoalTargetValue] = useState('10');
  const [goalRewardTitle, setGoalRewardTitle] = useState('');
  const [goalRewardNote, setGoalRewardNote] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) return;

    const loadTenants = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/reservas/tenants?userId=${encodeURIComponent(session.user.id)}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message ?? 'No se pudieron cargar negocios');

        const nextTenants = (payload?.tenants ?? []) as Tenant[];
        setTenants(nextTenants);
        if (nextTenants[0]?.tenantId) {
          setTenantId(nextTenants[0].tenantId);
        }
      } catch (err: any) {
        setError(err?.message ?? 'Error cargando negocios');
      } finally {
        setLoading(false);
      }
    };

    void loadTenants();
  }, [session?.user?.id]);

  useEffect(() => {
    if (!tenantId || !session?.user?.id) return;
    void loadContext();
  }, [tenantId, month, session?.user?.id]);

  async function loadContext(forceBranchIds?: string[]) {
    if (!tenantId || !session?.user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const branchIds = forceBranchIds ?? selectedBranchIds;
      const params = new URLSearchParams({
        userId: session.user.id,
        tenantId,
        month,
      });
      if (branchIds.length) {
        params.set('branchIds', branchIds.join(','));
      }

      const response = await fetch(`/api/recompensas/context?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo cargar recompensas');

      setContext(payload as ContextPayload);
      if (!selectedBranchIds.length && Array.isArray(payload?.selectedBranchIds)) {
        setSelectedBranchIds(payload.selectedBranchIds as string[]);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando recompensas');
    } finally {
      setLoading(false);
    }
  }

  async function createGoal() {
    if (!tenantId || !session?.user?.id || !context?.canWrite) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/recompensas/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          name: goalName,
          metricType: goalMetric,
          targetValue: Number(goalTargetValue || 0),
          rewardTitle: goalRewardTitle,
          rewardNote: goalRewardNote,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo crear objetivo');

      setGoalName('');
      setGoalTargetValue(goalMetric === 'RATING' ? '4.8' : '10');
      setGoalRewardTitle('');
      setGoalRewardNote('');
      setMessage('Objetivo creado correctamente.');
      await loadContext();
    } catch (err: any) {
      setError(err?.message ?? 'Error creando objetivo');
    } finally {
      setSaving(false);
    }
  }

  async function toggleGoal(goal: Goal) {
    if (!tenantId || !session?.user?.id || !context?.canWrite) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/recompensas/goals/${encodeURIComponent(goal.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          name: goal.name,
          metricType: goal.metricType,
          targetValue: goal.metricType === 'REVENUE' ? Number(goal.targetValue) / 100 : goal.targetValue,
          rewardTitle: goal.rewardTitle,
          rewardNote: goal.rewardNote,
          isActive: !goal.isActive,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo actualizar objetivo');
      await loadContext();
    } catch (err: any) {
      setError(err?.message ?? 'Error actualizando objetivo');
    } finally {
      setSaving(false);
    }
  }

  async function removeGoal(goalId: string) {
    if (!tenantId || !session?.user?.id || !context?.canWrite) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const params = new URLSearchParams({ userId: session.user.id, tenantId });
      const response = await fetch(`/api/recompensas/goals/${encodeURIComponent(goalId)}?${params.toString()}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo borrar objetivo');
      setMessage('Objetivo eliminado.');
      await loadContext();
    } catch (err: any) {
      setError(err?.message ?? 'Error eliminando objetivo');
    } finally {
      setSaving(false);
    }
  }

  const topRevenue = useMemo(() => context?.ranking.byRevenue?.slice(0, 10) ?? [], [context?.ranking.byRevenue]);
  const topServices = useMemo(() => context?.ranking.byServices?.slice(0, 10) ?? [], [context?.ranking.byServices]);
  const topRating = useMemo(() => context?.ranking.byRating?.slice(0, 10) ?? [], [context?.ranking.byRating]);

  if (loading && !context) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-sm text-muted-foreground">Cargando recompensas...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Recompensas para trabajadores</h1>
        <p className="text-muted-foreground">Objetivos por calificaciones, facturación y servicios realizados con ranking real.</p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Filtros de ranking</CardTitle>
          <CardDescription>Elegí negocio, mes y sucursales para construir la tier list.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Negocio</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={tenantId}
                onChange={(event) => {
                  setTenantId(event.target.value);
                  setSelectedBranchIds([]);
                }}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.tenantId} value={tenant.tenantId}>
                    {tenant.tenantName} ({tenant.tenantSlug})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Mes</Label>
              <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sucursales</Label>
              <div className="rounded-md border p-2 max-h-36 overflow-auto space-y-1">
                {(context?.branches ?? []).map((branch) => {
                  const checked = selectedBranchIds.includes(branch.id);
                  return (
                    <label key={branch.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...new Set([...selectedBranchIds, branch.id])]
                            : selectedBranchIds.filter((id) => id !== branch.id);
                          setSelectedBranchIds(next);
                        }}
                      />
                      {branch.name}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <Button onClick={() => loadContext(selectedBranchIds)} disabled={loading}>
            Aplicar filtros
          </Button>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <RankingCard title="Tier list por facturación" metric="REVENUE" rows={topRevenue} />
        <RankingCard title="Tier list por servicios" metric="SERVICES" rows={topServices} />
        <RankingCard title="Tier list por calificaciones" metric="RATING" rows={topRating} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nuevo objetivo
          </CardTitle>
          <CardDescription>Definí objetivo, métrica y recompensa para disparar el ranking.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nombre del objetivo</Label>
              <Input value={goalName} onChange={(event) => setGoalName(event.target.value)} placeholder="Ej: Top facturación del mes" />
            </div>
            <div className="space-y-2">
              <Label>Métrica</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={goalMetric}
                onChange={(event) => {
                  const next = event.target.value as 'RATING' | 'REVENUE' | 'SERVICES';
                  setGoalMetric(next);
                  setGoalTargetValue(next === 'RATING' ? '4.8' : '10');
                }}
              >
                <option value="RATING">Calificaciones</option>
                <option value="REVENUE">Facturación (ARS)</option>
                <option value="SERVICES">Servicios realizados</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Input value={goalTargetValue} onChange={(event) => setGoalTargetValue(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Recompensa</Label>
              <Input value={goalRewardTitle} onChange={(event) => setGoalRewardTitle(event.target.value)} placeholder="Ej: Bono $150.000" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nota (opcional)</Label>
            <Textarea value={goalRewardNote} onChange={(event) => setGoalRewardNote(event.target.value)} placeholder="Condiciones o aclaraciones" />
          </div>
          <Button onClick={createGoal} disabled={saving || !context?.canWrite}>
            Crear objetivo
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Objetivos activos e históricos
          </CardTitle>
          <CardDescription>Cada objetivo muestra su tier list en tiempo real.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(context?.goals ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-sm text-muted-foreground">
              Todavía no hay objetivos de recompensas cargados.
            </div>
          ) : (
            context?.goals.map((goal) => (
              <div key={goal.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{goal.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {METRIC_LABELS[goal.metricType]} · Objetivo: {formatGoalTarget(goal.metricType, goal.targetValue)}
                    </p>
                    <p className="text-sm">Recompensa: {goal.rewardTitle}</p>
                    {goal.rewardNote ? <p className="text-xs text-muted-foreground">{goal.rewardNote}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={goal.isActive ? 'default' : 'secondary'}>{goal.isActive ? 'Activo' : 'Pausado'}</Badge>
                    {context?.canWrite ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => toggleGoal(goal)}>
                          {goal.isActive ? 'Pausar' : 'Activar'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeGoal(goal.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  {goal.standings.slice(0, 10).map((row, index) => (
                    <div key={`${goal.id}-${row.employeeId}`} className="rounded-md border p-3">
                      <div className="flex justify-between gap-2 text-sm">
                        <p className="font-medium">
                          {index + 1}. {row.employeeName}
                        </p>
                        <p>{formatGoalValue(goal.metricType, row.value)}</p>
                      </div>
                      <div className="mt-2 h-2 rounded bg-muted overflow-hidden">
                        <div
                          className={`h-full ${row.reached ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.max(2, Math.min(100, row.progressPct))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RankingCard(input: {
  title: string;
  metric: 'REVENUE' | 'SERVICES' | 'RATING';
  rows: RankingRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Medal className="h-5 w-5" />
          {input.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {input.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos en el período.</p>
        ) : (
          input.rows.map((row, index) => (
            <div key={row.employeeId} className="rounded-md border p-2 flex items-center justify-between text-sm">
              <span>
                {index + 1}. {row.employeeName}
              </span>
              <strong>{formatRankingMetric(input.metric, row)}</strong>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function formatRankingMetric(metric: 'REVENUE' | 'SERVICES' | 'RATING', row: RankingRow) {
  if (metric === 'REVENUE') {
    return formatMoney(row.revenueCents);
  }
  if (metric === 'SERVICES') {
    return `${row.services} servicios`;
  }
  return row.ratingAvg !== null ? `${row.ratingAvg.toFixed(2)} ★` : 'Sin rating';
}

function formatGoalTarget(metric: Goal['metricType'], value: number) {
  if (metric === 'REVENUE') {
    return formatMoney(value);
  }
  if (metric === 'RATING') {
    return `${value.toFixed(2)} ★`;
  }
  return `${Math.round(value)} servicios`;
}

function formatGoalValue(metric: Goal['metricType'], value: number) {
  if (metric === 'REVENUE') {
    return formatMoney(Math.round(value));
  }
  if (metric === 'RATING') {
    return `${Number(value).toFixed(2)} ★`;
  }
  return `${Math.round(value)} servicios`;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(cents || 0) / 100);
}

function currentMonth() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
