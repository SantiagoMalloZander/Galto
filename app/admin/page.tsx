'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Building2, CreditCard, Headphones, Trash2, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type PlanType = 'DEMO' | 'PAID_FULL';
type MemberRole = 'OWNER' | 'MANAGER' | 'EMPLOYEE';
type AdminView = 'dashboard' | 'tenants' | 'payments' | 'customers' | 'support';

type TenantPlan = {
  tenantId: string;
  planType: PlanType;
  isPaid: boolean;
  enabledApps: string[];
  demoEndsAt: string | null;
  updatedAt: string;
};

type AdminTenantMember = {
  membershipId: string;
  role: MemberRole;
  userId: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  branchAccessCount: number;
};

type AdminTenant = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  plan: TenantPlan;
  members: AdminTenantMember[];
};

type PendingPaymentRequest = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  requestedByUserId: string;
  requestedByEmail: string;
  planType: 'PAID_FULL';
  selectedApps: string[];
  status: 'PENDING';
  cbu: string;
  createdAt: string;
  confirmedAt: string | null;
};

type AdminCustomerAccount = {
  id: string;
  phone: string;
  fullName: string | null;
  createdAt: string;
  updatedAt: string;
  tenants: Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    points: number;
    bookingsCount: number;
    lastBookedAt: string | null;
  }>;
};

type GlobalStats = {
  tenants: number;
  branches: number;
  customers: number;
  appointments: number;
  pendingPayments: number;
};

type SupportPurchaseAdmin = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  userFullName: string | null;
  contactName: string;
  contactPhone: string;
  packageCode: string;
  packageLabel: string;
  hoursQty: number;
  amountArs: number;
  paymentMethod: 'MERCADOPAGO' | 'TRANSFER';
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  serviceStatus: 'PENDING' | 'DONE';
  cbu: string | null;
  checkoutUrl: string | null;
  mercadoPagoPreferenceId: string | null;
  mercadoPagoPaymentId: string | null;
  mercadoPagoStatus: string | null;
  summaryBusinessContext: string | null;
  summaryNeed: string | null;
  summaryGoal: string | null;
  summaryNotes: string | null;
  summaryCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  serviceCompletedAt: string | null;
};

const APPS = [
  'reservas',
  'calendario',
  'cuentas',
  'lead_finder',
  'dashboard',
  'puntos',
  'recompensas',
  'contenido',
] as const;

const VIEW_OPTIONS: Array<{ id: AdminView; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Resumen', icon: BarChart3 },
  { id: 'tenants', label: 'Tenants', icon: Building2 },
  { id: 'payments', label: 'Pagos pendientes', icon: CreditCard },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'support', label: 'Soporte', icon: Headphones },
];

function planTypeLabel(planType: PlanType | PendingPaymentRequest['planType']) {
  if (planType === 'DEMO') return 'Gratis';
  return 'Profesional';
}

export default function AdminPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<AdminView>('dashboard');

  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingPaymentRequest[]>([]);
  const [customers, setCustomers] = useState<AdminCustomerAccount[]>([]);
  const [supportPurchases, setSupportPurchases] = useState<SupportPurchaseAdmin[]>([]);
  const [stats, setStats] = useState<GlobalStats>({
    tenants: 0,
    branches: 0,
    customers: 0,
    appointments: 0,
    pendingPayments: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tenantFilter, setTenantFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [planFilter, setPlanFilter] = useState<'ALL' | 'DEMO' | 'PAID'>('ALL');

  const [passwordByUser, setPasswordByUser] = useState<Record<string, string>>({});
  const [planByTenant, setPlanByTenant] = useState<
    Record<string, { planType: PlanType; isPaid: boolean; demoEndsAt: string; enabledAppsText: string }>
  >({});
  const [roleByMembership, setRoleByMembership] = useState<Record<string, MemberRole>>({});

  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);

  async function loadAdminData() {
    setLoading(true);
    setError(null);

    try {
      const [tenantsResponse, requestsResponse, customersResponse, statsResponse, supportResponse] = await Promise.all([
        fetch('/api/admin/tenants', { cache: 'no-store' }),
        fetch('/api/admin/payment-requests', { cache: 'no-store' }),
        fetch('/api/admin/customers', { cache: 'no-store' }),
        fetch('/api/admin/stats', { cache: 'no-store' }),
        fetch('/api/admin/support-purchases', { cache: 'no-store' }),
      ]);

      if (
        tenantsResponse.status === 401 ||
        requestsResponse.status === 401 ||
        customersResponse.status === 401 ||
        statsResponse.status === 401 ||
        supportResponse.status === 401
      ) {
        router.replace('/admin/login');
        return;
      }

      const tenantsPayload = await tenantsResponse.json().catch(() => ({}));
      const requestsPayload = await requestsResponse.json().catch(() => ({}));
      const customersPayload = await customersResponse.json().catch(() => ({}));
      const statsPayload = await statsResponse.json().catch(() => ({}));
      const supportPayload = await supportResponse.json().catch(() => ({}));

      if (!tenantsResponse.ok) throw new Error(tenantsPayload?.message ?? 'No se pudieron cargar tenants');
      if (!requestsResponse.ok) throw new Error(requestsPayload?.message ?? 'No se pudieron cargar solicitudes de pago');
      if (!customersResponse.ok) throw new Error(customersPayload?.message ?? 'No se pudieron cargar clientes');
      if (!statsResponse.ok) throw new Error(statsPayload?.message ?? 'No se pudieron cargar métricas');
      if (!supportResponse.ok) throw new Error(supportPayload?.message ?? 'No se pudo cargar soporte');

      const nextTenants = (tenantsPayload?.tenants ?? []) as AdminTenant[];
      setTenants(nextTenants);
      setPendingRequests((requestsPayload?.requests ?? []) as PendingPaymentRequest[]);
      setCustomers((customersPayload?.customers ?? []) as AdminCustomerAccount[]);
      setStats((statsPayload?.stats ?? {}) as GlobalStats);
      setSupportPurchases((supportPayload?.purchases ?? []) as SupportPurchaseAdmin[]);

      const nextPlanByTenant: Record<
        string,
        { planType: PlanType; isPaid: boolean; demoEndsAt: string; enabledAppsText: string }
      > = {};
      const nextRoleByMembership: Record<string, MemberRole> = {};

      for (const tenant of nextTenants) {
        nextPlanByTenant[tenant.tenantId] = {
          planType: tenant.plan.planType,
          isPaid: tenant.plan.isPaid,
          demoEndsAt: tenant.plan.demoEndsAt ? tenant.plan.demoEndsAt.slice(0, 10) : '',
          enabledAppsText: tenant.plan.enabledApps.join(', '),
        };

        for (const member of tenant.members) {
          nextRoleByMembership[member.membershipId] = member.role;
        }
      }

      setPlanByTenant(nextPlanByTenant);
      setRoleByMembership(nextRoleByMembership);
    } catch (err: any) {
      setError(err?.message ?? 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  const filteredTenants = useMemo(() => {
    const q = tenantFilter.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesText =
        !q ||
        tenant.tenantName.toLowerCase().includes(q) ||
        tenant.tenantSlug.toLowerCase().includes(q) ||
        tenant.members.some((member) => member.email.toLowerCase().includes(q) || (member.fullName ?? '').toLowerCase().includes(q));

      if (!matchesText) return false;
      if (planFilter === 'ALL') return true;
      if (planFilter === 'DEMO') return tenant.plan.planType === 'DEMO';
      return tenant.plan.planType === 'PAID_FULL';
    });
  }, [tenantFilter, tenants, planFilter]);

  const filteredCustomers = useMemo(() => {
    const q = customerFilter.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) => {
      if (customer.phone.toLowerCase().includes(q)) return true;
      if ((customer.fullName ?? '').toLowerCase().includes(q)) return true;
      return customer.tenants.some(
        (tenantRow) => tenantRow.tenantName.toLowerCase().includes(q) || tenantRow.tenantSlug.toLowerCase().includes(q),
      );
    });
  }, [customers, customerFilter]);

  const pendingSupportPurchases = useMemo(
    () => supportPurchases.filter((purchase) => purchase.serviceStatus !== 'DONE'),
    [supportPurchases],
  );
  const completedSupportPurchases = useMemo(
    () => supportPurchases.filter((purchase) => purchase.serviceStatus === 'DONE'),
    [supportPurchases],
  );

  async function updatePassword(userId: string) {
    const password = (passwordByUser[userId] ?? '').trim();
    if (password.length < 8) {
      alert('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const response = await fetch(`/api/admin/users/${userId}/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload?.message ?? 'No se pudo actualizar contraseña');
      return;
    }

    setPasswordByUser((prev) => ({ ...prev, [userId]: '' }));
    alert('Contraseña actualizada');
    void loadAdminData();
  }

  async function updateTenantPlan(tenantId: string) {
    const state = planByTenant[tenantId];
    if (!state) return;

    const enabledApps = state.enabledAppsText
      .split(',')
      .map((item) => item.trim())
      .filter((item): item is (typeof APPS)[number] => APPS.includes(item as (typeof APPS)[number]));

    const response = await fetch(`/api/admin/tenants/${tenantId}/plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planType: state.planType,
        isPaid: state.isPaid,
        demoEndsAt: state.demoEndsAt ? `${state.demoEndsAt}T23:59:59.000Z` : null,
        enabledApps,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload?.message ?? 'No se pudo actualizar plan');
      return;
    }

    alert('Plan actualizado');
    void loadAdminData();
  }

  async function updateRole(membershipId: string) {
    const role = roleByMembership[membershipId];
    if (!role) return;

    const response = await fetch(`/api/admin/memberships/${membershipId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload?.message ?? 'No se pudo actualizar rol');
      return;
    }

    alert('Rol actualizado');
    void loadAdminData();
  }

  async function confirmPayment(requestId: string) {
    const response = await fetch(`/api/admin/payment-requests/${requestId}/confirm`, { method: 'PATCH' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload?.message ?? 'No se pudo confirmar pago');
      return;
    }

    alert('Pago confirmado y plan activado');
    void loadAdminData();
  }

  async function deleteTenant(tenantId: string, tenantSlug: string) {
    const confirmation = window.prompt(`Para borrar este tenant escribí el slug exactamente: ${tenantSlug}`);
    if (!confirmation) return;
    if (confirmation.trim() !== tenantSlug) {
      alert('El slug no coincide. No se borró el tenant.');
      return;
    }

    setDeletingTenantId(tenantId);
    try {
      const response = await fetch(`/api/admin/tenants/${tenantId}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(payload?.message ?? 'No se pudo borrar el tenant');
        return;
      }
      alert('Tenant borrado correctamente.');
      void loadAdminData();
    } finally {
      setDeletingTenantId(null);
    }
  }

  async function deleteCustomer(customerId: string, phone: string) {
    const confirmation = window.prompt(`Para borrar esta cuenta cliente escribí el teléfono: ${phone}`);
    if (!confirmation) return;
    if (confirmation.trim() !== phone) {
      alert('El teléfono no coincide. No se borró la cuenta.');
      return;
    }

    setDeletingCustomerId(customerId);
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(payload?.message ?? 'No se pudo borrar la cuenta cliente');
        return;
      }
      alert('Cuenta cliente borrada correctamente.');
      void loadAdminData();
    } finally {
      setDeletingCustomerId(null);
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  }

  const maxMetric = Math.max(stats.tenants || 0, stats.branches || 0, stats.customers || 0, stats.appointments || 0, 1);

  async function confirmSupportTransfer(purchaseId: string) {
    const response = await fetch(`/api/admin/support-purchases/${encodeURIComponent(purchaseId)}/confirm-transfer`, {
      method: 'PATCH',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload?.message ?? 'No se pudo confirmar esta transferencia');
      return;
    }
    alert('Transferencia de soporte confirmada.');
    void loadAdminData();
  }

  async function completeSupportService(purchaseId: string) {
    const response = await fetch(`/api/admin/support-purchases/${encodeURIComponent(purchaseId)}/complete-service`, {
      method: 'PATCH',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert(payload?.message ?? 'No se pudo marcar este soporte como realizado');
      return;
    }
    alert('Servicio de soporte marcado como realizado.');
    void loadAdminData();
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-muted/20 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Panel Admin Global</CardTitle>
          <Button variant="outline" onClick={logout}>Cerrar sesión admin</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Panel organizado por secciones para gestionar operación global.
          </p>
          <div className="flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((option) => (
              <Button
                key={option.id}
                variant={activeView === option.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView(option.id)}
                className="gap-2"
              >
                <option.icon className="h-4 w-4" />
                {option.label}
              </Button>
            ))}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-6">Cargando panel admin...</CardContent>
        </Card>
      ) : null}

      {!loading && activeView === 'dashboard' ? (
        <Card>
          <CardHeader>
            <CardTitle>Gráficos generales de Galto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="Clientes" value={stats.customers} />
              <MetricCard title="Tenants" value={stats.tenants} />
              <MetricCard title="Sucursales" value={stats.branches} />
              <MetricCard title="Reservas" value={stats.appointments} />
            </div>

            <div className="space-y-3">
              <MetricBar title="Clientes" value={stats.customers} max={maxMetric} colorClass="bg-sky-500" />
              <MetricBar title="Tenants" value={stats.tenants} max={maxMetric} colorClass="bg-indigo-500" />
              <MetricBar title="Sucursales" value={stats.branches} max={maxMetric} colorClass="bg-emerald-500" />
              <MetricBar title="Reservas" value={stats.appointments} max={maxMetric} colorClass="bg-amber-500" />
              <MetricBar title="Pagos pendientes" value={stats.pendingPayments} max={Math.max(stats.pendingPayments, 1)} colorClass="bg-rose-500" />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && activeView === 'payments' ? (
        <Card>
          <CardHeader>
            <CardTitle>Solicitudes de pago pendientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
            ) : (
              pendingRequests.map((request) => (
                <div key={request.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge>{planTypeLabel(request.planType)}</Badge>
                    <span className="text-sm font-medium">{request.tenantName} ({request.tenantSlug})</span>
                    <span className="text-xs text-muted-foreground">Solicitado por: {request.requestedByEmail}</span>
                  </div>
                  <p className="text-sm">CBU informado: <strong>{request.cbu}</strong></p>
                  <Button size="sm" onClick={() => confirmPayment(request.id)}>Confirmar pago</Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}

      {!loading && activeView === 'tenants' ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Filtro de tenants</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenant-filter">Buscar tenant o cuenta</Label>
                <Input
                  id="tenant-filter"
                  value={tenantFilter}
                  onChange={(e) => setTenantFilter(e.target.value)}
                  placeholder="tenant, slug, email o nombre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-filter">Filtrar por plan</Label>
                <select
                  id="plan-filter"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value as 'ALL' | 'DEMO' | 'PAID')}
                >
                  <option value="ALL">Todos</option>
                  <option value="DEMO">Solo gratis</option>
                  <option value="PAID">Solo plan de pago</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {filteredTenants.map((tenant) => {
            const currentPlan = planByTenant[tenant.tenantId] ?? {
              planType: tenant.plan.planType,
              isPaid: tenant.plan.isPaid,
              demoEndsAt: tenant.plan.demoEndsAt ? tenant.plan.demoEndsAt.slice(0, 10) : '',
              enabledAppsText: tenant.plan.enabledApps.join(', '),
            };

            return (
              <Card key={tenant.tenantId}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span>{tenant.tenantName}</span>
                      <Badge variant="outline">{tenant.tenantSlug}</Badge>
                      <Badge variant={tenant.plan.planType === 'DEMO' ? 'secondary' : 'default'}>{planTypeLabel(tenant.plan.planType)}</Badge>
                      <a
                        className="text-xs underline"
                        target="_blank"
                        href={`https://galto.online/reservas?tenant=${encodeURIComponent(tenant.tenantSlug)}`}
                        rel="noreferrer"
                      >
                        Abrir página pública
                      </a>
                    </span>

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deletingTenantId === tenant.tenantId}
                      onClick={() => deleteTenant(tenant.tenantId, tenant.tenantSlug)}
                      title="Borrar tenant"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Plan</Label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={currentPlan.planType}
                        onChange={(e) =>
                          setPlanByTenant((prev) => ({
                            ...prev,
                            [tenant.tenantId]: {
                              ...currentPlan,
                              planType: e.target.value as PlanType,
                            },
                          }))
                        }
                      >
                        <option value="DEMO">DEMO</option>
                        <option value="PAID_FULL">Profesional</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>¿Pago activo?</Label>
                      <div className="h-10 flex items-center">
                        <input
                          type="checkbox"
                          checked={currentPlan.isPaid}
                          onChange={(e) =>
                            setPlanByTenant((prev) => ({
                              ...prev,
                              [tenant.tenantId]: {
                                ...currentPlan,
                                isPaid: e.target.checked,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Fin de demo (YYYY-MM-DD)</Label>
                      <Input
                        value={currentPlan.demoEndsAt}
                        onChange={(e) =>
                          setPlanByTenant((prev) => ({
                            ...prev,
                            [tenant.tenantId]: {
                              ...currentPlan,
                              demoEndsAt: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Apps habilitadas (coma separadas)</Label>
                      <Input
                        value={currentPlan.enabledAppsText}
                        onChange={(e) =>
                          setPlanByTenant((prev) => ({
                            ...prev,
                            [tenant.tenantId]: {
                              ...currentPlan,
                              enabledAppsText: e.target.value,
                            },
                          }))
                        }
                        placeholder="reservas, calendario, dashboard"
                      />
                    </div>
                  </div>

                  <Button onClick={() => updateTenantPlan(tenant.tenantId)}>Guardar plan de negocio</Button>

                  <div className="space-y-3">
                    <p className="text-sm font-semibold">Cuentas del negocio</p>
                    {tenant.members.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay usuarios en este tenant.</p>
                    ) : (
                      tenant.members.map((member) => (
                        <div key={member.membershipId} className="border rounded-md p-3 space-y-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{member.fullName || '(Sin nombre)'}</span>
                            <span className="text-xs text-muted-foreground">{member.email}</span>
                            <Badge variant="secondary">{member.role}</Badge>
                            <span className="text-xs text-muted-foreground">Accesos sucursal: {member.branchAccessCount}</span>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3 items-end">
                            <div className="space-y-2">
                              <Label>Rol</Label>
                              <select
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={roleByMembership[member.membershipId] ?? member.role}
                                onChange={(e) =>
                                  setRoleByMembership((prev) => ({
                                    ...prev,
                                    [member.membershipId]: e.target.value as MemberRole,
                                  }))
                                }
                              >
                                <option value="OWNER">OWNER</option>
                                <option value="MANAGER">MANAGER</option>
                                <option value="EMPLOYEE">EMPLOYEE</option>
                              </select>
                            </div>

                            <Button onClick={() => updateRole(member.membershipId)}>Guardar rol</Button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-[1fr_auto] items-end">
                            <div className="space-y-2">
                              <Label>Nueva contraseña global de este usuario</Label>
                              <Input
                                type="text"
                                placeholder="mínimo 8 caracteres"
                                value={passwordByUser[member.userId] ?? ''}
                                onChange={(e) => setPasswordByUser((prev) => ({ ...prev, [member.userId]: e.target.value }))}
                              />
                            </div>
                            <Button variant="outline" onClick={() => updatePassword(member.userId)}>Cambiar contraseña</Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredTenants.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">No hay tenants con ese filtro.</CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {!loading && activeView === 'customers' ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Buscar cuentas de clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-w-md">
                <Label htmlFor="customer-filter">Buscar por teléfono, nombre o tenant</Label>
                <Input
                  id="customer-filter"
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  placeholder="+549..., nombre, tenant"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cuentas de clientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredCustomers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay cuentas de clientes para mostrar.</p>
              ) : (
                filteredCustomers.map((customer) => (
                  <div key={customer.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{customer.fullName || '(Sin nombre)'}</span>
                        <Badge variant="outline">{customer.phone}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Alta: {new Date(customer.createdAt).toLocaleString('es-AR')}
                        </span>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deletingCustomerId === customer.id}
                        onClick={() => deleteCustomer(customer.id, customer.phone)}
                        title="Borrar cuenta cliente"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>

                    {customer.tenants.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sin actividad por tenant todavía.</p>
                    ) : (
                      <div className="space-y-1">
                        {customer.tenants.map((tenantRow) => (
                          <div key={`${customer.id}-${tenantRow.tenantId}`} className="text-xs rounded border p-2 flex flex-wrap gap-2">
                            <span className="font-medium">
                              {tenantRow.tenantName} ({tenantRow.tenantSlug})
                            </span>
                            <span>Puntos: {tenantRow.points}</span>
                            <span>Reservas: {tenantRow.bookingsCount}</span>
                            <span>
                              Última: {tenantRow.lastBookedAt ? new Date(tenantRow.lastBookedAt).toLocaleString('es-AR') : '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {!loading && activeView === 'support' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Soportes por hacer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingSupportPurchases.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay servicios pendientes.</p>
              ) : (
                pendingSupportPurchases.map((purchase) => (
                  <div key={purchase.id} className="border rounded-md p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={purchase.status === 'PAID' ? 'default' : 'secondary'}>{purchase.status}</Badge>
                      <Badge variant="outline">{purchase.paymentMethod}</Badge>
                      <Badge variant={purchase.serviceStatus === 'DONE' ? 'default' : 'secondary'}>
                        {purchase.serviceStatus === 'DONE' ? 'HECHO' : 'PENDIENTE'}
                      </Badge>
                      <span className="text-sm font-medium">
                        {purchase.tenantName} ({purchase.tenantSlug})
                      </span>
                    </div>
                    <p className="text-sm">
                      Cliente soporte: <strong>{purchase.contactName}</strong> · {purchase.contactPhone}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Usuario: {purchase.userFullName || '-'} ({purchase.userEmail})
                    </p>
                    <p className="text-sm">
                      Paquete: <strong>{purchase.packageLabel}</strong> · {purchase.hoursQty}h · ${purchase.amountArs}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Compra: {new Date(purchase.createdAt).toLocaleString('es-AR')} · Pago:{' '}
                      {purchase.paidAt ? new Date(purchase.paidAt).toLocaleString('es-AR') : '-'}
                    </p>
                    {purchase.paymentMethod === 'TRANSFER' && purchase.status === 'PENDING' ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">CBU: {purchase.cbu}</span>
                        <Button size="sm" onClick={() => confirmSupportTransfer(purchase.id)}>
                          Confirmar transferencia
                        </Button>
                      </div>
                    ) : null}
                    {purchase.status === 'PAID' && purchase.serviceStatus !== 'DONE' ? (
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => completeSupportService(purchase.id)}>
                          Marcar soporte como hecho
                        </Button>
                      </div>
                    ) : null}
                    <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                      <p><strong>Contexto:</strong> {purchase.summaryBusinessContext || '-'}</p>
                      <p><strong>Necesidad:</strong> {purchase.summaryNeed || '-'}</p>
                      <p><strong>Objetivo:</strong> {purchase.summaryGoal || '-'}</p>
                      <p><strong>Notas:</strong> {purchase.summaryNotes || '-'}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Soportes ya hechos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {completedSupportPurchases.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no hay servicios marcados como hechos.</p>
              ) : (
                completedSupportPurchases.map((purchase) => (
                  <div key={purchase.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={purchase.status === 'PAID' ? 'default' : 'secondary'}>{purchase.status}</Badge>
                    <Badge variant="outline">{purchase.paymentMethod}</Badge>
                    <Badge>HECHO</Badge>
                    <span className="text-sm font-medium">
                      {purchase.tenantName} ({purchase.tenantSlug})
                    </span>
                  </div>
                  <p className="text-sm">
                    Cliente soporte: <strong>{purchase.contactName}</strong> · {purchase.contactPhone}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Usuario: {purchase.userFullName || '-'} ({purchase.userEmail})
                  </p>
                  <p className="text-sm">
                    Paquete: <strong>{purchase.packageLabel}</strong> · {purchase.hoursQty}h · ${purchase.amountArs}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Compra: {new Date(purchase.createdAt).toLocaleString('es-AR')} · Pago:{' '}
                    {purchase.paidAt ? new Date(purchase.paidAt).toLocaleString('es-AR') : '-'}
                    {' '}· Hecho: {purchase.serviceCompletedAt ? new Date(purchase.serviceCompletedAt).toLocaleString('es-AR') : '-'}
                  </p>
                  <div className="rounded-md border bg-muted/30 p-2 text-xs space-y-1">
                    <p><strong>Contexto:</strong> {purchase.summaryBusinessContext || '-'}</p>
                    <p><strong>Necesidad:</strong> {purchase.summaryNeed || '-'}</p>
                    <p><strong>Objetivo:</strong> {purchase.summaryGoal || '-'}</p>
                    <p><strong>Notas:</strong> {purchase.summaryNotes || '-'}</p>
                  </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{Number(value || 0).toLocaleString('es-AR')}</p>
    </div>
  );
}

function MetricBar({
  title,
  value,
  max,
  colorClass,
}: {
  title: string;
  value: number;
  max: number;
  colorClass: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round((Number(value || 0) / Math.max(max, 1)) * 100)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{title}</span>
        <span className="font-medium">{Number(value || 0).toLocaleString('es-AR')}</span>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
