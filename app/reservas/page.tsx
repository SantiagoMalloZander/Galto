'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, Building2, CheckCircle2, ChevronRight, Clock3, MapPin, Sparkles, Users2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type BranchItem = {
  id: string;
  name: string;
  slug: string;
  allowChooseEmployee?: boolean;
  assignmentStrategy?: string;
  profilePhotoUrl?: string | null;
  bannerPhotoUrl?: string | null;
};

type TenantVisual = {
  id: string;
  slug: string;
  name: string;
  logoPhotoUrl?: string | null;
  bannerPhotoUrl?: string | null;
};

function ReservasLandingContent() {
  const searchParams = useSearchParams();
  const tenant = searchParams.get('tenant')?.trim() ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [tenantVisual, setTenantVisual] = useState<TenantVisual | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      if (!tenant) {
        setLoading(false);
        setError('Falta el parámetro tenant en la URL.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/public-booking/tenant/${encodeURIComponent(tenant)}`, { cache: 'no-store' });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.message ?? 'No se pudieron cargar las sucursales');
        }

        if (!active) return;
        setTenantName(String(payload?.tenant?.name ?? tenant));
        setTenantVisual((payload?.tenant ?? null) as TenantVisual | null);
        setBranches(Array.isArray(payload?.branches) ? payload.branches : []);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? 'No se pudieron cargar las sucursales');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [tenant]);

  const filteredBranches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return branches;
    return branches.filter((branch) => {
      const haystack = `${branch.name} ${branch.slug}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [branches, query]);

  const hasBranches = useMemo(() => filteredBranches.length > 0, [filteredBranches]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f1f6ff_42%,#f7fafc_100%)]">
      <div className="pointer-events-none absolute -left-28 top-8 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-300/20 blur-3xl" />

      <section className="mx-auto max-w-6xl px-4 py-8 md:py-14">
        <header className="mb-8 rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_65px_-35px_rgba(15,23,42,0.6)] backdrop-blur md:p-8">
          {tenantVisual?.bannerPhotoUrl ? (
            <div
              className="mb-4 h-28 md:h-36 rounded-2xl bg-cover bg-center pointer-events-none"
              style={{
                backgroundImage: `url(${tenantVisual.bannerPhotoUrl})`,
              }}
            />
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs tracking-wide gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Reservas online
            </Badge>
            <Badge className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">
              {tenantVisual?.name || 'GALTO'}
            </Badge>
          </div>

          <h1 className="mt-4 font-[var(--font-space-grotesk)] text-3xl leading-tight md:text-5xl text-slate-900 flex items-center gap-3">
            {tenantVisual?.logoPhotoUrl ? (
              <img src={tenantVisual.logoPhotoUrl} alt={`Logo ${tenantVisual.name || tenantName}`} className="h-10 w-10 rounded-md object-cover border" />
            ) : null}
            Elegí dónde querés atenderte
          </h1>
          <p className="mt-3 max-w-2xl text-sm md:text-base text-slate-600">
            {tenant ? `Negocio: ${tenantName || tenant}` : 'Seleccioná un tenant para continuar.'} Elegí sucursal, servicio y horario en menos de un minuto.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Sucursales publicadas</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{branches.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Confirmación inmediata</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Turno al instante
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Disponibilidad</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-900">
                <Clock3 className="h-4 w-4 text-sky-600" />
                Horarios en tiempo real
              </p>
            </div>
          </div>

          <div className="mt-5">
            <label className="text-xs text-slate-500">Buscá por nombre o slug de sucursal</label>
            <input
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none ring-slate-200 transition focus:border-slate-500 focus:ring-2"
              placeholder="Ej: Centro, Palermo, caballito..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </header>

        {loading ? (
          <Card>
            <CardContent className="py-8 text-sm text-slate-600">Cargando sucursales...</CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-sm text-red-600">{error}</CardContent>
          </Card>
        ) : !hasBranches ? (
          <Card>
            <CardContent className="py-8 text-sm text-slate-600">
              {branches.length === 0
                ? 'Este negocio todavía no tiene sucursales publicadas.'
                : 'No encontramos sucursales con esa búsqueda.'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredBranches.map((branch) => (
              <Card
                key={branch.id}
                className="group overflow-hidden border-slate-200/90 bg-white/90 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.65)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_56px_-26px_rgba(15,23,42,0.55)]"
              >
                <div
                  className="relative h-32 bg-cover bg-center pointer-events-none"
                  style={{
                    backgroundImage: branch.bannerPhotoUrl
                      ? `url(${branch.bannerPhotoUrl})`
                      : 'linear-gradient(130deg, #0f172a 0%, #1e3a8a 48%, #0ea5e9 100%)',
                  }}
                >
                  <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-700">
                    /{branch.slug}
                  </div>
                </div>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                    <Building2 className="h-4 w-4 text-slate-600" />
                    {branch.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Sucursal disponible para reservar online
                  </CardDescription>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge variant="outline" className="text-[11px]">
                      <Users2 className="mr-1 h-3 w-3" />
                      {branch.allowChooseEmployee ? 'Podés elegir profesional' : 'Asignación automática'}
                    </Badge>
                    {branch.assignmentStrategy ? (
                      <Badge variant="secondary" className="text-[11px]">
                        {translateStrategy(branch.assignmentStrategy)}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link href={`/${branch.slug}?tenant=${encodeURIComponent(tenant)}`}>
                    <Button className="w-full justify-between group-hover:bg-slate-800">
                      <span>Reservar en esta sucursal</span>
                      <span className="flex items-center gap-1">
                        <ChevronRight className="h-4 w-4" />
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </span>
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default function ReservasLandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-slate-600">Cargando reservas...</div>}>
      <ReservasLandingContent />
    </Suspense>
  );
}

function translateStrategy(strategy: string) {
  switch (strategy) {
    case 'ROTATIVE':
      return 'Rotativo';
    case 'BEST_RATED':
      return 'Mejor calificación';
    case 'LOAD_BALANCE':
      return 'Balanceo de carga';
    case 'FIRST_AVAILABLE':
      return 'Primer disponible';
    default:
      return strategy;
  }
}
