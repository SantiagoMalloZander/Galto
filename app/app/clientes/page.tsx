'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2, Users } from 'lucide-react';
import { getStoredAuthSession } from '@/lib/auth';
import { useBranchContext } from '@/hooks/use-branch-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type CustomerRow = {
  customerId: string;
  customerUserId: string | null;
  fullName: string;
  phone: string;
  isTest: boolean;
  bookingsCount: number;
  purchasesCount: number;
  lastVisitAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CustomerPermissions = {
  canRead: boolean;
  canWrite: boolean;
};

type CustomerFilter = 'ALL' | 'WITH_VISITS' | 'WITHOUT_VISITS' | 'TEST';

function formatDate(iso: string | null) {
  if (!iso) return 'Sin visitas';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export default function ClientesPage() {
  const [session] = useState(() => getStoredAuthSession());
  const { tenant, activeBranchId, branches, loading: branchLoading } = useBranchContext();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [permissions, setPermissions] = useState<CustomerPermissions>({ canRead: false, canWrite: false });
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CustomerFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const tenantId = tenant?.tenantId ?? '';
  const branchId = activeBranchId || branches[0]?.id || '';

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(query.trim());
    }, 280);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    if (branchLoading) return;
    if (!session?.user?.id || !tenantId || !branchId) {
      setLoading(false);
      return;
    }
    void loadCustomers(search, filter);
  }, [branchLoading, session?.user?.id, tenantId, branchId, search, filter]);

  async function loadCustomers(searchTerm = '', currentFilter: CustomerFilter = 'ALL') {
    if (!session?.user?.id || !tenantId || !branchId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        userId: session.user.id,
        tenantId,
        branchId,
      });
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }
      if (currentFilter !== 'ALL') {
        params.set('filter', currentFilter);
      }
      const response = await fetch(`/api/clientes?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudieron cargar clientes');
      setCustomers((payload?.customers ?? []) as CustomerRow[]);
      setPermissions(payload?.permissions ?? { canRead: false, canWrite: false });
    } catch (err: any) {
      setError(err?.message ?? 'No se pudieron cargar clientes');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(customer: CustomerRow) {
    if (!session?.user?.id || !tenantId || !branchId) return;
    const confirmed = window.confirm(
      `Vas a borrar a ${customer.fullName} de este negocio. También se limpia del calendario, puntos y cobros del tenant.`
    );
    if (!confirmed) return;

    setDeletingId(customer.customerId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/clientes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          branchId,
          customerId: customer.customerId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo borrar el cliente');
      setMessage('Cliente borrado del negocio.');
      setCustomers((current) => current.filter((item) => item.customerId !== customer.customerId));
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo borrar el cliente');
    } finally {
      setDeletingId(null);
    }
  }

  const summary = useMemo(() => {
    return {
      total: customers.length,
      tests: customers.filter((customer) => customer.isTest).length,
      withVisits: customers.filter((customer) => customer.bookingsCount > 0 || customer.purchasesCount > 0).length,
      withoutVisits: customers.filter((customer) => customer.bookingsCount === 0 && customer.purchasesCount === 0).length,
      withBookings: customers.filter((customer) => customer.bookingsCount > 0).length,
      withPurchases: customers.filter((customer) => customer.purchasesCount > 0).length,
    };
  }, [customers]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Clientes</h1>
        <p className="text-muted-foreground">
          Base de clientes del negocio. Acá podés buscar, revisar y borrar clientes de verdad.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Buscar clientes
          </CardTitle>
          <CardDescription>
            Esta lista está vinculada al calendario y cobros. Si borrás un cliente acá, desaparece del negocio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="flex-1">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o teléfono"
              />
            </div>
            <Button type="button" onClick={() => setSearch(query.trim())}>
              <Search className="mr-2 h-4 w-4" />
              Buscar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={filter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('ALL')}
            >
              Todos
            </Button>
            <Button
              type="button"
              variant={filter === 'WITH_VISITS' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('WITH_VISITS')}
            >
              Con visitas
            </Button>
            <Button
              type="button"
              variant={filter === 'WITHOUT_VISITS' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('WITHOUT_VISITS')}
            >
              Sin visitas
            </Button>
            <Button
              type="button"
              variant={filter === 'TEST' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('TEST')}
            >
              Prueba
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">Clientes: {summary.total}</Badge>
            <Badge variant="outline">Con visitas: {summary.withVisits}</Badge>
            <Badge variant="outline">Sin visitas: {summary.withoutVisits}</Badge>
            <Badge variant="outline">Con reservas: {summary.withBookings}</Badge>
            <Badge variant="outline">Con cobros: {summary.withPurchases}</Badge>
            <Badge variant="outline">Prueba: {summary.tests}</Badge>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando clientes...</p>
          ) : customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay clientes para mostrar.</p>
          ) : (
            <div className="space-y-3">
              {customers.map((customer) => (
                <div key={customer.customerId} className="rounded-xl border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{customer.fullName}</p>
                      {customer.isTest ? <Badge variant="outline">Prueba</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>Reservas: {customer.bookingsCount}</span>
                      <span>Cobros: {customer.purchasesCount}</span>
                      <span>Última visita: {formatDate(customer.lastVisitAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {customer.bookingsCount > 0 && customer.purchasesCount > 0 ? (
                      <Badge variant="secondary">Ambas</Badge>
                    ) : customer.bookingsCount > 0 ? (
                      <Badge variant="outline">Tiene reservas</Badge>
                    ) : customer.purchasesCount > 0 ? (
                      <Badge variant="outline">Tiene cobros</Badge>
                    ) : null}
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={!permissions.canWrite || deletingId === customer.customerId}
                      onClick={() => void handleDelete(customer)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deletingId === customer.customerId ? 'Borrando...' : 'Borrar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
