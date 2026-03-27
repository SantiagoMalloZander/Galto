'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Landmark, Loader2, Pencil, PlusCircle, Save, Trash2 } from 'lucide-react';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useBranchContext } from '@/hooks/use-branch-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

type ExpenseContext = {
  branch: {
    id: string;
    name: string;
    slug: string;
    timeZone: string;
  };
  services: Array<{
    id: string;
    name: string;
    categoryName: string | null;
    durationMins: number;
    priceCents: number;
    isActive: boolean;
  }>;
  products: Array<{
    id: string;
    name: string;
    priceCents: number;
    stockQuantity: number;
    isActive: boolean;
  }>;
  expenses: Array<{
    id: string;
    name: string;
    description: string | null;
    amountPreTaxCents: number;
    isFixed: boolean;
    category: string;
    recurrence: 'ONE_TIME' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | string;
    isActive: boolean;
    services: Array<{ id: string; name: string }>;
    products: Array<{ id: string; name: string }>;
    createdAt: string;
    updatedAt: string;
  }>;
};

type ExpensePermissions = {
  canRead: boolean;
  canWrite: boolean;
};

const CATEGORY_OPTIONS = [
  { value: 'RENT', label: 'Alquiler' },
  { value: 'UTILITIES', label: 'Servicios (luz/agua/internet)' },
  { value: 'SUPPLIES', label: 'Insumos' },
  { value: 'PRODUCT', label: 'Producto de inventario' },
  { value: 'SERVICE', label: 'Costo por servicio' },
  { value: 'STAFF', label: 'Personal/Comisiones' },
  { value: 'OTHER', label: 'Otro' },
];

const RECURRENCE_OPTIONS = [
  { value: 'ONE_TIME', label: 'Único' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'YEARLY', label: 'Anual' },
];

function centsToArs(cents: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format((Number(cents || 0) / 100) || 0);
}

function arsToCents(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

function recurrenceLabel(value: string) {
  const match = RECURRENCE_OPTIONS.find((option) => option.value === value);
  return match?.label ?? value;
}

function categoryLabel(value: string) {
  const match = CATEGORY_OPTIONS.find((option) => option.value === value);
  return match?.label ?? value;
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export default function GastosPage() {
  const { session } = useAuthSession();
  const { loading: loadingBranchContext, tenant, branches, activeBranchId } = useBranchContext();
  const isPaidPlan = Boolean(session?.accountAccess?.isPaid);

  const [tenantId, setTenantId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [context, setContext] = useState<ExpenseContext | null>(null);
  const [permissions, setPermissions] = useState<ExpensePermissions>({ canRead: false, canWrite: false });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amountArs, setAmountArs] = useState('0');
  const [isFixed, setIsFixed] = useState(true);
  const [category, setCategory] = useState('OTHER');
  const [recurrence, setRecurrence] = useState('MONTHLY');
  const [isActive, setIsActive] = useState(true);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  useEffect(() => {
    setLoading(loadingBranchContext);
    if (!loadingBranchContext) {
      setTenantId(tenant?.tenantId ?? '');
      if (activeBranchId) setBranchId(activeBranchId);
      else if (branches[0]?.id) setBranchId(branches[0].id);
    }
  }, [loadingBranchContext, tenant?.tenantId, activeBranchId, branches]);

  useEffect(() => {
    if (!tenantId || !branchId || !session?.user?.id) return;
    if (!isPaidPlan) {
      setLoading(false);
      setContext(null);
      setPermissions({ canRead: false, canWrite: false });
      setError(null);
      return;
    }
    void loadContext(branchId, tenantId);
  }, [tenantId, branchId, session?.user?.id, isPaidPlan]);

  const serviceByCategory = useMemo(() => {
    const groups = new Map<string, ExpenseContext['services']>();
    for (const service of context?.services ?? []) {
      const key = service.categoryName?.trim() || 'Sin categoría';
      const current = groups.get(key) ?? [];
      current.push(service);
      groups.set(key, current);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'es'));
  }, [context?.services]);

  const summary = useMemo(() => {
    const rows = context?.expenses ?? [];
    const fixed = rows.filter((row) => row.isFixed);
    const variable = rows.filter((row) => !row.isFixed);
    return {
      total: rows.length,
      fixedCount: fixed.length,
      variableCount: variable.length,
      fixedMonthlyCents: fixed
        .filter((row) => row.recurrence === 'MONTHLY')
        .reduce((acc, row) => acc + row.amountPreTaxCents, 0),
      variableMonthlyCents: variable
        .filter((row) => row.recurrence === 'MONTHLY')
        .reduce((acc, row) => acc + row.amountPreTaxCents, 0),
    };
  }, [context?.expenses]);

  function resetForm() {
    setEditingExpenseId(null);
    setName('');
    setDescription('');
    setAmountArs('0');
    setIsFixed(true);
    setCategory('OTHER');
    setRecurrence('MONTHLY');
    setIsActive(true);
    setSelectedServiceIds([]);
    setSelectedProductIds([]);
  }

  async function loadContext(nextBranchId: string, nextTenantId: string) {
    if (!session?.user?.id) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/gastos/branches/${encodeURIComponent(nextBranchId)}?userId=${encodeURIComponent(session.user.id)}&tenantId=${encodeURIComponent(nextTenantId)}`,
        { cache: 'no-store' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudieron cargar gastos');

      setContext(payload?.context ?? null);
      setPermissions(payload?.permissions ?? { canRead: false, canWrite: false });
    } catch (err: any) {
      setError(err?.message ?? 'No se pudieron cargar gastos');
    } finally {
      setLoading(false);
    }
  }

  function startEdit(expenseId: string) {
    const target = context?.expenses.find((row) => row.id === expenseId);
    if (!target) return;
    setEditingExpenseId(target.id);
    setName(target.name);
    setDescription(target.description ?? '');
    setAmountArs(String((target.amountPreTaxCents || 0) / 100));
    setIsFixed(Boolean(target.isFixed));
    setCategory(target.category || 'OTHER');
    setRecurrence(target.recurrence || 'MONTHLY');
    setIsActive(Boolean(target.isActive));
    setSelectedServiceIds(target.services.map((item) => item.id));
    setSelectedProductIds(target.products.map((item) => item.id));
  }

  async function handleSaveExpense() {
    if (!session?.user?.id || !tenantId || !branchId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/gastos/branches/${encodeURIComponent(branchId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          expenseId: editingExpenseId ?? undefined,
          name,
          description: description || null,
          amountPreTaxCents: arsToCents(amountArs),
          isFixed,
          category,
          recurrence,
          isActive,
          serviceIds: selectedServiceIds,
          productIds: selectedProductIds,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo guardar el gasto');
      setMessage(editingExpenseId ? 'Gasto actualizado.' : 'Gasto creado.');
      resetForm();
      await loadContext(branchId, tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo guardar el gasto');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!session?.user?.id || !tenantId || !branchId) return;
    const confirmed = window.confirm('Este gasto se va a borrar de esta sucursal. ¿Continuar?');
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/gastos/branches/${encodeURIComponent(branchId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          expenseId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo borrar el gasto');
      setMessage('Gasto eliminado.');
      if (editingExpenseId === expenseId) {
        resetForm();
      }
      await loadContext(branchId, tenantId);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo borrar el gasto');
    } finally {
      setSaving(false);
    }
  }

  function toggleSelection(current: string[], id: string) {
    return current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-sm text-muted-foreground">Cargando gastos...</CardContent>
        </Card>
      </div>
    );
  }

  if (!isPaidPlan) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Gastos disponible solo para plan de pago</CardTitle>
            <CardDescription>
              Activá un plan pago para cargar costos fijos y variables, y medir rentabilidad.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/app/planes">Ir a Planes y pagos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold mb-2">Gastos del negocio</h1>
          <p className="text-muted-foreground">Cargá costos pre-impuestos para medir rentabilidad por servicio e inventario.</p>
        </div>
        <Badge className="gap-2 py-2 px-3">
          <Landmark className="h-4 w-4" />
          {context?.branch?.name ?? 'Sucursal'}
        </Badge>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Resumen rápido</CardTitle>
          <CardDescription>Todos los montos son sin impuestos.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Total gastos</p>
            <p className="text-2xl font-semibold">{summary.total}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Fijos</p>
            <p className="text-2xl font-semibold">{summary.fixedCount}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Variables</p>
            <p className="text-2xl font-semibold">{summary.variableCount}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Mensual (estimado)</p>
            <p className="text-lg font-semibold">{centsToArs(summary.fixedMonthlyCents + summary.variableMonthlyCents)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingExpenseId ? 'Editar gasto' : 'Agregar gasto'}</CardTitle>
          <CardDescription>
            Si es fijo no requiere asociación. Si es variable, asociá el costo a servicios y/o productos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre del gasto</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej: Alquiler local / Tinta premium / Shampoo"
                disabled={!permissions.canWrite || saving}
              />
            </div>
            <div className="space-y-2">
              <Label>Monto pre-impuestos (ARS)</Label>
              <Input
                value={amountArs}
                onChange={(event) => setAmountArs(event.target.value)}
                placeholder="0"
                disabled={!permissions.canWrite || saving}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={setCategory} disabled={!permissions.canWrite || saving}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frecuencia</Label>
              <Select value={recurrence} onValueChange={setRecurrence} disabled={!permissions.canWrite || saving}>
                <SelectTrigger>
                  <SelectValue placeholder="Frecuencia" />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-3 flex items-center justify-between">
              <div>
                <p className="font-medium">Gasto fijo</p>
                <p className="text-xs text-muted-foreground">Si no está activo, se considera variable.</p>
              </div>
              <Switch checked={isFixed} onCheckedChange={setIsFixed} disabled={!permissions.canWrite || saving} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción (opcional)</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Detalle adicional del gasto"
              disabled={!permissions.canWrite || saving}
            />
          </div>

          <div className="rounded-md border p-3 flex items-center justify-between">
            <div>
              <p className="font-medium">Gasto activo</p>
              <p className="text-xs text-muted-foreground">Podés desactivarlo sin borrarlo.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={!permissions.canWrite || saving} />
          </div>

          {!isFixed ? (
            <div className="space-y-4 rounded-lg border p-4 bg-muted/30">
              <p className="text-sm font-medium">
                Asociaciones del gasto variable (obligatorio al menos 1 servicio o 1 producto)
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <p className="text-sm font-medium">Servicios</p>
                  <div className="max-h-60 overflow-auto rounded-md border bg-background p-2 space-y-2">
                    {serviceByCategory.length === 0 ? <p className="text-xs text-muted-foreground">No hay servicios cargados.</p> : null}
                    {serviceByCategory.map(([group, services]) => (
                      <div key={group} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground px-1">{group}</p>
                        {services.map((service) => (
                          <label key={service.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedServiceIds.includes(service.id)}
                              onChange={() => setSelectedServiceIds((current) => toggleSelection(current, service.id))}
                              disabled={!permissions.canWrite || saving}
                            />
                            <span className="text-sm">{service.name}</span>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Inventario</p>
                  <div className="max-h-60 overflow-auto rounded-md border bg-background p-2 space-y-2">
                    {context?.products.length === 0 ? <p className="text-xs text-muted-foreground">No hay productos cargados.</p> : null}
                    {(context?.products ?? []).map((product) => (
                      <label key={product.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(product.id)}
                          onChange={() => setSelectedProductIds((current) => toggleSelection(current, product.id))}
                          disabled={!permissions.canWrite || saving}
                        />
                        <span className="text-sm">{product.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={handleSaveExpense} disabled={!permissions.canWrite || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editingExpenseId ? 'Guardar cambios' : 'Guardar gasto'}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Nuevo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gastos cargados</CardTitle>
          <CardDescription>Fijos para estructura general, variables para calcular rentabilidad por servicio/ítem.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(context?.expenses ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay gastos cargados en esta sucursal.</p>
          ) : (
            (context?.expenses ?? []).map((expense) => (
              <div key={expense.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <p className="font-semibold">{expense.name}</p>
                    <p className="text-sm text-muted-foreground">{expense.description ?? 'Sin descripción'}</p>
                    <p className="text-xs text-muted-foreground">
                      Actualizado: {formatDate(expense.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={expense.isFixed ? 'default' : 'secondary'}>
                      {expense.isFixed ? 'Fijo' : 'Variable'}
                    </Badge>
                    <Badge variant="outline">{categoryLabel(expense.category)}</Badge>
                    <Badge variant="outline">{recurrenceLabel(expense.recurrence)}</Badge>
                    <Badge variant={expense.isActive ? 'secondary' : 'destructive'}>
                      {expense.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                    <Badge className="font-semibold">{centsToArs(expense.amountPreTaxCents)}</Badge>
                  </div>
                </div>

                {!expense.isFixed ? (
                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border p-3">
                      <p className="font-medium mb-1">Servicios asociados</p>
                      {expense.services.length === 0 ? (
                        <p className="text-muted-foreground">Sin servicios.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {expense.services.map((service) => (
                            <Badge key={service.id} variant="outline">{service.name}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="font-medium mb-1">Productos asociados</p>
                      {expense.products.length === 0 ? (
                        <p className="text-muted-foreground">Sin productos.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {expense.products.map((product) => (
                            <Badge key={product.id} variant="outline">{product.name}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => startEdit(expense.id)} disabled={!permissions.canWrite || saving}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => void handleDeleteExpense(expense.id)} disabled={!permissions.canWrite || saving}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Borrar
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
