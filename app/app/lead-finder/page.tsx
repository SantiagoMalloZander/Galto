'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BrainCircuit, Filter, RefreshCcw, Send, Target, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { getStoredAuthSession } from '@/lib/auth';
import { useBranchContext } from '@/hooks/use-branch-context';

type Segment = 'HABITUAL' | 'CASI_HABITUAL' | 'UNA_VISITA';

type LeadFinderCustomer = {
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
    stats: {
      samples: number;
      meanIntervalDays: number;
      stdIntervalDays: number;
      regressionSlopeDays: number;
      regressionNextIntervalDays: number;
      predictedIntervalDays: number;
      lowerIntervalDays: number;
      upperIntervalDays: number;
      confidencePct: number;
    } | null;
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

type LeadFinderAnalysis = {
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

const SEGMENT_OPTIONS: Array<{ value: 'ALL' | Segment; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'HABITUAL', label: 'Habituales' },
  { value: 'CASI_HABITUAL', label: 'Casi habituales' },
  { value: 'UNA_VISITA', label: 'Una visita' },
];

function segmentLabel(segment: Segment) {
  if (segment === 'HABITUAL') return 'Habitual';
  if (segment === 'CASI_HABITUAL') return 'Casi habitual';
  return 'Una visita';
}

function segmentBadgeClass(segment: Segment) {
  if (segment === 'HABITUAL') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (segment === 'CASI_HABITUAL') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function riskBadgeClass(score: number) {
  if (score >= 85) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (score >= 65) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (score >= 45) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function formatDate(value: string | null, timeZone: string) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString('es-AR');
  }
}

export default function LeadFinderPage() {
  const [session] = useState(() => getStoredAuthSession());
  const { tenant, activeBranchId, activeBranch, loading: loadingBranchContext } = useBranchContext();
  const [analysis, setAnalysis] = useState<LeadFinderAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingCustomerId, setSendingCustomerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [segmentFilter, setSegmentFilter] = useState<'ALL' | Segment>('ALL');
  const [onlyRiskWindow, setOnlyRiskWindow] = useState(false);

  const userId = session?.user?.id ?? '';
  const tenantId = tenant?.tenantId ?? '';
  const branchId = activeBranchId ?? '';
  const timeZone = analysis?.branch.timeZone ?? activeBranch?.timeZone ?? 'America/Argentina/Buenos_Aires';

  async function loadAnalysis(forceRefresh = false) {
    if (!userId || !tenantId || !branchId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        userId,
        tenantId,
      });
      if (forceRefresh) params.set('refresh', '1');
      const response = await fetch(`/api/lead-finder/branches/${encodeURIComponent(branchId)}/analysis?${params}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo cargar Lead Finder');
      }
      setAnalysis((payload?.analysis ?? null) as LeadFinderAnalysis | null);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo cargar Lead Finder');
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadingBranchContext) return;
    if (!userId || !tenantId || !branchId) {
      setLoading(false);
      return;
    }
    void loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingBranchContext, userId, tenantId, branchId]);

  const filteredCustomers = useMemo(() => {
    const customers = analysis?.customers ?? [];
    return customers.filter((customer) => {
      if (segmentFilter !== 'ALL' && customer.segment !== segmentFilter) return false;
      if (onlyRiskWindow && !customer.inRiskWindow) return false;
      return true;
    });
  }, [analysis?.customers, segmentFilter, onlyRiskWindow]);

  const habitual = useMemo(
    () => (analysis?.customers ?? []).filter((customer) => customer.segment === 'HABITUAL'),
    [analysis?.customers],
  );
  const almostHabitual = useMemo(
    () => (analysis?.customers ?? []).filter((customer) => customer.segment === 'CASI_HABITUAL'),
    [analysis?.customers],
  );
  const oneVisit = useMemo(
    () => (analysis?.customers ?? []).filter((customer) => customer.segment === 'UNA_VISITA'),
    [analysis?.customers],
  );

  async function sendMessage(customer: LeadFinderCustomer) {
    if (!userId || !tenantId || !branchId) return;
    setSendingCustomerId(customer.customerId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/lead-finder/branches/${encodeURIComponent(branchId)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tenantId,
          customerId: customer.customerId,
          serviceId: customer.dominantService?.serviceId ?? null,
          serviceName: customer.dominantService?.serviceName ?? null,
          message: customer.recommendation,
        }),
      });
      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo enviar WhatsApp');
      }
      setMessage(`Mensaje enviado a ${customer.fullName}`);
      await loadAnalysis(false);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo enviar WhatsApp');
    } finally {
      setSendingCustomerId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Analizando patrones de clientes...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Lead Finder</h1>
          <p className="text-muted-foreground">
            Clasificación por patrones reales de consumo y predicción por regresiones + intervalos de confianza.
          </p>
          {analysis ? (
            <p className="text-xs text-muted-foreground mt-2">
              Último cálculo: {formatDate(analysis.computedAt, timeZone)} · Frecuencia de recalculo: 1 vez por día.
            </p>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => void loadAnalysis(true)}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Recalcular ahora
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
      ) : null}

      {!analysis ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            No se pudo cargar el análisis para esta sucursal.
          </CardContent>
        </Card>
      ) : (
        <>
          {!analysis.branch.whatsappConfigured ? (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="py-4 flex items-start gap-2 text-amber-800 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <div>
                  Esta sucursal no tiene WhatsApp Business API configurado. Podés ver el análisis, pero no enviar campañas
                  automáticas desde Lead Finder.
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Clientes con historial</p>
                <p className="text-2xl font-semibold">{analysis.summary.totalCustomers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Habituales</p>
                <p className="text-2xl font-semibold">{analysis.summary.habitualCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Casi habituales</p>
                <p className="text-2xl font-semibold">{analysis.summary.almostHabitualCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Una visita</p>
                <p className="text-2xl font-semibold">{analysis.summary.oneVisitCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">En ventana de riesgo</p>
                <p className="text-2xl font-semibold">{analysis.summary.actionableNowCount}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Motor predictivo activo por sucursal
              </CardTitle>
              <CardDescription>
                Segmentos: habitual (las primeras 3 visitas incluyen el mismo servicio), casi habitual (más de 1 visita sin
                patrón habitual) y una visita.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-700">Habituales</p>
                  <p className="text-sm font-semibold text-emerald-900">{habitual.length} clientes</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">Casi habituales</p>
                  <p className="text-sm font-semibold text-amber-900">{almostHabitual.length} clientes</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-100 p-3">
                  <p className="text-xs text-slate-600">Una visita</p>
                  <p className="text-sm font-semibold text-slate-800">{oneVisit.length} clientes</p>
                </div>
              </div>

              <div className="grid md:grid-cols-[220px_220px_1fr] gap-3">
                <div className="space-y-2">
                  <Label>Segmento</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={segmentFilter}
                    onChange={(event) => setSegmentFilter(event.target.value as 'ALL' | Segment)}
                  >
                    {SEGMENT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Ventana de riesgo</Label>
                  <Button
                    type="button"
                    variant={onlyRiskWindow ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setOnlyRiskWindow((prev) => !prev)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {onlyRiskWindow ? 'Solo ventana activa' : 'Mostrar todo'}
                  </Button>
                </div>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center">
                  <BrainCircuit className="h-4 w-4 mr-2" />
                  El modelo usa regresión sobre intervalos de visitas por servicio + intervalo de confianza para definir la
                  ventana ideal de contacto.
                </div>
              </div>

              <div className="space-y-3">
                {filteredCustomers.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-sm text-muted-foreground">
                    Todavía no hay clientes clasificados con estos filtros.
                  </div>
                ) : (
                  filteredCustomers.map((customer) => (
                    <div key={customer.customerId} className="rounded-xl border p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold">{customer.fullName}</p>
                          <p className="text-xs text-muted-foreground">{customer.phone ?? 'Sin teléfono válido'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={segmentBadgeClass(customer.segment)}>
                            {segmentLabel(customer.segment)}
                          </Badge>
                          <Badge variant="outline" className={riskBadgeClass(customer.riskScore)}>
                            Riesgo {customer.riskScore}%
                          </Badge>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-4 gap-3 text-xs">
                        <div className="rounded-md border bg-muted/20 p-2">
                          <p className="text-muted-foreground">Servicio dominante</p>
                          <p className="font-medium">
                            {customer.dominantService?.serviceName ?? 'Sin patrón'} ·{' '}
                            {customer.dominantService?.visits ?? 0} visitas
                          </p>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-2">
                          <p className="text-muted-foreground">Última visita</p>
                          <p className="font-medium">{formatDate(customer.lastVisitAt, timeZone)}</p>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-2">
                          <p className="text-muted-foreground">Próxima estimada</p>
                          <p className="font-medium">{formatDate(customer.prediction.nextVisitAt, timeZone)}</p>
                        </div>
                        <div className="rounded-md border bg-muted/20 p-2">
                          <p className="text-muted-foreground">Intervalo de confianza</p>
                          <p className="font-medium">
                            {formatDate(customer.prediction.windowStartAt, timeZone)} -{' '}
                            {formatDate(customer.prediction.windowEndAt, timeZone)}
                          </p>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-[1fr_auto] gap-3 items-start">
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground mb-1">Recomendación</p>
                          <p className="text-sm">{customer.recommendation}</p>
                          {customer.prediction.stats ? (
                            <p className="text-[11px] text-muted-foreground mt-2">
                              Promedio: {customer.prediction.stats.meanIntervalDays} días · Regresión próximo intervalo:{' '}
                              {customer.prediction.stats.regressionNextIntervalDays} días · Confianza:{' '}
                              {customer.prediction.confidencePct ?? '-'}%
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Button
                            type="button"
                            className="w-full"
                            disabled={!customer.canSendWhatsapp || sendingCustomerId === customer.customerId}
                            onClick={() => void sendMessage(customer)}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {sendingCustomerId === customer.customerId ? 'Enviando...' : 'Enviar WhatsApp'}
                          </Button>
                          {!customer.canSendWhatsapp ? (
                            <p className="text-[11px] text-muted-foreground max-w-[230px]">
                              {!analysis.branch.whatsappConfigured
                                ? 'Configurá WhatsApp Business API de la sucursal para habilitar envíos.'
                                : !customer.phone
                                  ? 'Este cliente no tiene teléfono válido en E.164.'
                                  : customer.cooldownUntil
                                    ? `Cooldown activo hasta ${formatDate(customer.cooldownUntil, timeZone)}.`
                                    : !customer.inRiskWindow
                                      ? 'Todavía no entró en ventana de riesgo para enviar.'
                                      : 'Este cliente no está disponible para envío automático.'}
                            </p>
                          ) : null}
                          {customer.lastMessageSentAt ? (
                            <p className="text-[11px] text-muted-foreground">
                              Último envío: {formatDate(customer.lastMessageSentAt, timeZone)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Resumen rápido de segmentos
              </CardTitle>
              <CardDescription>Para priorizar campañas y acciones en tu agenda de esta sucursal.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg border p-3">
                <p className="font-medium mb-1">Habituales</p>
                <p className="text-muted-foreground">
                  Clientes donde las primeras 3 visitas registran el mismo servicio. Son el foco principal para mensajes en
                  ventana de riesgo.
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-medium mb-1">Casi habituales</p>
                <p className="text-muted-foreground">
                  Más de una visita, pero sin patrón habitual consolidado. Ideal para convertirlos en recurrentes.
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-medium mb-1">Una visita</p>
                <p className="text-muted-foreground">
                  Clientes que vinieron una sola vez. Se trabajan con reactivación y propuesta de segundo turno.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
