'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Gift, RefreshCcw, Save, Trash2 } from 'lucide-react';
import { getStoredAuthSession } from '@/lib/auth';

type Tenant = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
};

type Reward = {
  id: string;
  pointsRequired: number;
  title: string;
  imageUrl: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CustomerPoints = {
  customerUserId: string;
  fullName: string | null;
  phone: string;
  points: number;
  bookingsCount: number;
  lastBookedAt: string | null;
  spendCents: number;
};

type PointsContext = {
  membership: { id: string; role: string };
  config: {
    mode: 'VISIT' | 'SPEND';
    pointsPerVisit: number;
    spendAmountCentsPerPoint: number;
    updatedAt: string;
  };
  rewards: Reward[];
  customers: CustomerPoints[];
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format((Number(cents || 0) || 0) / 100);
}

function formatDate(iso: string | null) {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export default function PuntosPage() {
  const [session] = useState(() => getStoredAuthSession());

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantId, setTenantId] = useState('');

  const [context, setContext] = useState<PointsContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingReward, setSavingReward] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [mode, setMode] = useState<'VISIT' | 'SPEND'>('VISIT');
  const [pointsPerVisitInput, setPointsPerVisitInput] = useState('1');
  const [spendAmountPerPointArsInput, setSpendAmountPerPointArsInput] = useState('1000');

  const [rewardId, setRewardId] = useState<string | null>(null);
  const [rewardPointsInput, setRewardPointsInput] = useState('50');
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardImageUrl, setRewardImageUrl] = useState<string>('');
  const [rewardNote, setRewardNote] = useState('');

  const selectedTenant = useMemo(() => tenants.find((tenant) => tenant.tenantId === tenantId) ?? null, [tenants, tenantId]);

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    const loadTenants = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/reservas/tenants?userId=${encodeURIComponent(session.user.id)}`, {
          cache: 'no-store',
        });
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
    if (!session?.user?.id || !tenantId) return;
    void loadContext(tenantId);
  }, [session?.user?.id, tenantId]);

  async function loadContext(targetTenantId: string) {
    if (!session?.user?.id) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/puntos/context?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(targetTenantId)}`,
        { cache: 'no-store' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo cargar el módulo de puntos');
      }

      const nextContext = payload as PointsContext;
      setContext(nextContext);
      setMode(nextContext.config.mode);
      setPointsPerVisitInput(String(nextContext.config.pointsPerVisit));
      setSpendAmountPerPointArsInput(String(Math.max(1, Math.round(nextContext.config.spendAmountCentsPerPoint / 100))));
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando puntos');
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!session?.user?.id || !tenantId) return;

    setSavingConfig(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch('/api/puntos/context', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          mode,
          pointsPerVisit: Math.max(1, Number(pointsPerVisitInput || 1)),
          spendAmountCentsPerPoint: Math.max(1, Math.round(Number(spendAmountPerPointArsInput || 1) * 100)),
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo guardar configuración');

      setStatus('Configuración guardada. Se recalcularon puntos de clientes.');
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando configuración');
    } finally {
      setSavingConfig(false);
    }
  }

  async function saveReward() {
    if (!session?.user?.id || !tenantId) return;

    setSavingReward(true);
    setError(null);
    setStatus(null);

    try {
      const payloadBody = {
        userId: session.user.id,
        tenantId,
        pointsRequired: Math.max(1, Number(rewardPointsInput || 1)),
        title: rewardTitle,
        imageUrl: rewardImageUrl || null,
        note: rewardNote || null,
        isActive: true,
      };

      const response = rewardId
        ? await fetch(`/api/puntos/rewards/${encodeURIComponent(rewardId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadBody),
          })
        : await fetch('/api/puntos/rewards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadBody),
          });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo guardar recompensa');

      clearRewardForm();
      setStatus(rewardId ? 'Recompensa actualizada.' : 'Recompensa creada.');
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error guardando recompensa');
    } finally {
      setSavingReward(false);
    }
  }

  async function removeReward(id: string) {
    if (!session?.user?.id || !tenantId) return;

    setError(null);
    setStatus(null);
    try {
      const response = await fetch(
        `/api/puntos/rewards/${encodeURIComponent(id)}?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(tenantId)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo eliminar recompensa');

      if (rewardId === id) {
        clearRewardForm();
      }

      setStatus('Recompensa eliminada.');
      await loadContext(tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'Error eliminando recompensa');
    }
  }

  async function onRewardImageSelected(file: File | null) {
    if (!file) return;

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.readAsDataURL(file);
    });

    setRewardImageUrl(dataUrl);
  }

  function clearRewardForm() {
    setRewardId(null);
    setRewardPointsInput('50');
    setRewardTitle('');
    setRewardImageUrl('');
    setRewardNote('');
  }

  function editReward(reward: Reward) {
    setRewardId(reward.id);
    setRewardPointsInput(String(reward.pointsRequired));
    setRewardTitle(reward.title);
    setRewardImageUrl(reward.imageUrl ?? '');
    setRewardNote(reward.note ?? '');
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-sm text-muted-foreground">Cargando módulo de puntos...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Puntos de clientes</h1>
          <p className="text-muted-foreground">Configurá acumulación de puntos y recompensas por canje.</p>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 min-w-[280px]">
          <p className="text-xs text-muted-foreground">Negocio activo</p>
          <p className="text-sm font-medium">
            {selectedTenant ? `${selectedTenant.tenantName} (${selectedTenant.tenantSlug})` : 'Sin negocio'}
          </p>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {status ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{status}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Configuración del programa</CardTitle>
          <CardDescription>Elegí si acumulás puntos por visita o por gasto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modo de acumulación</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={mode}
                onChange={(event) => setMode(event.target.value as 'VISIT' | 'SPEND')}
              >
                <option value="VISIT">Por visita</option>
                <option value="SPEND">Según gasto</option>
              </select>
            </div>

            {mode === 'VISIT' ? (
              <div className="space-y-2">
                <Label>Puntos por visita</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={pointsPerVisitInput}
                  onChange={(event) => setPointsPerVisitInput(event.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Cada cuántos pesos = 1 punto</Label>
                <Input
                  type="number"
                  min={1}
                  value={spendAmountPerPointArsInput}
                  onChange={(event) => setSpendAmountPerPointArsInput(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Ejemplo: si ponés 1000, cada $1000 suma 1 punto.</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={saveConfig} disabled={savingConfig}>
              <Save className="h-4 w-4 mr-2" />
              {savingConfig ? 'Guardando...' : 'Guardar configuración'}
            </Button>
            <Button variant="outline" onClick={() => void loadContext(tenantId)} disabled={savingConfig}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Recalcular puntos
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Recompensas por puntos
          </CardTitle>
          <CardDescription>Definí qué gana el cliente por cada canje.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Puntos requeridos</Label>
              <Input type="number" min={1} value={rewardPointsInput} onChange={(e) => setRewardPointsInput(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Recompensa</Label>
              <Input value={rewardTitle} onChange={(e) => setRewardTitle(e.target.value)} placeholder="Ej: 20% OFF en corte" />
            </div>
            <div className="space-y-2">
              <Label>Foto (opcional)</Label>
              <Input type="file" accept="image/*" onChange={(event) => void onRewardImageSelected(event.target.files?.[0] ?? null)} />
              {rewardImageUrl ? (
                <img src={rewardImageUrl} alt="Recompensa" className="h-20 w-20 object-cover rounded-md border" />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Textarea value={rewardNote} onChange={(e) => setRewardNote(e.target.value)} rows={3} placeholder="Condiciones del canje" />
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={saveReward} disabled={savingReward || rewardTitle.trim().length < 2}>
              {savingReward ? 'Guardando...' : rewardId ? 'Actualizar recompensa' : 'Agregar recompensa'}
            </Button>
            {rewardId ? (
              <Button variant="outline" onClick={clearRewardForm}>
                Cancelar edición
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            {(context?.rewards ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay recompensas cargadas.</p>
            ) : (
              context?.rewards.map((reward) => (
                <div key={reward.id} className="rounded-md border p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{reward.title}</p>
                    <p className="text-xs text-muted-foreground">{reward.pointsRequired} puntos requeridos</p>
                    {reward.note ? <p className="text-xs mt-1 text-muted-foreground">{reward.note}</p> : null}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => editReward(reward)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void removeReward(reward.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clientes y puntos</CardTitle>
          <CardDescription>Listado actualizado según turnos completados.</CardDescription>
        </CardHeader>
        <CardContent>
          {(context?.customers ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-sm text-muted-foreground">
              No hay clientes con puntos en este negocio todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">Cliente</th>
                    <th className="py-2 pr-2">Teléfono</th>
                    <th className="py-2 pr-2">Puntos</th>
                    <th className="py-2 pr-2">Visitas</th>
                    <th className="py-2 pr-2">Gastado</th>
                    <th className="py-2 pr-2">Última visita</th>
                  </tr>
                </thead>
                <tbody>
                  {context?.customers.map((customer) => (
                    <tr key={customer.customerUserId} className="border-b last:border-b-0">
                      <td className="py-2 pr-2 font-medium">{customer.fullName ?? 'Cliente'}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{customer.phone}</td>
                      <td className="py-2 pr-2">
                        <Badge>{customer.points}</Badge>
                      </td>
                      <td className="py-2 pr-2">{customer.bookingsCount}</td>
                      <td className="py-2 pr-2">{formatMoney(customer.spendCents)}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{formatDate(customer.lastBookedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
