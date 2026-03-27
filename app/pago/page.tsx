'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiBaseUrl } from '@/lib/api';
import { getStoredAuthSession, persistAuthSession } from '@/lib/auth';

type PaidPlan = 'PAID_FULL';
type BillingCycle = 'MONTHLY' | 'ANNUAL';
type PaymentProvider = 'MERCADOPAGO' | 'TRANSFER';

type TenantMembership = {
  role?: 'OWNER' | 'MANAGER' | 'EMPLOYEE';
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
};

type BillingStatus = {
  branchCount: number;
  includedBranchSlots: number;
  availableBranchSlots: number;
  plan: {
    planType: 'DEMO' | 'PAID_FULL';
    isPaid: boolean;
    paidBranchSlots: number;
  } | null;
};

type BranchSummary = {
  id: string;
  name: string;
  slug: string;
};

const PROFESSIONAL_MONTHLY_ARS = 28000;

export default function PagoPage() {
  const router = useRouter();
  const [session] = useState(() => getStoredAuthSession());
  const [plan, setPlan] = useState<PaidPlan>('PAID_FULL');
  const [mode, setMode] = useState<'PLAN' | 'ADD_BRANCH'>('PLAN');
  const [branchSlotsQty, setBranchSlotsQty] = useState(1);
  const [tenants, setTenants] = useState<TenantMembership[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [branches, setBranches] = useState<BranchSummary[]>([]);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('MERCADOPAGO');
  const [businessName, setBusinessName] = useState('');
  const [businessSlug, setBusinessSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) {
      router.replace('/login?next=/pago');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const selected = params.get('plan');
    const modeParam = params.get('mode');
    const slotsParam = Number(params.get('slots') ?? '1');
    if (modeParam === 'ADD_BRANCH') {
      setMode('ADD_BRANCH');
    }
    if (Number.isFinite(slotsParam) && slotsParam > 0) {
      setBranchSlotsQty(Math.max(1, Math.floor(slotsParam)));
    }
    if (selected === 'PAID_CUSTOM' || selected === 'PAID_FULL') {
      setPlan('PAID_FULL');
    } else if (selected === 'DEMO') {
      router.replace('/planes?plan=DEMO');
      return;
    }

    const baseName =
      session.user.fullName && session.user.fullName.trim().length > 0
        ? `Negocio de ${session.user.fullName.trim()}`
        : 'Mi Negocio';
    setBusinessName(baseName);
    setBusinessSlug(buildSlug(baseName));

    void loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    void loadBillingStatus(tenantId).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  useEffect(() => {
    if (mode === 'ADD_BRANCH') {
      setPlan('PAID_FULL');
    }
  }, [mode]);

  const planLabel = 'Profesional';
  const monthlyPrice = PROFESSIONAL_MONTHLY_ARS;
  const amountArs = useMemo(() => {
    const cycleMultiplier = billingCycle === 'ANNUAL' ? 12 : 1;
    const annualDiscountMultiplier = billingCycle === 'ANNUAL' ? 0.9 : 1;
    const qty = mode === 'ADD_BRANCH' ? Math.max(1, branchSlotsQty) : 1;
    return Math.round(monthlyPrice * cycleMultiplier * annualDiscountMultiplier * qty);
  }, [monthlyPrice, billingCycle, mode, branchSlotsQty]);

  async function loadTenants() {
    if (!session?.user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/billing/tenants?userId=${encodeURIComponent(session.user.id)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudieron cargar negocios');
      const nextTenants = (payload?.tenants ?? []) as TenantMembership[];
      setTenants(nextTenants);
      if (nextTenants[0]?.tenantId) {
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const requestedTenantId = params?.get('tenantId') ?? '';
        const nextTenantId =
          nextTenants.find((tenant) => tenant.tenantId === requestedTenantId)?.tenantId ?? nextTenants[0].tenantId;
        setTenantId(nextTenantId);
        await loadBillingStatus(nextTenantId);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando negocios');
    } finally {
      setLoading(false);
    }
  }

  async function loadBillingStatus(nextTenantId: string) {
    if (!session?.user?.id || !nextTenantId) return;
    const response = await fetch(
      `/api/billing/status?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(nextTenantId)}`,
      { cache: 'no-store' },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message ?? 'No se pudo cargar estado de facturación');
    setBillingStatus(payload as BillingStatus);
    await loadBranches(nextTenantId);
  }

  async function loadBranches(nextTenantId: string) {
    if (!session?.user?.id || !nextTenantId) return;
    const response = await fetch(
      `/api/reservas/branches?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(nextTenantId)}`,
      { cache: 'no-store' },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message ?? 'No se pudieron cargar sucursales');
    setBranches(Array.isArray(payload?.branches) ? payload.branches : []);
  }

  async function deactivateBranch(branchId: string) {
    if (!session?.user?.id || !tenantId) return;
    const confirmed = window.confirm('¿Seguro que querés dar de baja esta sucursal?');
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/reservas/branches/${encodeURIComponent(branchId)}?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(tenantId)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo dar de baja la sucursal');
      setMessage('Sucursal dada de baja.');
      await loadBillingStatus(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo dar de baja la sucursal');
    } finally {
      setSaving(false);
    }
  }

  async function createTenantIfNeeded() {
    if (tenantId) return tenantId;
    if (!session?.user?.id) throw new Error('Sesión inválida');

    const name = businessName.trim();
    if (name.length < 3) throw new Error('Ingresá un nombre de negocio válido (mínimo 3 caracteres).');
    const slug = buildSlug(businessSlug || name) || `negocio-${Math.random().toString(36).slice(2, 8)}`;

    const apiBase = getApiBaseUrl();
    let currentSession = getStoredAuthSession();
    if (!currentSession?.accessToken) throw new Error('Tu sesión venció. Volvé a iniciar sesión.');

    const attemptCreate = async (token: string) =>
      fetch(`${apiBase}/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ name, slug }),
      });

    let response = await attemptCreate(currentSession.accessToken);
    if (response.status === 401) {
      const refresh = await fetch(`${apiBase}/auth/staff/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!refresh.ok) throw new Error('Tu sesión venció. Volvé a iniciar sesión.');
      const refreshPayload = await refresh.json().catch(() => ({} as any));
      if (!refreshPayload?.accessToken) throw new Error('No se pudo refrescar la sesión.');
      persistAuthSession(refreshPayload);
      currentSession = getStoredAuthSession();
      if (!currentSession?.accessToken) throw new Error('No se pudo refrescar la sesión.');
      response = await attemptCreate(currentSession.accessToken);
    }

    const payload = await response.json().catch(() => ({} as any));
    if (!response.ok) {
      const msg = (Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message) || 'No se pudo crear negocio';
      throw new Error(msg);
    }

    const createdTenantId = String(payload?.tenant?.id ?? '');
    if (!createdTenantId) throw new Error('No se pudo crear negocio');
    await loadTenants();
    setTenantId(createdTenantId);
    return createdTenantId;
  }

  async function continuePayment() {
    if (!session?.user?.id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'ADD_BRANCH' && !tenantId) {
        throw new Error('Primero tenés que tener un negocio creado para agregar sucursales.');
      }
      const effectiveTenantId = await createTenantIfNeeded();
      const tenantMembership = tenants.find((item) => item.tenantId === effectiveTenantId);
      if (tenantMembership?.role && tenantMembership.role !== 'OWNER') {
        throw new Error('Solo el owner puede gestionar pagos del negocio.');
      }
      if (mode === 'ADD_BRANCH') {
        const hasPaidFull = billingStatus?.plan?.planType === 'PAID_FULL' && Boolean(billingStatus?.plan?.isPaid);
        if (!hasPaidFull) {
          throw new Error('Para agregar sucursales, primero activá el Plan Profesional.');
        }
      }
      const response = await fetch('/api/billing/payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId: effectiveTenantId,
          planType: plan,
          selectedApps: [],
          billingCycle,
          paymentProvider,
          purpose: mode,
          branchSlotsQty:
            mode === 'ADD_BRANCH'
              ? Math.max(1, branchSlotsQty)
              : Math.max(1, Number(billingStatus?.branchCount ?? 1)),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo generar solicitud de pago');

      const checkoutUrl = payload?.paymentRequest?.checkoutUrl as string | undefined;
      if (paymentProvider === 'MERCADOPAGO' && checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }

      setMessage('Solicitud creada por transferencia. Mandá comprobante al +5491123401136 y luego entrá a la app.');
    } catch (err: any) {
      setError(err?.message ?? 'Error iniciando pago');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="w-full max-w-xl">
          <CardContent className="py-8 text-sm text-muted-foreground">Cargando pasarela de pago...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>{mode === 'ADD_BRANCH' ? 'Agregá sucursales a tu plan' : 'Finalizá tu plan'}</CardTitle>
            <CardDescription>
              {mode === 'ADD_BRANCH' ? (
                <>
                  Vas a ampliar <strong>{planLabel}</strong> para sumar más sucursales.
                </>
              ) : (
                <>
                  Elegiste este plan: <strong>{planLabel}</strong>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!tenantId ? (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Primero creamos tu negocio</p>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Nombre del negocio</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(event) => {
                      const value = event.target.value;
                      setBusinessName(value);
                      setBusinessSlug(buildSlug(value));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessSlug">Slug</Label>
                  <Input id="businessSlug" value={businessSlug} onChange={(event) => setBusinessSlug(buildSlug(event.target.value))} />
                </div>
              </div>
            ) : null}

            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Frecuencia</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={billingCycle}
                  onChange={(event) => setBillingCycle(event.target.value === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY')}
                >
                  <option value="MONTHLY">Mensual</option>
                  <option value="ANNUAL">Anual</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Cómo lo querés pagar</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={paymentProvider}
                  onChange={(event) => setPaymentProvider(event.target.value === 'TRANSFER' ? 'TRANSFER' : 'MERCADOPAGO')}
                >
                  <option value="MERCADOPAGO">Mercado Pago (recomendado)</option>
                  <option value="TRANSFER">Transferencia</option>
                </select>
              </div>
            </div>

            {mode === 'ADD_BRANCH' ? (
              <div className="space-y-2">
                <Label>Cantidad de sucursales a agregar</Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBranchSlotsQty((current) => Math.max(1, current - 1))}
                  >
                    -
                  </Button>
                  <Input
                    value={String(branchSlotsQty)}
                    onChange={(event) => {
                      const next = Math.max(1, Math.floor(Number(event.target.value || 1)));
                      setBranchSlotsQty(next);
                    }}
                    inputMode="numeric"
                  />
                  <Button type="button" variant="outline" onClick={() => setBranchSlotsQty((current) => current + 1)}>
                    +
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Hoy tenés {billingStatus?.branchCount ?? 0} sucursal(es) creada(s) y {billingStatus?.includedBranchSlots ?? 1} cupo(s) pagos.
                </p>
                {branches.length ? (
                  <div className="rounded-md border p-2 space-y-2">
                    <p className="text-xs font-medium">Sucursales actuales</p>
                    {branches.map((branch) => (
                      <div key={branch.id} className="flex items-center justify-between gap-2 text-sm">
                        <span>
                          {branch.name} <span className="text-muted-foreground">/{branch.slug}</span>
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => deactivateBranch(branch.id)}
                          disabled={saving}
                        >
                          Dar de baja
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <p className="text-sm">
              Precio: <strong>${amountArs.toLocaleString('es-AR')}</strong> {billingCycle === 'ANNUAL' ? 'anual' : 'mensual'}.
            </p>
            {billingCycle === 'ANNUAL' ? (
              <p className="text-xs text-emerald-700">Incluye 10% de descuento por pago anual.</p>
            ) : null}

            {paymentProvider === 'MERCADOPAGO' ? (
              <p className="text-sm text-muted-foreground">No tenés riesgo de olvidarte de pagar el próximo mes.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Transferencia: comunicate con <strong>+5491123401136</strong> (llamá sin dudarlo).
              </p>
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={continuePayment} disabled={saving}>
                {saving ? 'Procesando...' : paymentProvider === 'MERCADOPAGO' ? 'Ir a pagar' : 'Generar pago por transferencia'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/app/inicio')}>
                Ir a la app
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function buildSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
