'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, CalendarDays, Check, Clock3, Filter, Pencil, Trash2, UserRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getStoredAuthSession } from '@/lib/auth';
import { useBranchContext } from '@/hooks/use-branch-context';

type Tenant = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
};

type BranchSummary = {
  id: string;
  name: string;
  slug: string;
  timeZone: string;
};

type CalendarAppointment = {
  appointmentId: string;
  status: string;
  createdBy: string;
  startsAt: string;
  endsAt: string;
  totalChargedCents: number;
  customer: {
    fullName: string | null;
    phone: string | null;
  };
  employee: {
    id: string;
    fullName: string;
  };
  lines: Array<{
    id: string;
    serviceId: string | null;
    serviceName: string | null;
    durationMins: number;
    priceCents: number;
  }>;
};

type BranchEmployee = {
  id: string;
  fullName: string;
  serviceIds: string[];
};

type BranchService = {
  id: string;
  name: string;
  durationMins: number;
  priceCents: number;
};

type AppointmentCell = {
  appointmentId: string;
  startSlot: number;
  startsAt: string;
  endsAt: string;
  customerName: string;
  servicesLabel: string;
  status: string;
  createdBy: string;
  totalChargedCents: number;
};

const SLOT_MINUTES = 30;
const DEFAULT_START_MIN = 8 * 60;
const DEFAULT_END_MIN = 22 * 60;

  const EMPLOYEE_COLORS = [
  'bg-sky-50 border-sky-300 text-sky-900',
  'bg-emerald-50 border-emerald-300 text-emerald-900',
  'bg-amber-50 border-amber-300 text-amber-900',
  'bg-fuchsia-50 border-fuchsia-300 text-fuchsia-900',
  'bg-indigo-50 border-indigo-300 text-indigo-900',
  'bg-rose-50 border-rose-300 text-rose-900',
  'bg-cyan-50 border-cyan-300 text-cyan-900',
  'bg-lime-50 border-lime-300 text-lime-900',
  ] as const;

  function formatTimeAmPm(minutes: number) {
    const hours24 = Math.floor(minutes / 60);
    const minutesPart = String(minutes % 60).padStart(2, '0');
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${String(hours12).padStart(2, '0')}:${minutesPart} ${period}`;
  }

  function weekdayLabel(dateIso: string, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
    const label = formatter.format(new Date(`${dateIso}T00:00:00`));
    return label;
  }

  function employeeInitials(name: string) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  function pickClass(tokenList: string | undefined, prefix: string, fallback: string) {
    if (!tokenList) return fallback;
    const match = tokenList.split(' ').find((token) => token.startsWith(prefix));
    return match ?? fallback;
  }

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(
    Number(cents || 0) / 100,
  );
}

function formatTime(minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDateTimeInZone(dateIso: string, timeZone: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateIso));
}

function parseLocalDayAndMinutes(dateIso: string, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(dateIso));
  const data = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));

  const dayKey = `${String(data.year)}-${String(data.month)}-${String(data.day)}`;
  const hour = Number(data.hour ?? '0');
  const minute = Number(data.minute ?? '0');
  return { dayKey, minutes: hour * 60 + minute };
}

function statusLabel(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'Completado';
    case 'CANCELLED':
      return 'Cancelado';
    case 'CONFIRMED':
      return 'Confirmado';
    case 'PENDING':
      return 'Pendiente';
    default:
      return status;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function statusTone(status: string) {
  if (status === 'PENDING') {
    return {
      card: 'border-amber-300 bg-amber-50',
      chip: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }
  if (status === 'CONFIRMED' || status === 'COMPLETED') {
    return {
      card: 'border-emerald-300 bg-emerald-50',
      chip: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  }
  return {
    card: 'border-slate-300 bg-slate-50',
    chip: 'bg-slate-100 text-slate-700 border-slate-300',
  };
}

function formatServicesLabel(lines: CalendarAppointment['lines']) {
  if (!lines.length) return 'Servicio';
  return lines
    .map((line, index) => `Servicio ${index + 1}: ${line.serviceName || 'Servicio'}`)
    .join(' · ');
}

function localDateTimeToUtc(dateKey: string, minutes: number, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  let guess = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0);

  for (let index = 0; index < 4; index += 1) {
    const parts = parseLocalDayAndMinutes(new Date(guess).toISOString(), timeZone);
    const currentDateIndex =
      Date.UTC(
        Number(parts.dayKey.slice(0, 4)),
        Number(parts.dayKey.slice(5, 7)) - 1,
        Number(parts.dayKey.slice(8, 10)),
        0,
        0,
        0,
        0,
      ) / 60000 + parts.minutes;
    const targetDateIndex = Date.UTC(year, month - 1, day, 0, 0, 0, 0) / 60000 + minutes;
    const deltaMinutes = targetDateIndex - currentDateIndex;
    if (deltaMinutes === 0) break;
    guess += deltaMinutes * 60_000;
  }

  return new Date(guess);
}

export default function CalendarioPage() {
  const [session] = useState(() => getStoredAuthSession());
  const [tenantId, setTenantId] = useState('');
  const { loading: loadingBranchContext, tenant, branches, activeBranchId } = useBranchContext();
  const [branchId, setBranchId] = useState('');
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [branchEmployees, setBranchEmployees] = useState<BranchEmployee[]>([]);
  const [branchServices, setBranchServices] = useState<BranchService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [deletingAppointmentId, setDeletingAppointmentId] = useState<string | null>(null);
  const [confirmingAppointmentId, setConfirmingAppointmentId] = useState<string | null>(null);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()));
  const [employeeFilter, setEmployeeFilter] = useState<string>('ALL');
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingServices, setEditingServices] = useState(false);
  const [editingServiceIds, setEditingServiceIds] = useState<string[]>([]);
  const [savingServices, setSavingServices] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createTarget, setCreateTarget] = useState<{ employeeId: string; slotMinute: number } | null>(null);
  const [createServiceId, setCreateServiceId] = useState('');
  const [createCustomerName, setCreateCustomerName] = useState('');
  const [createCustomerPhone, setCreateCustomerPhone] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [zoomPercent, setZoomPercent] = useState(100);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === branchId) ?? branches[0] ?? null,
    [branches, branchId],
  );
  const timeZone = selectedBranch?.timeZone || 'America/Argentina/Buenos_Aires';

  useEffect(() => {
    setLoading(loadingBranchContext);
    if (!loadingBranchContext) {
      setTenantId(tenant?.tenantId ?? '');
      if (activeBranchId) {
        setBranchId(activeBranchId);
      } else if (branches[0]?.id) {
        setBranchId(branches[0].id);
      }
    }
  }, [loadingBranchContext, tenant?.tenantId, activeBranchId, branches]);

  async function loadAppointments(currentBranchId: string) {
    if (!session?.user?.id || !tenantId || !currentBranchId) return;
    setLoadingAppointments(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        userId: session.user.id,
        tenantId,
        from: selectedDate,
        to: selectedDate,
      });

      const response = await fetch(`/api/calendario/branches/${encodeURIComponent(currentBranchId)}/appointments?${params}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo cargar el calendario');

      setAppointments((payload?.appointments ?? []) as CalendarAppointment[]);
      setBranchEmployees((payload?.employees ?? []) as BranchEmployee[]);
      setBranchServices((payload?.services ?? []) as BranchService[]);
    } catch (err: any) {
      setError(err?.message ?? 'Error cargando turnos');
      setAppointments([]);
      setBranchEmployees([]);
      setBranchServices([]);
    } finally {
      setLoadingAppointments(false);
    }
  }

  async function deleteAppointment(appointmentId: string) {
    if (!session?.user?.id || !tenantId || !branchId) return;
    const confirmed = window.confirm('Vas a borrar este bloque. Si tiene cobro asociado, también se elimina.');
    if (!confirmed) return;

    setDeletingAppointmentId(appointmentId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/calendario/branches/${encodeURIComponent(branchId)}/appointments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          appointmentId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo borrar el turno');
      setMessage('Turno borrado.');
      await loadAppointments(branchId);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo borrar el turno');
    } finally {
      setDeletingAppointmentId(null);
    }
  }

  async function confirmAppointment(appointmentId: string) {
    if (!session?.user?.id || !tenantId || !branchId) return;
    setConfirmingAppointmentId(appointmentId);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/calendario/branches/${encodeURIComponent(branchId)}/appointments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          appointmentId,
          action: 'confirm',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo confirmar el turno');
      setMessage('Turno confirmado.');
      await loadAppointments(branchId);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo confirmar el turno');
    } finally {
      setConfirmingAppointmentId(null);
    }
  }

  useEffect(() => {
    if (!branchId) return;
    void loadAppointments(branchId);
  }, [branchId, tenantId, selectedDate]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((appointment) => {
      const local = parseLocalDayAndMinutes(appointment.startsAt, timeZone);
      if (local.dayKey !== selectedDate) return false;
      if (employeeFilter !== 'ALL' && appointment.employee.id !== employeeFilter) return false;
      return true;
    });
  }, [appointments, timeZone, selectedDate, employeeFilter]);

  const employees = useMemo(
    () => branchEmployees.slice().sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [branchEmployees],
  );

  useEffect(() => {
    if (employeeFilter === 'ALL') return;
    if (employees.some((employee) => employee.id === employeeFilter)) return;
    setEmployeeFilter('ALL');
  }, [employeeFilter, employees]);

  const employeeColorById = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((employee, index) => {
      map.set(employee.id, EMPLOYEE_COLORS[index % EMPLOYEE_COLORS.length]);
    });
    return map;
  }, [employees]);

  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const createEmployee = useMemo(
    () => (createTarget ? employeeMap.get(createTarget.employeeId) ?? null : null),
    [createTarget, employeeMap],
  );
  const createEmployeeServices = useMemo(() => {
    if (!createEmployee) return [];
    const allowedIds = new Set(createEmployee.serviceIds ?? []);
    return branchServices.filter((service) => allowedIds.has(service.id));
  }, [createEmployee, branchServices]);

  const createSlotIsPastOrNow = useMemo(() => {
    if (!createTarget) return false;
    const startsAt = localDateTimeToUtc(selectedDate, createTarget.slotMinute, timeZone);
    return startsAt.getTime() <= Date.now();
  }, [createTarget, selectedDate, timeZone]);

  const selectedEmployeeServices = useMemo(() => {
    if (!selectedAppointment) return [];
    const employee = employeeMap.get(selectedAppointment.employee.id);
    if (!employee) return [];
    const allowedIds = new Set(employee.serviceIds ?? []);
    return branchServices.filter((service) => allowedIds.has(service.id));
  }, [selectedAppointment, employeeMap, branchServices]);
  const calendarZoom = zoomPercent / 100;

  useEffect(() => {
    if (!createOpen) return;
    if (!createEmployeeServices.length) {
      setCreateServiceId('');
      return;
    }
    if (createEmployeeServices.some((service) => service.id === createServiceId)) return;
    setCreateServiceId(createEmployeeServices[0]?.id ?? '');
  }, [createOpen, createEmployeeServices, createServiceId]);

  function openCreateModal(employeeId: string, slotMinute: number) {
    setCreateTarget({ employeeId, slotMinute });
    setCreateCustomerName('');
    setCreateCustomerPhone('');
    setCreateNotes('');
    setCreateServiceId('');
    setCreateOpen(true);
  }

  function openDetailsModal(appointmentId: string) {
    const appointment = appointments.find((row) => row.appointmentId === appointmentId) ?? null;
    if (!appointment) return;
    setSelectedAppointment(appointment);
    setEditingServices(false);
    setEditingServiceIds(appointment.lines.map((line) => line.serviceId).filter((id): id is string => Boolean(id)));
    setDetailsOpen(true);
  }

  function openServicesEditor(appointment: CalendarAppointment) {
    setSelectedAppointment(appointment);
    const existing = appointment.lines.map((line) => line.serviceId).filter((id): id is string => Boolean(id));
    setEditingServiceIds(existing);
    setEditingServices(true);
    setDetailsOpen(true);
  }

  function toggleEditingService(serviceId: string, checked: boolean) {
    setEditingServiceIds((current) => {
      if (checked) {
        return current.includes(serviceId) ? current : [...current, serviceId];
      }
      return current.filter((id) => id !== serviceId);
    });
  }

  async function saveEditedServices() {
    if (!session?.user?.id || !tenantId || !branchId || !selectedAppointment) return;
    if (!editingServiceIds.length) {
      setError('Seleccioná al menos un servicio.');
      return;
    }

    setSavingServices(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/calendario/branches/${encodeURIComponent(branchId)}/appointments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          appointmentId: selectedAppointment.appointmentId,
          action: 'update_services',
          serviceIds: editingServiceIds,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudieron actualizar los servicios');
      setMessage('Servicios actualizados.');
      setEditingServices(false);
      setDetailsOpen(false);
      await loadAppointments(branchId);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudieron actualizar los servicios');
    } finally {
      setSavingServices(false);
    }
  }

  async function createAppointmentFromSlot() {
    if (!session?.user?.id || !tenantId || !branchId || !createTarget) return;
    if (createCustomerName.trim().length < 2) {
      setError('Ingresá el nombre del cliente');
      return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(createCustomerPhone.trim())) {
      setError('Ingresá teléfono en formato E.164 (ej: +5491123456789)');
      return;
    }
    if (!createServiceId) {
      setError('Seleccioná un servicio');
      return;
    }

    setCreatingAppointment(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/calendario/branches/${encodeURIComponent(branchId)}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          employeeId: createTarget.employeeId,
          serviceId: createServiceId,
          date: selectedDate,
          startMinutes: createTarget.slotMinute,
          customerFullName: createCustomerName.trim(),
          customerPhone: createCustomerPhone.trim(),
          notes: createNotes.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? 'No se pudo crear el turno');
      setCreateOpen(false);
      setCreateTarget(null);
      setMessage(
        payload?.status === 'PENDING'
          ? 'Turno creado como pendiente. Vas a tener que confirmar la compra.'
          : 'Turno cargado como cobrado y confirmado.',
      );
      void markOnboardingStep('addAndDeleteCustomer');
      await loadAppointments(branchId);
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo crear el turno');
    } finally {
      setCreatingAppointment(false);
    }
  }

  async function markOnboardingStep(stepId: 'addAndDeleteCustomer') {
    if (!session?.user?.id || !tenantId) return;
    try {
      await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          tenantId,
          stepId,
          completed: true,
        }),
      });
      window.dispatchEvent(
        new CustomEvent('galto-onboarding-updated', {
          detail: { tenantId },
        }),
      );
    } catch {
      // keep calendar flow even if onboarding sync fails
    }
  }

  const boardRange = useMemo(() => {
    if (!filteredAppointments.length) {
      return { startMin: DEFAULT_START_MIN, endMin: DEFAULT_END_MIN };
    }

    let min = 24 * 60;
    let max = 0;
    for (const appointment of filteredAppointments) {
      const localStart = parseLocalDayAndMinutes(appointment.startsAt, timeZone).minutes;
      const localEnd = parseLocalDayAndMinutes(appointment.endsAt, timeZone).minutes;
      min = Math.min(min, localStart);
      max = Math.max(max, localEnd);
    }

    const startRounded = Math.max(0, Math.floor((min - 60) / SLOT_MINUTES) * SLOT_MINUTES);
    const endRounded = Math.min(24 * 60, Math.ceil((max + 60) / SLOT_MINUTES) * SLOT_MINUTES);

    return {
      startMin: Math.min(startRounded, DEFAULT_START_MIN),
      endMin: Math.max(endRounded, DEFAULT_END_MIN),
    };
  }, [filteredAppointments, timeZone]);

  const slots = useMemo(() => {
    const rows: number[] = [];
    for (let minute = boardRange.startMin; minute < boardRange.endMin; minute += SLOT_MINUTES) {
      rows.push(minute);
    }
    return rows;
  }, [boardRange]);

  const boardByEmployee = useMemo(() => {
    const byEmployee = new Map<string, Map<number, AppointmentCell>>();

    for (const employee of employees) {
      byEmployee.set(employee.id, new Map<number, AppointmentCell>());
    }

    for (const appointment of filteredAppointments) {
      const startLocal = parseLocalDayAndMinutes(appointment.startsAt, timeZone).minutes;
      const endLocal = parseLocalDayAndMinutes(appointment.endsAt, timeZone).minutes;
      const startSlot = Math.floor((startLocal - boardRange.startMin) / SLOT_MINUTES);
      if (startSlot < 0) continue;
      const employeeMap = byEmployee.get(appointment.employee.id);
      if (!employeeMap) continue;

      employeeMap.set(startSlot, {
        appointmentId: appointment.appointmentId,
        startSlot,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        customerName: appointment.customer.fullName || 'Cliente',
        servicesLabel: formatServicesLabel(appointment.lines),
        status: appointment.status,
        createdBy: appointment.createdBy,
        totalChargedCents: appointment.totalChargedCents,
      });
    }

    return byEmployee;
  }, [employees, filteredAppointments, timeZone, boardRange.startMin]);

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-sm text-muted-foreground">Cargando calendario...</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold mb-2">Calendario tablero</h1>
        <p className="text-muted-foreground">Filas por horario y columnas por trabajador. Vista optimizada para agenda diaria.</p>
      </div>
      <div className="flex justify-start">
        <Button variant="outline" asChild>
          <Link href="/app/calendario/analisis">
            <BarChart3 className="h-4 w-4 mr-1" />
            Análisis
          </Link>
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <Card className="border-slate-200 bg-gradient-to-br from-white to-slate-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de agenda
          </CardTitle>
          <CardDescription>Un empleado solo ve sucursales donde tiene permisos de turnos.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Negocio</Label>
            <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {tenant?.tenantName ?? '-'}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Sucursal activa</Label>
            <div className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {selectedBranch ? `${selectedBranch.name} (${selectedBranch.slug})` : '-'}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Día</Label>
            <input
              type="date"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Trabajador</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value)}
            >
              <option value="ALL">Todos</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Tablero diario
          </CardTitle>
          <CardDescription>
            Zona horaria: <span className="font-medium">{timeZone}</span>
          </CardDescription>
          <p className="text-xs text-muted-foreground">
            Si cargás un turno en pasado o en este mismo momento, se guarda como cobrado/completado. Si lo cargás en
            futuro, se guarda pendiente para confirmar compra después.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {employees.map((employee) => (
              <Badge key={employee.id} variant="outline" className={`gap-2 ${employeeColorById.get(employee.id) ?? ''}`}>
                <UserRound className="h-3.5 w-3.5" />
                {employee.fullName}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loadingAppointments ? <p className="text-sm text-muted-foreground">Cargando turnos...</p> : null}

          {!loadingAppointments && employees.length === 0 ? (
            <div className="rounded-md border border-dashed p-10 text-sm text-muted-foreground">
              No hay trabajadoras activas en esta sucursal.
            </div>
          ) : null}

          {!loadingAppointments && employees.length > 0 ? (
            <>
              <div className="overflow-auto max-h-[74vh] rounded-xl border bg-white relative">
                <div className="sticky top-2 left-2 z-50 w-fit rounded-lg border bg-white/95 shadow-sm backdrop-blur p-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setZoomPercent((current) => clamp(current - 10, 25, 200))}
                    >
                      -
                    </Button>
                    <input
                      type="range"
                      min={25}
                      max={200}
                      step={5}
                      value={zoomPercent}
                      onChange={(event) => setZoomPercent(clamp(Number(event.target.value), 25, 200))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setZoomPercent((current) => clamp(current + 10, 25, 200))}
                    >
                      +
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setZoomPercent(100)}>
                      100%
                    </Button>
                    <Badge variant="outline" className="text-[10px]">
                      Zoom {zoomPercent}%
                    </Badge>
                  </div>
                </div>

                <div className="pt-2" style={{ zoom: calendarZoom } as any}>
                  <table className="w-full min-w-[980px] border-separate border-spacing-3 text-xs">
                  <thead>
                    <tr>
                      <th className="sticky top-0 left-0 z-40 px-2 py-2 text-left font-semibold bg-white w-[96px]">
                        Hora
                      </th>
                      {employees.map((employee) => {
                        const color = employeeColorById.get(employee.id) ?? 'bg-slate-50 border-slate-200 text-slate-900';
                        const border = pickClass(color, 'border-', 'border-slate-200');
                        const accent = border.replace('border-', 'bg-');
                        const text = pickClass(color, 'text-', 'text-slate-900');
                        return (
                          <th key={`head-${employee.id}`} className="sticky top-0 z-30 px-0 py-0 text-left font-semibold bg-white">
                            <div className={`rounded-xl border ${border} bg-slate-50/70 overflow-hidden`}>
                              <div className="flex items-center gap-3 px-3 py-3">
                                <div className={`h-10 w-10 rounded-full ${accent} flex items-center justify-center text-white text-xs font-semibold`}>
                                  {employeeInitials(employee.fullName)}
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-sm font-semibold truncate ${text}`}>{employee.fullName}</p>
                                  <p className="text-[11px] text-muted-foreground">Premium Barber</p>
                                </div>
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map((slotMinute, rowIndex) => (
                      <tr key={`row-${slotMinute}`}>
                        <td className="sticky left-0 z-10 px-2 py-2 bg-white text-slate-700">
                          <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] leading-tight">
                            <div className="flex items-center gap-1 font-semibold">
                              <Clock3 className="h-3 w-3" />
                              {formatTimeAmPm(slotMinute)}
                            </div>
                          </div>
                        </td>
                        {employees.map((employee) => {
                          const startCell = boardByEmployee.get(employee.id)?.get(rowIndex);
                          if (!startCell) {
                            return (
                              <td key={`${employee.id}-${rowIndex}`} className="px-0 py-0">
                                <button
                                  type="button"
                                  className="w-full rounded-xl border border-slate-200 bg-slate-100/70 h-14 flex items-center justify-center text-slate-400 text-xl hover:bg-slate-100 transition-colors"
                                  onClick={() => openCreateModal(employee.id, slotMinute)}
                                  data-guide-calendar-add-slot="1"
                                >
                                  +
                                </button>
                              </td>
                            );
                          }

                          const employeeColor = employeeColorById.get(employee.id) ?? 'bg-slate-50 border-slate-200 text-slate-900';
                          const border = pickClass(employeeColor, 'border-', 'border-slate-200');
                          const accent = border.replace('border-', 'bg-');
                          const startMinutes = parseLocalDayAndMinutes(startCell.startsAt, timeZone).minutes;
                          const tone = statusTone(startCell.status);
                          return (
                            <td key={`${employee.id}-${rowIndex}`} className="align-top px-0 py-0">
                              <div
                                className={`rounded-xl border ${border} shadow-sm min-h-[56px] overflow-hidden cursor-pointer ${tone.card}`}
                                onClick={() => openDetailsModal(startCell.appointmentId)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    openDetailsModal(startCell.appointmentId);
                                  }
                                }}
                              >
                                <div className="p-2 space-y-0.5">
                                  <p className="text-[11px] text-muted-foreground">
                                    {weekdayLabel(selectedDate, timeZone)} {formatTimeAmPm(startMinutes)}
                                  </p>
                                  <div className="flex items-center justify-between gap-1">
                                    <p className="text-xs font-semibold truncate">{startCell.customerName}</p>
                                    <div className="flex items-center gap-1">
                                      {startCell.status === 'PENDING' ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5"
                                          disabled={confirmingAppointmentId === startCell.appointmentId}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void confirmAppointment(startCell.appointmentId);
                                          }}
                                          title="Confirmar turno"
                                        >
                                          <Check className="h-3 w-3" />
                                        </Button>
                                      ) : null}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          const appointment = appointments.find((row) => row.appointmentId === startCell.appointmentId);
                                          if (appointment) openServicesEditor(appointment);
                                        }}
                                        title="Editar servicios"
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5"
                                        disabled={deletingAppointmentId === startCell.appointmentId}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void deleteAppointment(startCell.appointmentId);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="text-[10px] truncate opacity-90">{startCell.servicesLabel}</p>
                                  <Badge variant="outline" className={`mt-1 text-[10px] py-0 px-1.5 ${tone.chip}`}>
                                    {statusLabel(startCell.status)}
                                  </Badge>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateTarget(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>Agregar turno en este bloque</DialogTitle>
            <DialogDescription>
              {createEmployee ? (
                <>
                  {createEmployee.fullName} · {selectedDate} ·{' '}
                  {createTarget ? formatTimeAmPm(createTarget.slotMinute) : ''}
                </>
              ) : (
                'Seleccioná los datos y confirmá.'
              )}
            </DialogDescription>
          </DialogHeader>

          <p className="text-xs text-muted-foreground">
            {createSlotIsPastOrNow
              ? 'Este horario es pasado o actual: se va a cargar como cobrado/completado.'
              : 'Este horario es futuro: se va a crear pendiente y luego deberías confirmar la compra.'}
          </p>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Servicio</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={createServiceId}
                onChange={(event) => setCreateServiceId(event.target.value)}
              >
                <option value="">Seleccioná servicio</option>
                {createEmployeeServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {formatMoney(service.priceCents)} · {service.durationMins} min
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Nombre del cliente</Label>
              <Input
                data-guide-calendar-client-name="1"
                value={createCustomerName}
                onChange={(event) => setCreateCustomerName(event.target.value)}
                placeholder="Nombre y apellido"
              />
            </div>

            <div className="space-y-2">
              <Label>Teléfono (E.164)</Label>
              <Input
                value={createCustomerPhone}
                onChange={(event) => setCreateCustomerPhone(event.target.value)}
                placeholder="+5491123456789"
              />
            </div>

            <div className="space-y-2">
              <Label>Nota (opcional)</Label>
              <Textarea value={createNotes} onChange={(event) => setCreateNotes(event.target.value)} rows={3} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void createAppointmentFromSlot()} disabled={creatingAppointment} data-guide-calendar-save="1">
              {creatingAppointment ? 'Guardando...' : createSlotIsPastOrNow ? 'Guardar como cobrado' : 'Guardar como pendiente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setSelectedAppointment(null);
            setEditingServices(false);
            setEditingServiceIds([]);
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle>Detalle del turno</DialogTitle>
            <DialogDescription>
              {selectedAppointment ? formatDateTimeInZone(selectedAppointment.startsAt, timeZone) : 'Turno seleccionado'}
            </DialogDescription>
          </DialogHeader>

          {selectedAppointment ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3 space-y-1">
                <p>
                  <strong>Cliente:</strong> {selectedAppointment.customer.fullName ?? 'Sin nombre'}
                </p>
                <p>
                  <strong>Teléfono:</strong> {selectedAppointment.customer.phone ?? 'Sin teléfono'}
                </p>
                <p>
                  <strong>Trabajador:</strong> {selectedAppointment.employee.fullName}
                </p>
                <p>
                  <strong>Estado:</strong> {statusLabel(selectedAppointment.status)}
                </p>
                <p>
                  <strong>Origen:</strong> {selectedAppointment.createdBy === 'STAFF' ? 'Atención directa' : 'Reserva'}
                </p>
                <p>
                  <strong>Total:</strong> {formatMoney(selectedAppointment.totalChargedCents)}
                </p>
              </div>

              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">Servicios</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const current = selectedAppointment.lines
                        .map((line) => line.serviceId)
                        .filter((id): id is string => Boolean(id));
                      setEditingServiceIds(current);
                      setEditingServices((value) => !value);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {editingServices ? 'Cerrar edición' : 'Editar servicios'}
                  </Button>
                </div>
                {selectedAppointment.lines.length === 0 ? (
                  <p className="text-muted-foreground">Sin líneas cargadas.</p>
                ) : (
                  selectedAppointment.lines.map((line) => (
                    <div key={line.id} className="flex items-center justify-between gap-2">
                      <div>
                        <p>{line.serviceName ?? 'Servicio'}</p>
                        <p className="text-xs text-muted-foreground">{line.durationMins} min</p>
                      </div>
                      <p className="font-medium">{formatMoney(line.priceCents)}</p>
                    </div>
                  ))
                )}
                {editingServices ? (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Elegí servicios del trabajador y guardá cambios.</p>
                    {selectedEmployeeServices.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No hay servicios disponibles para este trabajador.</p>
                    ) : (
                      <div className="grid gap-2">
                        {selectedEmployeeServices.map((service) => {
                          const checked = editingServiceIds.includes(service.id);
                          return (
                            <label key={`edit-service-${service.id}`} className="flex items-center justify-between gap-2 rounded border p-2 text-xs">
                              <span>
                                {service.name} · {service.durationMins} min
                              </span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => toggleEditingService(service.id, event.target.checked)}
                              />
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <Button type="button" size="sm" onClick={() => void saveEditedServices()} disabled={savingServices}>
                      {savingServices ? 'Guardando...' : 'Guardar servicios'}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDetailsOpen(false)}>
              Cerrar
            </Button>
            {selectedAppointment?.status === 'PENDING' ? (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await confirmAppointment(selectedAppointment.appointmentId);
                  setDetailsOpen(false);
                }}
                disabled={confirmingAppointmentId === selectedAppointment.appointmentId}
              >
                <Check className="h-4 w-4 mr-2" />
                {confirmingAppointmentId === selectedAppointment.appointmentId ? 'Confirmando...' : 'Confirmar compra'}
              </Button>
            ) : null}
            {selectedAppointment ? (
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  await deleteAppointment(selectedAppointment.appointmentId);
                  setDetailsOpen(false);
                }}
                disabled={deletingAppointmentId === selectedAppointment.appointmentId}
              >
                {deletingAppointmentId === selectedAppointment.appointmentId ? 'Borrando...' : 'Borrar turno'}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
