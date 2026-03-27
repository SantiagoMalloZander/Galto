'use client';

import { useEffect, useMemo, useState } from 'react';
import { Headphones, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react';
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

type SupportPackage = {
  code: 'PACK_1H_20' | 'PACK_2H_36' | 'PACK_4H_70';
  label: string;
  hours: number;
  amountArs: number;
};

type SupportPurchase = {
  id: string;
  packageCode: string;
  packageLabel: string;
  hoursQty: number;
  amountArs: number;
  paymentMethod: 'MERCADOPAGO' | 'TRANSFER';
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  cbu: string | null;
  checkoutUrl: string | null;
  summaryCompleted: boolean;
  createdAt: string;
  paidAt: string | null;
};

type SupportContext = {
  actor: { membershipId: string; role: string };
  packages: SupportPackage[];
  purchases: SupportPurchase[];
  cbu: string;
  mercadoPagoEnabled: boolean;
  defaultContactName?: string | null;
  defaultContactPhone?: string | null;
};

function formatMoneyArs(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(
    Number(value || 0),
  );
}

export default function SoportePage() {
  const [session] = useState(() => getStoredAuthSession());
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [context, setContext] = useState<SupportContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [selectedPackageCode, setSelectedPackageCode] = useState<SupportPackage['code']>('PACK_1H_20');
  const [paymentMethod, setPaymentMethod] = useState<'MERCADOPAGO' | 'TRANSFER'>('MERCADOPAGO');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [summaryPurchaseId, setSummaryPurchaseId] = useState('');
  const [summaryBusinessContext, setSummaryBusinessContext] = useState('');
  const [summaryNeed, setSummaryNeed] = useState('');
  const [summaryGoal, setSummaryGoal] = useState('');
  const [summaryNotes, setSummaryNotes] = useState('');

  const selectedPackage = useMemo(
    () => context?.packages.find((pkg) => pkg.code === selectedPackageCode) ?? null,
    [context?.packages, selectedPackageCode],
  );

  const pendingSummaryPurchases = useMemo(
    () => (context?.purchases ?? []).filter((purchase) => purchase.status === 'PAID' && !purchase.summaryCompleted),
    [context?.purchases],
  );

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    const loadTenants = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/reservas/tenants?userId=${encodeURIComponent(session.user.id)}`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message ?? 'No se pudieron cargar negocios');
        const list = (payload?.tenants ?? []) as Tenant[];
        setTenants(list);
        if (list[0]?.tenantId) setTenantId(list[0].tenantId);
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
    void loadContext(tenantId);
  }, [tenantId, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !tenantId) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const purchaseId = params.get('supportPurchaseId');
    const paymentId = params.get('payment_id');
    if (!purchaseId || !paymentId) return;

    const verify = async () => {
      try {
        const response = await fetch(`/api/support/purchases/${encodeURIComponent(purchaseId)}/verify-mp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: session.user.id, tenantId, paymentId }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message ?? 'No se pudo verificar el pago');
        setStatus(payload?.verification?.approved ? 'Pago de soporte confirmado.' : 'Pago detectado pero no aprobado aún.');
        await loadContext(tenantId);
      } catch (err: any) {
        setError(err?.message ?? 'No se pudo verificar el pago');
      }
    };
    void verify();
  }, [tenantId, session?.user?.id]);

  async function loadContext(targetTenantId: string) {
    if (!session?.user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/support/context?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(targetTenantId)}`,
        { cache: 'no-store' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo cargar soporte');
      setContext(payload as SupportContext);
      if (!contactName.trim()) {
        setContactName(String(payload?.defaultContactName ?? session.user.fullName ?? ''));
      }
      if (!contactPhone.trim()) {
        setContactPhone(String(payload?.defaultContactPhone ?? ''));
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando soporte');
    } finally {
      setLoading(false);
    }
  }

  async function handleBuySupport() {
    if (!session?.user?.id || !tenantId) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch('/api/support/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          packageCode: selectedPackageCode,
          paymentMethod,
          contactName,
          contactPhone,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo crear la compra de soporte');

      if (paymentMethod === 'MERCADOPAGO' && payload?.purchase?.checkoutUrl) {
        window.location.href = String(payload.purchase.checkoutUrl);
        return;
      }

      setStatus(`Solicitud creada. Transferí al CBU ${payload?.purchase?.cbu ?? context?.cbu ?? ''} y luego confirmamos desde admin.`);
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error creando compra de soporte');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSummary() {
    if (!session?.user?.id || !tenantId || !summaryPurchaseId) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/support/purchases/${encodeURIComponent(summaryPurchaseId)}/summary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          businessContext: summaryBusinessContext,
          need: summaryNeed,
          goal: summaryGoal,
          notes: summaryNotes,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo guardar resumen');

      setStatus('Resumen de sesión guardado. Ya aparece en panel admin.');
      setSummaryPurchaseId('');
      setSummaryBusinessContext('');
      setSummaryNeed('');
      setSummaryGoal('');
      setSummaryNotes('');
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando resumen');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-sm text-muted-foreground">Cargando soporte...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2 flex items-center gap-2">
            <Headphones className="h-7 w-7 text-violet-600" />
            Soporte
          </h1>
          <p className="text-muted-foreground">Comprá horas de soporte y organizá mejor cada sesión.</p>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {status ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{status}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Negocio activo</CardTitle>
        </CardHeader>
        <CardContent>
          <select
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
        </CardContent>
      </Card>

      <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            Comprar soporte
          </CardTitle>
          <CardDescription>Elegí paquete y método de pago.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(context?.packages ?? []).map((pkg) => (
              <button
                key={pkg.code}
                type="button"
                onClick={() => setSelectedPackageCode(pkg.code)}
                className={`rounded-lg border p-3 text-left transition ${
                  selectedPackageCode === pkg.code ? 'border-violet-500 bg-violet-100/60' : 'border-border hover:bg-muted/40'
                }`}
              >
                <p className="font-semibold text-sm">{pkg.label}</p>
                <p className="text-xs text-muted-foreground">{pkg.hours}h de soporte</p>
                <p className="text-sm font-bold mt-1">{formatMoneyArs(pkg.amountArs)}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nombre de contacto</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Nombre y apellido" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+549..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('MERCADOPAGO')}
              className={`rounded-lg border p-3 text-left ${paymentMethod === 'MERCADOPAGO' ? 'border-violet-500 bg-violet-100/60' : ''}`}
            >
              <p className="font-semibold text-sm">Mercado Pago</p>
              <p className="text-xs text-muted-foreground">Pago inmediato y verificación automática.</p>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('TRANSFER')}
              className={`rounded-lg border p-3 text-left ${paymentMethod === 'TRANSFER' ? 'border-violet-500 bg-violet-100/60' : ''}`}
            >
              <p className="font-semibold text-sm">Transferencia</p>
              <p className="text-xs text-muted-foreground">Confirmación manual desde admin.</p>
            </button>
          </div>

          <div className="rounded-md border bg-background p-3 text-sm">
            {selectedPackage ? (
              <p>
                Total: <strong>{formatMoneyArs(selectedPackage.amountArs)}</strong> por <strong>{selectedPackage.hours}h</strong>
              </p>
            ) : null}
            {paymentMethod === 'TRANSFER' ? <p className="text-xs text-muted-foreground mt-1">CBU: {context?.cbu}</p> : null}
          </div>

          <Button
            onClick={handleBuySupport}
            disabled={saving || !selectedPackage || !contactName.trim() || !contactPhone.trim()}
            className="w-full md:w-auto"
          >
            Comprar soporte
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            Resumen para organizar la sesión
          </CardTitle>
          <CardDescription>Completalo después de pagar para que preparemos mejor el tiempo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Compra pagada</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={summaryPurchaseId}
              onChange={(e) => setSummaryPurchaseId(e.target.value)}
            >
              <option value="">Seleccioná compra pagada</option>
              {pendingSummaryPurchases.map((purchase) => (
                <option key={purchase.id} value={purchase.id}>
                  {purchase.packageLabel} · {formatMoneyArs(purchase.amountArs)} · {new Date(purchase.paidAt || purchase.createdAt).toLocaleDateString('es-AR')}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Contexto del negocio</Label>
            <Textarea rows={2} value={summaryBusinessContext} onChange={(e) => setSummaryBusinessContext(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Qué necesitás resolver</Label>
            <Textarea rows={2} value={summaryNeed} onChange={(e) => setSummaryNeed(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Objetivo de la sesión</Label>
            <Textarea rows={2} value={summaryGoal} onChange={(e) => setSummaryGoal(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notas extra</Label>
            <Textarea rows={2} value={summaryNotes} onChange={(e) => setSummaryNotes(e.target.value)} />
          </div>
          <Button onClick={handleSaveSummary} disabled={saving || !summaryPurchaseId || !summaryNeed.trim() || !summaryGoal.trim()}>
            Guardar resumen
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Historial de soporte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(context?.purchases ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay compras de soporte.</p>
          ) : (
            context?.purchases.map((purchase) => (
              <div key={purchase.id} className="rounded-md border p-3 flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-semibold">{purchase.packageLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {purchase.hoursQty}h · {formatMoneyArs(purchase.amountArs)} · {purchase.paymentMethod}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={purchase.status === 'PAID' ? 'default' : 'secondary'}>{purchase.status}</Badge>
                  {purchase.summaryCompleted ? <Badge variant="outline">Resumen listo</Badge> : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
