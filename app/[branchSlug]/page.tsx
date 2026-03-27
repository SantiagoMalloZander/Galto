'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarClock, CheckCircle2, Clock3, Info, Phone, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

type Service = {
  id: string;
  name: string;
  durationMins: number;
  priceCents: number;
  category?: { id: string; name: string; sortOrder?: number } | null;
};

type Employee = {
  id: string;
  fullName: string;
  role?: string;
  ratingAvg?: number;
  ratingCount?: number;
  services?: Array<{ id: string; name: string }>;
  profile?: {
    instagram?: string | null;
    bio?: string | null;
  };
};

type Slot = {
  startsAt: string;
  employeeIds: string[];
  employees: Array<{ id: string; fullName: string }>;
};

type CatalogPayload = {
  tenant: { id: string; slug: string; name: string; logoPhotoUrl?: string | null; bannerPhotoUrl?: string | null };
  branch: {
    id: string;
    name: string;
    slug: string;
    timeZone: string;
    allowChooseEmployee: boolean;
    assignmentStrategy: string;
  };
  maxAdvanceDays: number;
  requiresCustomerAuth: boolean;
  profile: {
    address: string | null;
    phone: string | null;
    showServicePrices: boolean;
    policyText: string | null;
    cancellationEnabled: boolean;
    depositType: 'NONE' | 'PERCENTAGE' | 'FIXED';
    depositAmount: number;
    publicNote: string | null;
    profilePhotoUrl: string | null;
    bannerPhotoUrl: string | null;
    carouselPhotoUrls: string[];
  };
  services: Service[];
  employees: Employee[];
};

type AuthenticatedCustomer = {
  id: string;
  phone: string;
  fullName: string | null;
};

const STEPS = [
  'Servicios y profesionales',
  'Día y hora',
  'Datos del cliente',
  'Seña',
  'Confirmación',
] as const;

function BranchPublicBookingContent() {
  const params = useParams<{ branchSlug: string }>();
  const searchParams = useSearchParams();

  const tenantSlug = searchParams.get('tenant')?.trim() ?? '';
  const branchSlug = String(params?.branchSlug ?? '');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [serviceWorkerByServiceId, setServiceWorkerByServiceId] = useState<Record<string, string>>({});
  const [employeeInfoOpenId, setEmployeeInfoOpenId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerOtpCode, setCustomerOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [requestOtpLoading, setRequestOtpLoading] = useState(false);
  const [verifyOtpLoading, setVerifyOtpLoading] = useState(false);
  const [authenticatedCustomer, setAuthenticatedCustomer] = useState<AuthenticatedCustomer | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [createdAppointment, setCreatedAppointment] = useState<any>(null);
  const derivedEmployeeId = useMemo(() => {
    const picked = selectedServiceIds
      .map((serviceId) => serviceWorkerByServiceId[serviceId] ?? '')
      .filter((value) => value.length > 0);
    const unique = Array.from(new Set(picked));
    return unique.length === 1 ? unique[0] : '';
  }, [selectedServiceIds, serviceWorkerByServiceId]);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      if (!tenantSlug || !branchSlug) {
        setError('Faltan datos de la URL para continuar.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/public-booking/tenant/${encodeURIComponent(tenantSlug)}/branch/${encodeURIComponent(branchSlug)}/catalog`,
          { cache: 'no-store' },
        );

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message ?? 'No se pudo cargar la sucursal');
        }

        if (!active) return;
        setCatalog(payload as CatalogPayload);

        const today = formatDateForInput(new Date());
        setSelectedDate(today);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? 'No se pudo cargar la sucursal');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCatalog();
    return () => {
      active = false;
    };
  }, [tenantSlug, branchSlug]);

  useEffect(() => {
    let active = true;

    async function loadAvailability() {
      if (!catalog || selectedServiceIds.length === 0 || !selectedDate) {
        setSlots([]);
        setSelectedSlot(null);
        return;
      }

      const params = new URLSearchParams();
      params.set('date', selectedDate);
      params.set('serviceIds', selectedServiceIds.join(','));
      if (derivedEmployeeId) {
        params.set('employeeId', derivedEmployeeId);
      }

      try {
        const response = await fetch(
          `/api/public-booking/tenant/${encodeURIComponent(tenantSlug)}/branch/${encodeURIComponent(branchSlug)}/availability?${params.toString()}`,
          { cache: 'no-store' },
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.message ?? 'No se pudo consultar disponibilidad');
        }

        if (!active) return;

        const slotList = Array.isArray(payload?.slots) ? (payload.slots as Slot[]) : [];
        const allowedEmployeeIds = new Set((catalog?.employees ?? []).map((employee) => employee.id));
        const filteredSlots = slotList
          .map((slot) => ({
            ...slot,
            employeeIds: (slot.employeeIds ?? []).filter((id) => allowedEmployeeIds.has(id)),
            employees: (slot.employees ?? []).filter((employee) => allowedEmployeeIds.has(employee.id)),
          }))
          .filter((slot) => slot.employeeIds.length > 0);

        const only30 = filteredSlots.filter((slot) => {
          const minute = new Date(slot.startsAt).getUTCMinutes();
          return minute % 30 === 0;
        });

        setSlots(only30);
        setSelectedSlot(null);
      } catch (err: any) {
        if (!active) return;
        setSlots([]);
        setSelectedSlot(null);
        setError(err?.message ?? 'No se pudo consultar disponibilidad');
      }
    }

    void loadAvailability();

    return () => {
      active = false;
    };
  }, [catalog, selectedServiceIds, selectedDate, derivedEmployeeId, tenantSlug, branchSlug]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadCustomerSession() {
      try {
        const response = await fetch('/api/auth/customer/me', { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        if (payload?.authenticated && payload?.customerUser) {
          setAuthenticatedCustomer(payload.customerUser);
          setCustomerPhone(String(payload.customerUser.phone ?? ''));
          setCustomerName(String(payload.customerUser.fullName ?? ''));
        }
      } catch {
        // ignore
      }
    }
    void loadCustomerSession();
    return () => {
      active = false;
    };
  }, []);

  const selectedServices = useMemo(() => {
    if (!catalog) return [] as Service[];
    return catalog.services.filter((service) => selectedServiceIds.includes(service.id));
  }, [catalog, selectedServiceIds]);

  const serviceSections = useMemo(() => {
    if (!catalog) return [] as Array<{
      key: string;
      label: string;
      sortOrder: number;
      isUncategorized: boolean;
      services: Service[];
    }>;

    const sections = new Map<
      string,
      {
        key: string;
        label: string;
        sortOrder: number;
        isUncategorized: boolean;
        services: Service[];
      }
    >();

    for (const service of catalog.services) {
      const categoryId = service.category?.id ?? '__uncategorized__';
      const categoryLabel = (service.category?.name ?? '').trim() || 'Sin categoría';
      const sortOrder = Number.isFinite(Number(service.category?.sortOrder))
        ? Number(service.category?.sortOrder)
        : Number.MAX_SAFE_INTEGER;
      const isUncategorized = !service.category?.id;

      if (!sections.has(categoryId)) {
        sections.set(categoryId, {
          key: categoryId,
          label: categoryLabel,
          sortOrder,
          isUncategorized,
          services: [],
        });
      }

      sections.get(categoryId)!.services.push(service);
    }

    return Array.from(sections.values())
      .map((section) => ({
        ...section,
        services: section.services
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name, 'es-AR', { sensitivity: 'base' })),
      }))
      .sort((a, b) => {
        if (a.isUncategorized !== b.isUncategorized) {
          return a.isUncategorized ? 1 : -1;
        }
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }
        return a.label.localeCompare(b.label, 'es-AR', { sensitivity: 'base' });
      });
  }, [catalog]);

  const totalPriceCents = useMemo(
    () => selectedServices.reduce((total, service) => total + Number(service.priceCents || 0), 0),
    [selectedServices],
  );

  const totalDurationMins = useMemo(
    () => selectedServices.reduce((total, service) => total + Number(service.durationMins || 0), 0),
    [selectedServices],
  );
  const showServicePrices = catalog?.profile?.showServicePrices !== false;

  const selectedEmployee = useMemo(
    () => catalog?.employees.find((employee) => employee.id === derivedEmployeeId) ?? null,
    [catalog, derivedEmployeeId],
  );

  const minDate = useMemo(() => formatDateForInput(new Date()), []);
  const maxDate = useMemo(() => {
    const max = new Date();
    const plusDays = Number(catalog?.maxAdvanceDays ?? 30);
    max.setDate(max.getDate() + plusDays);
    return formatDateForInput(max);
  }, [catalog?.maxAdvanceDays]);

  const slotsByMinute = useMemo(() => {
    const map = new Map<number, Slot>();
    for (const slot of slots) {
      const local = getLocalDayAndMinute(slot.startsAt, catalog?.branch.timeZone ?? 'America/Argentina/Buenos_Aires');
      if (local.dayKey !== selectedDate) continue;
      map.set(local.minute, slot);
    }
    return map;
  }, [slots, selectedDate, catalog?.branch.timeZone]);

  const renderedSlots = useMemo(() => {
    const rows: Array<{ minute: number; slot: Slot | null; isPast: boolean }> = [];
    for (let minute = 8 * 60; minute < 22 * 60; minute += 30) {
      const slot = slotsByMinute.get(minute) ?? null;
      const isPast = isMinuteInPast(selectedDate, minute, catalog?.branch.timeZone ?? 'America/Argentina/Buenos_Aires', clockTick);
      rows.push({ minute, slot, isPast });
    }
    return rows;
  }, [slotsByMinute, selectedDate, catalog?.branch.timeZone, clockTick]);

  const hasSelectableSlot = useMemo(
    () => renderedSlots.some((row) => row.slot && !row.isPast),
    [renderedSlots],
  );

  const canContinue = useMemo(() => {
    const requiresCustomerAuth = Boolean(catalog?.requiresCustomerAuth);
    switch (stepIndex) {
      case 0:
        return selectedServiceIds.length > 0;
      case 1:
        return Boolean(selectedSlot);
      case 2:
        if (!isE164(customerPhone) || customerName.trim().length < 2) return false;
        if (!requiresCustomerAuth) return true;
        return Boolean(authenticatedCustomer);
      case 3:
        return true;
      case 4:
        return false;
      default:
        return false;
    }
  }, [stepIndex, catalog?.requiresCustomerAuth, selectedServiceIds.length, selectedSlot, authenticatedCustomer, customerPhone, customerName]);

  async function submitAppointment() {
    if (!catalog || !selectedSlot || selectedServiceIds.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/public-booking/tenant/${encodeURIComponent(tenantSlug)}/branch/${encodeURIComponent(branchSlug)}/appointments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceIds: selectedServiceIds,
            startsAt: selectedSlot.startsAt,
            employeeId: derivedEmployeeId || selectedSlot.employees?.[0]?.id || undefined,
            customer: {
              fullName: customerName.trim(),
              phone: authenticatedCustomer?.phone ?? customerPhone.trim(),
            },
          }),
        },
      );

      const payload = await response.json();
      if (!response.ok) {
        const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
        throw new Error(message ?? 'No se pudo crear la reserva');
      }

      setCreatedAppointment(payload?.appointment ?? payload);
      setStepIndex(4);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo crear la reserva');
    } finally {
      setSaving(false);
    }
  }

  function toggleService(serviceId: string, checked: boolean) {
    setSelectedSlot(null);
    setSelectedServiceIds((current) => {
      if (checked) {
        return current.includes(serviceId) ? current : [...current, serviceId];
      }
      setServiceWorkerByServiceId((prev) => {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      });
      return current.filter((id) => id !== serviceId);
    });
  }

  function nextStep() {
    if (stepIndex >= 4) return;
    if (!canContinue) return;
    setStepIndex((value) => Math.min(value + 1, 4));
  }

  function prevStep() {
    if (stepIndex <= 0) return;
    setStepIndex((value) => Math.max(value - 1, 0));
  }

  async function requestCustomerOtp() {
    setError(null);
    if (!isE164(customerPhone)) {
      setError('Ingresá teléfono en formato E.164');
      return;
    }
    if (customerName.trim().length < 2) {
      setError('Ingresá nombre y apellido para continuar');
      return;
    }
    setRequestOtpLoading(true);
    try {
      const response = await fetch('/api/auth/customer/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: customerPhone.trim(),
          fullName: customerName.trim() || null,
          tenantSlug,
          branchSlug,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo enviar el código');
      }
      setOtpRequested(true);
    } catch (err: any) {
      setError(err?.message ?? 'Error enviando código');
    } finally {
      setRequestOtpLoading(false);
    }
  }

  async function verifyCustomerOtp() {
    setError(null);
    if (!isE164(customerPhone)) {
      setError('Ingresá teléfono en formato E.164');
      return;
    }
    if (customerOtpCode.length !== 4) {
      setError('El código debe tener 4 dígitos');
      return;
    }

    setVerifyOtpLoading(true);
    try {
      const response = await fetch('/api/auth/customer/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: customerPhone.trim(),
          code: customerOtpCode.trim(),
          fullName: customerName.trim() || null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message ?? 'No se pudo verificar el código');
      }
      const customerUser = payload?.customerUser as AuthenticatedCustomer | undefined;
      if (customerUser) {
        setAuthenticatedCustomer(customerUser);
        setCustomerPhone(customerUser.phone);
        setCustomerName(customerUser.fullName ?? customerName.trim());
      }
    } catch (err: any) {
      setError(err?.message ?? 'Error validando código');
    } finally {
      setVerifyOtpLoading(false);
    }
  }

  async function logoutCustomer() {
    await fetch('/api/auth/customer/logout', { method: 'POST' }).catch(() => null);
    setAuthenticatedCustomer(null);
    setCustomerOtpCode('');
    setOtpRequested(false);
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-slate-600">Cargando reservas...</div>;
  }

  if (error && !catalog) {
    return <div className="min-h-screen grid place-items-center text-sm text-red-600">{error}</div>;
  }

  if (!catalog) {
    return <div className="min-h-screen grid place-items-center text-sm text-slate-600">No hay datos de la sucursal.</div>;
  }

  const heroImage =
    catalog.profile.bannerPhotoUrl ||
    catalog.tenant.bannerPhotoUrl ||
    catalog.profile.carouselPhotoUrls[0] ||
    catalog.profile.profilePhotoUrl;

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-6xl px-4 py-6 md:py-10 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-5">
          <Card className="overflow-hidden border-slate-200">
            <div
              className="h-36 md:h-44 bg-cover bg-center pointer-events-none"
              style={{
                backgroundImage: heroImage
                  ? `url(${heroImage})`
                  : 'linear-gradient(135deg, #0f172a, #1d4ed8)',
              }}
            />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl font-[var(--font-space-grotesk)] text-slate-900">{catalog.branch.name}</CardTitle>
                  <CardDescription>{catalog.tenant.name}</CardDescription>
                </div>
                <Link href={`/reservas?tenant=${encodeURIComponent(tenantSlug)}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ArrowLeft className="h-4 w-4" />
                    Sucursales
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 grid gap-2">
              {catalog.profile.address && <p>{catalog.profile.address}</p>}
              {catalog.profile.phone && (
                <p className="inline-flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {catalog.profile.phone}
                </p>
              )}
              {catalog.profile.publicNote && <p>{catalog.profile.publicNote}</p>}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Paso {stepIndex + 1}: {STEPS[stepIndex]}</CardTitle>
              <CardDescription>
                Zona horaria de la sucursal: {catalog.branch.timeZone}. Horarios disponibles cada 30 minutos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {stepIndex === 0 && (
                <div className="space-y-4">
                  {serviceSections.map((section) => (
                    <div key={section.key} className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{section.label}</h3>
                        <Badge variant="secondary" className="text-[11px]">
                          {section.services.length} {section.services.length === 1 ? 'servicio' : 'servicios'}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        {section.services.map((service) => {
                          const checked = selectedServiceIds.includes(service.id);
                          const preferredWorkerId = serviceWorkerByServiceId[service.id] ?? '';
                          const availableEmployees = catalog.employees.filter((employee) =>
                            (employee.services ?? []).some((employeeService) => employeeService.id === service.id),
                          );
                          return (
                            <div
                              key={service.id}
                              className={`rounded-xl border p-3 transition ${
                                checked ? 'border-blue-600 bg-blue-50/70' : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <label className="flex items-start gap-3 cursor-pointer">
                                <Checkbox checked={checked} onCheckedChange={(value) => toggleService(service.id, Boolean(value))} />
                                <span className="flex-1">
                                  <span className="font-medium text-slate-900 block">{service.name}</span>
                                  <span className="text-xs text-slate-600">
                                    {service.durationMins} min
                                    {showServicePrices ? ` · ${formatMoney(service.priceCents)}` : ''}
                                  </span>
                                </span>
                              </label>

                              {checked ? (
                                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                  <p className="text-xs font-medium text-slate-700">Profesional para este servicio</p>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="flex items-center gap-2 rounded-md border border-slate-200 p-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        className="h-4 w-4"
                                        checked={!preferredWorkerId}
                                        onChange={() =>
                                          setServiceWorkerByServiceId((prev) => ({
                                            ...prev,
                                            [service.id]: '',
                                          }))
                                        }
                                      />
                                      <span className="text-sm">Cualquiera</span>
                                    </label>

                                    {availableEmployees.map((employee) => (
                                      <div key={`${service.id}-${employee.id}`} className="rounded-md border border-slate-200 p-2">
                                        <label className="flex items-center justify-between gap-2 cursor-pointer">
                                          <span className="flex items-center gap-2">
                                            <input
                                              type="radio"
                                              className="h-4 w-4"
                                              checked={preferredWorkerId === employee.id}
                                              onChange={() =>
                                                setServiceWorkerByServiceId((prev) => ({
                                                  ...prev,
                                                  [service.id]: employee.id,
                                                }))
                                              }
                                            />
                                            <span className="text-sm">{employee.fullName}</span>
                                          </span>
                                          <button
                                            type="button"
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                                            onClick={() =>
                                              setEmployeeInfoOpenId((current) => (current === employee.id ? null : employee.id))
                                            }
                                            aria-label={`Ver perfil de ${employee.fullName}`}
                                          >
                                            <Info className="h-4 w-4" />
                                          </button>
                                        </label>

                                        {employeeInfoOpenId === employee.id ? (
                                          <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 space-y-1">
                                            <p>
                                              <strong>Rol:</strong> {translateRole(employee.role)}
                                            </p>
                                            <p>
                                              <strong>Bio:</strong> {employee.profile?.bio?.trim() || 'Sin descripción todavía.'}
                                            </p>
                                            <p>
                                              <strong>Instagram:</strong> {employee.profile?.instagram?.trim() || 'No informado'}
                                            </p>
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                  {availableEmployees.length === 0 ? (
                                    <p className="text-xs text-amber-700">No hay profesionales asignados a este servicio todavía.</p>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {stepIndex === 1 && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="booking-date">Seleccioná un día</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDate(minDate)}
                      >
                        Hoy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDate((current) => shiftDate(current, -1, minDate, maxDate))}
                      >
                        -1 día
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDate((current) => shiftDate(current, 1, minDate, maxDate))}
                      >
                        +1 día
                      </Button>
                    </div>
                    <Input
                      id="booking-date"
                      type="date"
                      value={selectedDate}
                      min={minDate}
                      max={maxDate}
                      onChange={(event) => {
                        setSelectedDate(event.target.value);
                        setSelectedSlot(null);
                      }}
                    />
                    <p className="text-xs text-slate-500">Podés reservar hasta {catalog.maxAdvanceDays} días hacia adelante.</p>
                  </div>

                  <Separator />

                  {!hasSelectableSlot ? (
                    <div className="rounded-xl border border-red-300 bg-red-50 p-3">
                      <p className="text-sm font-medium text-red-700">No hay reservas disponibles este día.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {renderedSlots.map((row) => {
                        const active = Boolean(row.slot && selectedSlot?.startsAt === row.slot.startsAt);
                        const disabled = !row.slot || row.isPast;
                        const slotLabel = row.slot
                          ? formatSlotLabel(row.slot.startsAt, catalog.branch.timeZone)
                          : formatMinuteLabel(row.minute);

                        return (
                          <button
                            key={`slot-${row.minute}`}
                            type="button"
                            className={`rounded-lg border px-3 py-2 text-sm transition ${
                              disabled
                                ? 'border-slate-300 bg-slate-200 text-slate-500 cursor-not-allowed'
                                : active
                                ? 'border-blue-700 bg-blue-200 text-blue-900'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                            disabled={disabled}
                            onClick={() => {
                              if (!row.slot || row.isPast) return;
                              setSelectedSlot(row.slot);
                            }}
                          >
                            {slotLabel}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {stepIndex === 2 && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="fullName">Nombre completo</Label>
                    <Input
                      id="fullName"
                      placeholder="Ej: María Pérez"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      disabled={Boolean(authenticatedCustomer)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Teléfono (E.164)</Label>
                    <Input
                      id="phone"
                      placeholder="Ej: +5491123456789"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      disabled={Boolean(authenticatedCustomer)}
                    />
                    {!isE164(customerPhone) && customerPhone.trim() ? (
                      <p className="text-xs text-red-600">Usá formato E.164, por ejemplo: +5491123456789</p>
                    ) : null}
                  </div>
                  {!authenticatedCustomer && catalog.requiresCustomerAuth ? (
                    <>
                      {otpRequested ? (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                          Te enviamos un código por WhatsApp al {customerPhone}.
                        </div>
                      ) : null}
                      <div className="grid gap-2">
                        <Label htmlFor="otp">Código de 4 dígitos</Label>
                        <Input
                          id="otp"
                          inputMode="numeric"
                          maxLength={4}
                          placeholder="0000"
                          value={customerOtpCode}
                          onChange={(event) => setCustomerOtpCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={requestOtpLoading || verifyOtpLoading || !isE164(customerPhone) || customerName.trim().length < 2}
                          onClick={() => void requestCustomerOtp()}
                        >
                          {requestOtpLoading ? 'Enviando...' : 'Enviar código por WhatsApp'}
                        </Button>
                        <Button
                          type="button"
                          disabled={requestOtpLoading || verifyOtpLoading || !otpRequested || customerOtpCode.length !== 4}
                          onClick={() => void verifyCustomerOtp()}
                        >
                          {verifyOtpLoading ? 'Verificando...' : 'Verificar código'}
                        </Button>
                        <p className="text-xs text-slate-500">
                          Si no tenías cuenta, se crea automáticamente con nombre y teléfono.
                        </p>
                      </div>
                    </>
                  ) : authenticatedCustomer ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                      Sesión iniciada como <strong>{authenticatedCustomer.fullName ?? 'Cliente'}</strong> ({authenticatedCustomer.phone}).
                      <div className="mt-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => void logoutCustomer()}>
                          Cerrar sesión de cliente
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      Esta sucursal no tiene WhatsApp configurado. Podés reservar sin verificación de código.
                    </div>
                  )}
                </div>
              )}

              {stepIndex === 3 && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-sm text-slate-700">
                    {catalog.profile.depositType === 'NONE'
                      ? 'Esta sucursal no solicita seña previa para reservar.'
                      : catalog.profile.depositType === 'PERCENTAGE'
                      ? `Esta sucursal informa una seña del ${catalog.profile.depositAmount}% del valor del turno.`
                      : `Esta sucursal informa una seña fija de ${formatMoney(catalog.profile.depositAmount)}.`}
                  </p>
                  {catalog.profile.policyText ? (
                    <p className="text-xs text-slate-600">Políticas: {catalog.profile.policyText}</p>
                  ) : null}
                  {catalog.profile.cancellationEnabled ? (
                    <p className="text-xs text-slate-600">Acepta cancelaciones según las políticas informadas.</p>
                  ) : (
                    <p className="text-xs text-slate-600">No admite cancelaciones automáticas por web.</p>
                  )}
                </div>
              )}

              {stepIndex === 4 && (
                <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 md:p-6">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">Reserva creada</span>
                  </div>
                  <p className="text-sm text-emerald-800">Guardá esta pantalla para tu referencia.</p>
                  <div className="grid gap-2 text-sm text-slate-700">
                    <p>
                      <strong>Código:</strong> {createdAppointment?.id ?? 'N/D'}
                    </p>
                    <p>
                      <strong>Sucursal:</strong> {catalog.branch.name}
                    </p>
                    <p>
                      <strong>Cliente:</strong> {customerName}
                    </p>
                    <p>
                      <strong>Teléfono:</strong> {authenticatedCustomer?.phone ?? customerPhone}
                    </p>
                    <p>
                      <strong>Fecha y hora:</strong>{' '}
                      {selectedSlot ? formatFullDateTime(selectedSlot.startsAt, catalog.branch.timeZone) : 'N/D'}
                    </p>
                    <p>
                      <strong>Profesional:</strong>{' '}
                      {selectedEmployee?.fullName
                        ?? createdAppointment?.employee?.fullName
                        ?? (selectedServiceIds.some((serviceId) => Boolean(serviceWorkerByServiceId[serviceId]))
                          ? 'Combinado por servicio'
                          : 'Cualquiera')}
                    </p>
                    <p>
                      <strong>Estado:</strong> {String(createdAppointment?.status ?? 'PENDING')}
                    </p>
                    <p>
                      <strong>Total:</strong> {showServicePrices ? formatMoney(totalPriceCents) : 'Se informa en el local'}
                    </p>
                  </div>
                </div>
              )}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              {stepIndex < 4 ? (
                <div className="flex items-center justify-between gap-2 pt-2">
                  <Button variant="outline" onClick={prevStep} disabled={stepIndex === 0 || saving}>
                    Volver
                  </Button>

                  {stepIndex === 3 ? (
                    <Button onClick={submitAppointment} disabled={saving || !canContinue}>
                      {saving ? 'Confirmando...' : 'Confirmar reserva'}
                    </Button>
                  ) : (
                    <Button onClick={nextStep} disabled={!canContinue || saving}>
                      Continuar
                    </Button>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6">
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumen de la reserva</CardTitle>
              <CardDescription>Proceso en {STEPS[stepIndex]}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2 text-slate-700">
                <CalendarClock className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="font-medium">Fecha y hora</p>
                  <p>{selectedSlot ? formatFullDateTime(selectedSlot.startsAt, catalog.branch.timeZone) : 'Pendiente'}</p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-slate-700">
                <UserRound className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="font-medium">Profesional</p>
                  <p>
                    {selectedEmployee?.fullName
                      ? selectedEmployee.fullName
                      : selectedServiceIds.some((serviceId) => Boolean(serviceWorkerByServiceId[serviceId]))
                        ? 'Combinado por servicio'
                        : 'Cualquiera (asignación automática)'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 text-slate-700">
                <Clock3 className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="font-medium">Servicios</p>
                  {selectedServices.length ? (
                    <ul className="space-y-1">
                      {selectedServices.map((service) => (
                        <li key={service.id} className="text-slate-700">
                          {service.name} · {service.durationMins} min ·{' '}
                          {serviceWorkerByServiceId[service.id]
                            ? catalog.employees.find((employee) => employee.id === serviceWorkerByServiceId[service.id])?.fullName ?? 'Trabajador elegido'
                            : 'Cualquiera'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Pendiente</p>
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Duración total</span>
                <span className="font-medium text-slate-900">{totalDurationMins} min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Total estimado</span>
                <span className="font-semibold text-slate-900">
                  {showServicePrices ? formatMoney(totalPriceCents) : 'Se informa en el local'}
                </span>
              </div>

              <Separator />

              <div className="flex items-center flex-wrap gap-1.5">
                {STEPS.map((step, index) => (
                  <Badge key={step} variant={index <= stepIndex ? 'default' : 'secondary'} className="text-[11px]">
                    {index + 1}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}

export default function BranchPublicBookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-slate-600">Cargando reservas...</div>}>
      <BranchPublicBookingContent />
    </Suspense>
  );
}

function formatDateForInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format((Number(cents) || 0) / 100);
}

function isE164(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone.trim());
}

function formatSlotLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(iso));
}

function formatMinuteLabel(minute: number) {
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getLocalDayAndMinute(iso: string, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(iso));
  const data = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const dayKey = `${String(data.year)}-${String(data.month)}-${String(data.day)}`;
  const hour = Number(data.hour ?? 0);
  const minute = Number(data.minute ?? 0);
  return { dayKey, minute: hour * 60 + minute };
}

function isMinuteInPast(selectedDate: string, minute: number, timeZone: string, nowMs: number) {
  const nowLocal = getLocalDayAndMinute(new Date(nowMs).toISOString(), timeZone);
  const selectedDay = dayKeyToInt(selectedDate);
  const nowDay = dayKeyToInt(nowLocal.dayKey);
  if (selectedDay < nowDay) return true;
  if (selectedDay > nowDay) return false;
  return minute <= nowLocal.minute;
}

function isPastSlot(iso: string, selectedDate: string, timeZone: string, nowMs: number) {
  const local = getLocalDayAndMinute(iso, timeZone);
  return isMinuteInPast(selectedDate, local.minute, timeZone, nowMs);
}

function dayKeyToInt(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map((value) => Number(value));
  return year * 10000 + month * 100 + day;
}

function shiftDate(currentDate: string, days: number, minDate: string, maxDate: string) {
  const current = new Date(`${currentDate}T00:00:00`);
  if (Number.isNaN(current.getTime())) return currentDate;
  current.setDate(current.getDate() + days);
  const next = formatDateForInput(current);
  if (next < minDate) return minDate;
  if (next > maxDate) return maxDate;
  return next;
}

function formatFullDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
}

function translateRole(role?: string | null) {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'MANAGER':
      return 'Manager';
    case 'EMPLOYEE':
      return 'Trabajador';
    default:
      return 'Equipo';
  }
}
