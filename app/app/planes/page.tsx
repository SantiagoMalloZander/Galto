'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { ALL_APP_FEATURES, FREE_APP_FEATURES, type AccountAccess, type AppFeatureKey } from '@/lib/entitlements';
import { getStoredAuthSession, persistAuthSession, updateStoredAccountAccess, updateStoredMemberships } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/api';
import { Copy } from 'lucide-react';
import {
  BUSINESS_LINE_OPTIONS,
  isLandingPlan,
  LATAM_COUNTRIES,
  normalizeBusinessLine,
  normalizeCountryCode,
  normalizeWorkersCount,
  PREPLAN_ONBOARDING_STORAGE_KEY,
  resolveCountryName,
  type BusinessLine,
  type LandingPlan,
  type PreplanOnboardingProfile,
} from '@/lib/onboarding-profile';

const CBU = '0000003100056449349068';
const PROFESSIONAL_MONTHLY_ARS = 28000;

const APP_LABELS: Record<AppFeatureKey, string> = {
  reservas: 'Página de reservas',
  calendario: 'Calendario',
  cuentas: 'Centro de cuentas',
  clientes: 'Clientes',
  lead_finder: 'Lead Finder',
  dashboard: 'Dashboard',
  puntos: 'Puntos de clientes',
  recompensas: 'Recompensas',
  contenido: 'Panel de contenido',
};

type TenantMembership = {
  membershipId: string;
  role: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
};

type BillingStatus = {
  branchCount: number;
  includedBranchSlots: number;
  availableBranchSlots: number;
  requiresPaidFull: boolean;
  canUseDemo: boolean;
  plan: {
    tenantId: string;
    planType: 'DEMO' | 'PAID_FULL';
    isPaid: boolean;
    enabledApps: AppFeatureKey[];
    demoEndsAt: string | null;
    paidBranchSlots: number;
    updatedAt: string;
  } | null;
  pendingPayment: {
    id: string;
    planType: 'PAID_FULL';
    status: 'PENDING';
    purpose?: 'PLAN' | 'ADD_BRANCH';
    branchSlotsQty?: number;
    provider?: 'TRANSFER' | 'MERCADOPAGO';
    billingCycle?: 'MONTHLY' | 'ANNUAL';
    cbu: string;
    checkoutUrl?: string | null;
    mercadoPagoStatus?: string | null;
    mercadoPagoPaymentId?: string | null;
    publicKey?: string | null;
    selectedApps: AppFeatureKey[];
    createdAt: string;
  } | null;
  renewal: {
    provider: 'TRANSFER' | 'MERCADOPAGO' | null;
    currentPeriodStart: string;
    nextRenewalAt: string;
  } | null;
};

type BillingCycle = 'MONTHLY' | 'ANNUAL';
type PaymentProvider = 'MERCADOPAGO' | 'TRANSFER';

function readStoredPreplanProfile(): PreplanOnboardingProfile | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PREPLAN_ONBOARDING_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PreplanOnboardingProfile>;
    const countryCode = normalizeCountryCode(parsed.countryCode);
    return {
      businessLine: normalizeBusinessLine(parsed.businessLine),
      workersCount: normalizeWorkersCount(parsed.workersCount),
      countryCode,
      countryName: resolveCountryName(countryCode),
    };
  } catch {
    return null;
  }
}

export default function PlanesPage() {
  const router = useRouter();
  const [session] = useState(() => getStoredAuthSession());
  const [tenants, setTenants] = useState<TenantMembership[]>(session?.memberships ?? []);
  const [tenantId, setTenantId] = useState(session?.memberships?.[0]?.tenantId ?? '');
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<LandingPlan>('DEMO');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('MERCADOPAGO');
  const [businessName, setBusinessName] = useState('');
  const [businessSlug, setBusinessSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [businessLine, setBusinessLine] = useState<BusinessLine>('BARBERIA');
  const [workersCount, setWorkersCount] = useState('1');
  const [countryCode, setCountryCode] = useState('AR');
  const initializedBusinessDefaultsRef = useRef(false);
  const membershipRole = useMemo(() => {
    const sourceMemberships =
      tenants.length > 0 ? tenants : (session?.memberships ?? []);
    if (!sourceMemberships.length) return null;
    if (tenantId) {
      return sourceMemberships.find((membership) => membership.tenantId === tenantId)?.role ?? null;
    }
    return sourceMemberships[0]?.role ?? null;
  }, [tenants, session?.memberships, tenantId]);

  useEffect(() => {
    const plan = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('plan') : null;
    if (isLandingPlan(plan)) {
      setSelectedPlan(plan);
    }
  }, []);

  useEffect(() => {
    const preplanProfile = readStoredPreplanProfile();
    if (!preplanProfile) return;
    setBusinessLine(preplanProfile.businessLine);
    setWorkersCount(String(preplanProfile.workersCount));
    setCountryCode(preplanProfile.countryCode);
  }, []);

  useEffect(() => {
    if (!tenantId || !session?.user?.id || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paymentId = params.get('payment_id') || params.get('collection_id');
    const preapprovalId = params.get('preapproval_id');
    if (!paymentId && !preapprovalId) return;
    void verifyMercadoPago(paymentId, preapprovalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, session?.user?.id]);

  useEffect(() => {
    if (initializedBusinessDefaultsRef.current) {
      return;
    }

    const baseName =
      session?.user?.fullName && session.user.fullName.trim().length > 0
        ? `Negocio de ${session.user.fullName.trim()}`
        : 'Mi Barberia';
    setBusinessName(baseName);
    setBusinessSlug(buildSlug(baseName));
    initializedBusinessDefaultsRef.current = true;
  }, [session?.user?.fullName]);

  useEffect(() => {
    if (!session?.user?.id) {
      router.replace('/login');
      return;
    }

    loadTenants();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session?.user?.id || !membershipRole) return;
    if (membershipRole !== 'OWNER') {
      router.replace('/app/inicio');
    }
  }, [loading, membershipRole, session?.user?.id, router]);

  useEffect(() => {
    if (!tenantId || !session?.user?.id) {
      return;
    }
    loadStatus(tenantId);
  }, [tenantId]);

  const hasPendingPayment = status?.pendingPayment?.status === 'PENDING';
  const requiresPaidFull = Boolean(status?.requiresPaidFull);
  const branchCount = Number(status?.branchCount ?? 0);
  const canUseDemo = Boolean(status?.canUseDemo ?? true);
  const isPaidFull = status?.plan?.planType === 'PAID_FULL' && Boolean(status?.plan?.isPaid);
  const showPlanOptions = !isPaidFull;
  const customPayUrl = `https://wa.me/5491123401136?text=${encodeURIComponent(
    'Hola! Te mando el comprobante de transferencia del plan de Galto.',
  )}`;
  const selectedPaidPlan = 'PAID_FULL';
  const selectedPaidPlanLabel = 'Profesional';
  const selectedPaidPlanMonthly = PROFESSIONAL_MONTHLY_ARS;
  const selectedPaidPlanAmount =
    selectedPaidPlanMonthly *
    (billingCycle === 'ANNUAL' ? 12 : 1) *
    (billingCycle === 'ANNUAL' ? 0.9 : 1) *
    Math.max(1, branchCount || 1);
  const isTrialPlan = selectedPlan === 'DEMO';
  const isFreePlanActive = status?.plan?.planType === 'DEMO';

  const currentPlanLabel = useMemo(() => {
    if (!status?.plan) {
      return 'Sin plan elegido';
    }

    if (status.plan.planType === 'DEMO') {
      return 'Plan gratis';
    }

    if (status.plan.planType === 'PAID_FULL') {
      return status.plan.isPaid ? 'Plan Profesional activo' : 'Plan Profesional (pendiente de confirmación)';
    }

    return status.plan.isPaid ? 'Plan Profesional activo' : 'Plan Profesional (pendiente de confirmación)';
  }, [status]);

  async function loadTenants() {
    if (!session?.user?.id) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/billing/tenants?userId=${encodeURIComponent(session.user.id)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudieron cargar tus negocios');
      }

      const nextTenants = (payload?.tenants ?? []) as TenantMembership[];
      setTenants(nextTenants);
      if (!tenantId && nextTenants[0]?.tenantId) {
        setTenantId(nextTenants[0].tenantId);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando negocios');
    } finally {
      setLoading(false);
    }
  }

  async function loadStatus(nextTenantId: string) {
    if (!session?.user?.id) {
      return;
    }

    setError(null);
    try {
      const response = await fetch(
        `/api/billing/status?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(nextTenantId)}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo cargar el estado de pagos');
      }

      setStatus(payload as BillingStatus);
      syncAccessInSession(payload as BillingStatus);
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando estado');
    }
  }

  async function activateDemo(targetTenantId: string) {
    if (!targetTenantId || !session?.user?.id) {
      return;
    }

    const response = await fetch('/api/billing/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.id, tenantId: targetTenantId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message ?? 'No se pudo activar el plan gratis');
    }

    setStatusMessage('Plan gratis activado. Ya podés usar agenda online, calendario, clientes y centro de cuentas.');
    await loadStatus(targetTenantId);
  }

  async function chooseDemo() {
    if (!tenantId || !session?.user?.id) {
      return;
    }
    if (!canUseDemo) {
      setError('Con más de una sucursal no se puede usar el plan gratis. Necesitás plan profesional.');
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      await activateDemo(tenantId);
      router.replace('/app/inicio');
    } catch (err: any) {
      setError(err?.message ?? 'Error activando plan');
    } finally {
      setSaving(false);
    }
  }

  async function createPaymentRequest(
    planType: 'PAID_FULL',
    targetTenantId?: string,
    cycle: BillingCycle = billingCycle,
    provider: PaymentProvider = paymentProvider,
  ) {
    const effectiveTenantId = targetTenantId || tenantId;
    if (!effectiveTenantId || !session?.user?.id) {
      return;
    }
    if (requiresPaidFull && planType !== 'PAID_FULL') {
      setError('Con más de una sucursal solo se permite Plan Profesional.');
      return;
    }

    setSaving(true);
    setError(null);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/billing/payment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId: effectiveTenantId,
          planType,
          selectedApps: ALL_APP_FEATURES,
          billingCycle: cycle,
          paymentProvider: provider,
          purpose: 'PLAN',
          branchSlotsQty: Math.max(1, branchCount || 1),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo generar solicitud de pago');
      }
      const checkoutUrl = payload?.paymentRequest?.checkoutUrl as string | undefined;
      if (checkoutUrl) {
        setStatusMessage('Redirigiendo a Mercado Pago...');
        window.location.href = checkoutUrl;
        return;
      }
      setStatusMessage('Solicitud generada. Transferí al CBU y luego se confirma desde admin.');
      await loadStatus(effectiveTenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error creando solicitud');
    } finally {
      setSaving(false);
    }
  }

  async function verifyMercadoPago(paymentId?: string | null, preapprovalId?: string | null) {
    if (!tenantId || !session?.user?.id) return;
    if (!paymentId && !preapprovalId) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/billing/mercadopago/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          paymentId: paymentId || undefined,
          preapprovalId: preapprovalId || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo verificar el pago');
      }

      const status = String(payload?.verification?.status ?? '');
      if (status === 'approved') {
        setStatusMessage('Pago aprobado. El plan quedó activado.');
        router.push('/app/inicio');
      } else if (status) {
        setStatusMessage(`Pago detectado con estado: ${status}.`);
      }
      await loadStatus(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error verificando pago');
    } finally {
      setSaving(false);
    }
  }

  function syncAccessInSession(nextStatus: BillingStatus) {
    const plan = nextStatus?.plan;
    if (!plan) {
      return;
    }

    const accountAccess: AccountAccess = {
      mode: plan.planType,
      isPaid: plan.isPaid,
      demoEndsAt: plan.demoEndsAt,
      enabledApps: plan.planType === 'PAID_FULL' ? [...ALL_APP_FEATURES] : plan.enabledApps,
      planName:
        plan.planType === 'DEMO'
          ? 'Plan gratis'
          : 'Plan Profesional',
      hasChosenPlan: true,
      paymentStatus: nextStatus.pendingPayment ? 'PENDING' : plan.isPaid ? 'CONFIRMED' : 'NONE',
    };

    updateStoredAccountAccess(accountAccess);
  }

  function copyCbu() {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(CBU)
        .then(() => setStatusMessage('CBU copiado al portapapeles.'))
        .catch(() => {
          if (legacyCopy(CBU)) {
            setStatusMessage('CBU copiado al portapapeles.');
            return;
          }
          setStatusMessage(`Copiá manualmente este CBU: ${CBU}`);
        });
      return;
    }
    if (legacyCopy(CBU)) {
      setStatusMessage('CBU copiado al portapapeles.');
      return;
    }
    setStatusMessage(`Copiá manualmente este CBU: ${CBU}`);
  }

  const renewalProgress = useMemo(() => {
    const renewal = status?.renewal;
    if (!renewal) return 0;
    const start = new Date(renewal.currentPeriodStart).getTime();
    const end = new Date(renewal.nextRenewalAt).getTime();
    const now = Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
    const pct = ((now - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }, [status?.renewal]);

  const selectedCountry = useMemo(() => {
    return LATAM_COUNTRIES.find((item) => item.code === countryCode) ?? LATAM_COUNTRIES[0];
  }, [countryCode]);

  async function persistTenantOnboardingProfile(newTenantId: string) {
    if (!session?.user?.id) {
      throw new Error('Sesion invalida para guardar onboarding');
    }

    const normalizedWorkers = normalizeWorkersCount(workersCount);
    const response = await fetch('/api/tenants/onboarding-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.user.id,
        tenantId: newTenantId,
        businessLine,
        workersCount: normalizedWorkers,
        countryCode: selectedCountry.code,
        countryName: selectedCountry.name,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message ?? 'No se pudo guardar la configuracion inicial');
    }
  }

  async function createTenantAndContinue() {
    if (!session?.user?.id) {
      setError('Sesión inválida. Volvé a iniciar sesión.');
      return;
    }

    const trimmedName = businessName.trim();
    if (trimmedName.length < 3) {
      setError('Ingresá un nombre de negocio válido (mínimo 3 caracteres).');
      return;
    }

    const baseSlug = buildSlug(businessSlug || trimmedName);
    const slug = baseSlug.length > 0 ? baseSlug : `negocio-${Math.random().toString(36).slice(2, 8)}`;

    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      const response = await createTenantRequestWithRefresh({
        name: trimmedName,
        slug,
      });

      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        const message =
          (Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message) ||
          'No se pudo crear el negocio';
        throw new Error(message);
      }

      const createdTenant = payload?.tenant;
      const createdMembership = payload?.membership;
      if (!createdTenant?.id) {
        throw new Error('No se pudo obtener el tenant creado');
      }

      await persistTenantOnboardingProfile(createdTenant.id);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(PREPLAN_ONBOARDING_STORAGE_KEY);
      }

      const nextTenant: TenantMembership = {
        membershipId: createdMembership?.id ?? '',
        role: createdMembership?.role ?? 'OWNER',
        tenantId: createdTenant.id,
        tenantSlug: createdTenant.slug,
        tenantName: createdTenant.name,
      };

      const nextMemberships = [nextTenant, ...tenants.filter((item) => item.tenantId !== nextTenant.tenantId)];
      setTenants(nextMemberships);
      updateStoredMemberships(
        nextMemberships.map((membership) => ({
          membershipId: membership.membershipId,
          role: membership.role,
          tenantId: membership.tenantId,
          tenantSlug: membership.tenantSlug,
          tenantName: membership.tenantName,
        })),
      );
      setTenantId(createdTenant.id);
      setStatusMessage('Negocio creado correctamente.');

      if (selectedPlan === 'DEMO') {
        await activateDemo(createdTenant.id);
        router.replace('/app/inicio');
      } else if (selectedPlan === 'PAID_FULL') {
        await createPaymentRequest(selectedPlan, createdTenant.id, billingCycle, paymentProvider);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error creando negocio');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8">Cargando onboarding de planes...</CardContent>
        </Card>
      </div>
    );
  }

  if (!tenants.length) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Primero, contanos tu negocio</CardTitle>
            <CardDescription>
              Creamos tu cuenta de negocio y la asociamos a tu usuario para que ya te quede la membresía OWNER.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={selectedPlan === 'DEMO' ? 'default' : 'outline'}
                onClick={() => setSelectedPlan('DEMO')}
                disabled={saving}
              >
                Plan gratis
              </Button>
              <Button
                type="button"
                variant={selectedPlan === 'PAID_FULL' ? 'default' : 'outline'}
                onClick={() => setSelectedPlan('PAID_FULL')}
                disabled={saving}
              >
                Profesional
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessLine">Que tipo de servicio da tu negocio</Label>
              <select
                id="businessLine"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={businessLine}
                onChange={(event) => setBusinessLine(event.target.value as BusinessLine)}
                disabled={saving}
              >
                {BUSINESS_LINE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Servicio base que te dejamos configurado: <strong>{BUSINESS_LINE_OPTIONS.find((item) => item.value === businessLine)?.seededService}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workersCount">Cuantas personas trabajan en el negocio</Label>
              <Input
                id="workersCount"
                type="number"
                min={1}
                max={500}
                value={workersCount}
                onChange={(event) => setWorkersCount(event.target.value)}
                onBlur={() => setWorkersCount(String(normalizeWorkersCount(workersCount)))}
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">Este dato lo vamos a usar para personalizar el tutorial inicial.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="countryCode">Pais de origen</Label>
              <select
                id="countryCode"
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                disabled={saving}
              >
                {LATAM_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">Nombre de tu negocio</Label>
              <Input
                id="businessName"
                placeholder="Ej: Barbería Central"
                value={businessName}
                onChange={(event) => {
                  const value = event.target.value;
                  setBusinessName(value);
                  if (!slugTouched) {
                    setBusinessSlug(buildSlug(value));
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessSlug">Slug (URL del negocio)</Label>
              <Input
                id="businessSlug"
                placeholder="barberia-central"
                value={businessSlug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setBusinessSlug(buildSlug(event.target.value));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Quedará como: <strong>{businessSlug || 'tu-slug'}.galto.online</strong>
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {statusMessage && <p className="text-sm text-emerald-700">{statusMessage}</p>}

            <Button onClick={createTenantAndContinue} disabled={saving} className="w-full">
              {saving
                ? 'Creando...'
                : isTrialPlan
                  ? 'Crear negocio y activar plan gratis'
                  : 'Crear negocio y continuar'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Activación de plan</CardTitle>
          <CardDescription>
            Elegí una opción para arrancar. Si elegís pago, te redirigimos a Mercado Pago para completar el alta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="tenant">Negocio</Label>
            <select
              id="tenant"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
            >
              {tenants.map((tenant) => (
                <option key={tenant.tenantId} value={tenant.tenantId}>
                  {tenant.tenantName} ({tenant.tenantSlug})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Estado actual:</span>
            <Badge variant="secondary">{currentPlanLabel}</Badge>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p>
              Sucursales activas: <strong>{branchCount}</strong>
            </p>
            <p>
              Cupos pagos: <strong>{status?.includedBranchSlots ?? 1}</strong> (disponibles: <strong>{status?.availableBranchSlots ?? 0}</strong>)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              El plan profesional se cobra por cantidad de sucursales.
            </p>
            {requiresPaidFull ? (
              <p className="text-xs text-amber-700 mt-1">
                Este negocio tiene más de una sucursal: solo aplica <strong>Plan Profesional</strong>.
              </p>
            ) : null}
            {isPaidFull ? (
              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    router.push(`/pago?mode=ADD_BRANCH&plan=PAID_FULL&tenantId=${encodeURIComponent(tenantId)}&slots=1`)
                  }
                >
                  Agregar sucursal al plan
                </Button>
              </div>
            ) : null}
          </div>

          {!isTrialPlan ? (
            <div className="rounded-md border p-4 space-y-3">
              <p className="text-sm">
                Elegiste este plan: <strong>{selectedPaidPlanLabel}</strong>
              </p>
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
                  <Label>Cómo querés pagar</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={paymentProvider}
                    onChange={(event) =>
                      setPaymentProvider(event.target.value === 'TRANSFER' ? 'TRANSFER' : 'MERCADOPAGO')
                    }
                  >
                    <option value="MERCADOPAGO">Mercado Pago (recomendado)</option>
                    <option value="TRANSFER">Transferencia</option>
                  </select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Precio: <strong>${selectedPaidPlanAmount.toLocaleString('es-AR')}</strong>{' '}
                {billingCycle === 'ANNUAL' ? 'por año' : 'por mes'}.
              </p>
              {billingCycle === 'ANNUAL' ? (
                <p className="text-xs text-emerald-700">Incluye 10% de descuento por pago anual.</p>
              ) : null}
              {paymentProvider === 'MERCADOPAGO' ? (
                <p className="text-xs text-muted-foreground">
                  No tenés riesgo de olvidarte de pagar el próximo mes.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Transferencia: comunicate al <strong>+5491123401136</strong> y mandá el comprobante.
                </p>
              )}
            </div>
          ) : null}

          {hasPendingPayment && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-amber-900">Pago pendiente de confirmación</p>
              {status?.pendingPayment?.purpose === 'ADD_BRANCH' ? (
                <p className="text-xs text-amber-800">
                  Este pago agrega {Math.max(1, Number(status.pendingPayment.branchSlotsQty ?? 1))} sucursal(es) al plan.
                </p>
              ) : null}
              {status?.pendingPayment?.provider === 'MERCADOPAGO' && status.pendingPayment.checkoutUrl ? (
                <>
                  <p className="text-sm text-amber-900">
                    Iniciá el checkout para completar el pago con Mercado Pago.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.location.href = status.pendingPayment?.checkoutUrl || '';
                      }}
                    >
                      Ir a Mercado Pago
                    </Button>
                    {status.pendingPayment.mercadoPagoPaymentId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const resourceId = status.pendingPayment?.mercadoPagoPaymentId || '';
                          if (!resourceId) return;
                          const isNumericPayment = /^\d+$/.test(resourceId);
                          void verifyMercadoPago(isNumericPayment ? resourceId : undefined, isNumericPayment ? undefined : resourceId);
                        }}
                      >
                        Verificar estado
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-amber-900">
                    Transferí a este CBU: <strong>{status?.pendingPayment?.cbu ?? CBU}</strong>
                  </p>
                  <Button variant="outline" size="sm" onClick={copyCbu}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar CBU
                  </Button>
                  <p className="text-xs text-amber-900/80">
                    Una vez transferido, yo lo confirmo desde el panel admin y el plan queda activo.
                  </p>
                  <p className="text-xs text-amber-900/80">
                    Si pagás por transferencia, comunicate al <strong>+5491123401136</strong> y mandá el comprobante por WhatsApp.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => window.open(customPayUrl, '_blank', 'noopener,noreferrer')}>
                    Enviar comprobante por WhatsApp
                  </Button>
                </>
              )}
            </div>
          )}

          {status?.renewal ? (
            <div className="rounded-md border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-semibold">Renovación del plan</p>
              <Progress value={renewalProgress} />
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Inicio: {new Date(status.renewal.currentPeriodStart).toLocaleDateString('es-AR')}</span>
                <span>•</span>
                <span>Renueva: {new Date(status.renewal.nextRenewalAt).toLocaleDateString('es-AR')}</span>
                <span>•</span>
                <span>Método: {status.renewal.provider === 'MERCADOPAGO' ? 'Mercado Pago' : status.renewal.provider === 'TRANSFER' ? 'Transferencia' : 'No informado'}</span>
              </div>
              {status.renewal.provider === 'TRANSFER' ? (
                <p className="text-xs text-muted-foreground">
                  Si pagás con transferencia, comunicate al <strong>+5491123401136</strong> y mandame el comprobante por WhatsApp.
                </p>
              ) : null}
            </div>
          ) : null}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {statusMessage && <p className="text-sm text-emerald-700">{statusMessage}</p>}
        </CardContent>
      </Card>

      {showPlanOptions ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className={selectedPlan === 'DEMO' ? 'border-primary ring-2 ring-primary/20' : ''}>
            <CardHeader>
              <CardTitle>Plan gratis</CardTitle>
              <CardDescription>Sin vencimiento. Incluye agenda online, calendario, clientes y centro de cuentas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900">
                Una sucursal, agenda online, calendario, clientes y centro de cuentas habilitados para siempre.
              </div>
              <div className="rounded-md border p-2 space-y-1">
                {FREE_APP_FEATURES.map((app) => (
                  <p key={app} className="text-sm">
                    {APP_LABELS[app]}
                  </p>
                ))}
                <p className="text-xs text-muted-foreground pt-1">El resto de los módulos queda bloqueado hasta pasar a un plan pago.</p>
              </div>
              <Button className="w-full" onClick={chooseDemo} disabled={saving || !canUseDemo || isFreePlanActive}>
                {isFreePlanActive ? 'Plan gratis activo' : 'Activar plan gratis'}
              </Button>
              {!canUseDemo ? (
                <p className="text-xs text-amber-700">No disponible con más de una sucursal.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className={selectedPlan === 'PAID_FULL' ? 'border-primary ring-2 ring-primary/20' : ''}>
            <CardHeader>
              <CardTitle>Plan profesional</CardTitle>
              <CardDescription>Acceso total a todos los servicios, incluyendo Lead Finder.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => createPaymentRequest('PAID_FULL', undefined, billingCycle, paymentProvider)}
                disabled={saving}
              >
                Continuar con plan profesional
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Plan profesional activo</CardTitle>
            <CardDescription>
              Tenés acceso total a la plataforma. Este panel queda solo para ver renovación y método de pago.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No necesitás seleccionar otro plan mientras este esté activo.</p>
          </CardContent>
        </Card>
      )}

      {!isPaidFull ? (
        <Card>
          <CardHeader>
            <CardTitle>Pago por transferencia</CardTitle>
            <CardDescription>
              Si no querés usar Mercado Pago, podés pagar por transferencia y confirmar manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="cbu">CBU para transferir</Label>
            <div className="flex gap-2 max-w-xl">
              <Input id="cbu" readOnly value={CBU} />
              <Button variant="outline" onClick={copyCbu}>Copiar</Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Si pagás por transferencia, comunicate al <strong>+5491123401136</strong> y mandame el comprobante por WhatsApp.
            </p>
            <Button variant="outline" onClick={() => window.open(customPayUrl, '_blank', 'noopener,noreferrer')}>
              Hablar por WhatsApp
            </Button>
            <Button onClick={() => router.push('/app/inicio')}>Ir al panel del negocio</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

async function createTenantRequestWithRefresh(input: { name: string; slug: string }) {
  const apiBase = getApiBaseUrl();
  let currentSession = getStoredAuthSession();
  if (!currentSession?.accessToken) {
    throw new Error('Tu sesión venció. Volvé a iniciar sesión.');
  }

  const attemptCreate = async (token: string) =>
    fetch(`${apiBase}/tenants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

  let response = await attemptCreate(currentSession.accessToken);
  if (response.status !== 401) {
    return response;
  }

  const refreshResponse = await fetch(`${apiBase}/auth/staff/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!refreshResponse.ok) {
    throw new Error('Tu sesión venció. Volvé a iniciar sesión.');
  }

  const refreshPayload = await refreshResponse.json().catch(() => ({} as any));
  if (!refreshPayload?.accessToken) {
    throw new Error('No se pudo refrescar la sesión. Volvé a iniciar sesión.');
  }

  persistAuthSession(refreshPayload);
  currentSession = getStoredAuthSession();
  if (!currentSession?.accessToken) {
    throw new Error('No se pudo refrescar la sesión. Volvé a iniciar sesión.');
  }

  response = await attemptCreate(currentSession.accessToken);
  return response;
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

function legacyCopy(value: string) {
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
