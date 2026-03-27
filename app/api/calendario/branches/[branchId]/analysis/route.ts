import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { db } from '@/lib/server/db';
import { assertTenantAccess, hasBranchPermission } from '@/lib/server/reservas-data';

interface Params {
  params: Promise<{ branchId: string }>;
}

type MinuteInterval = { start: number; end: number };

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_INTERVALS = new Set([15, 30, 60]);
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday -> Sunday

function parseDateOnly(raw: string | null) {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

function dateToUtcMs(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function nextDateKey(dateKey: string) {
  return new Date(dateToUtcMs(dateKey) + DAY_MS).toISOString().slice(0, 10);
}

function listDays(from: string, to: string) {
  const days: string[] = [];
  for (let d = from; d <= to; d = nextDateKey(d)) days.push(d);
  return days;
}

function weekday(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

function localParts(iso: string, timeZone: string) {
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
  const map = Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  return {
    dayKey: `${map.year}-${map.month}-${map.day}`,
    minutes: Number(map.hour ?? '0') * 60 + Number(map.minute ?? '0'),
  };
}

function mergeIntervals(rows: MinuteInterval[]) {
  const sorted = rows
    .map((row) => ({ start: Math.max(0, Math.min(1440, row.start)), end: Math.max(0, Math.min(1440, row.end)) }))
    .filter((row) => row.end > row.start)
    .sort((a, b) => a.start - b.start);

  if (!sorted.length) return [];
  const merged: MinuteInterval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else merged.push({ ...cur });
  }
  return merged;
}

function intersectIntervals(a: MinuteInterval[], b: MinuteInterval[]) {
  const left = mergeIntervals(a);
  const right = mergeIntervals(b);
  const out: MinuteInterval[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const start = Math.max(left[i].start, right[j].start);
    const end = Math.min(left[i].end, right[j].end);
    if (end > start) out.push({ start, end });
    if (left[i].end < right[j].end) i += 1;
    else j += 1;
  }
  return out;
}

function subtractIntervals(base: MinuteInterval[], blocked: MinuteInterval[]) {
  const src = mergeIntervals(base);
  const masks = mergeIntervals(blocked);
  if (!masks.length) return src;
  const out: MinuteInterval[] = [];

  for (const interval of src) {
    let cursor = interval.start;
    for (const mask of masks) {
      if (mask.end <= cursor) continue;
      if (mask.start >= interval.end) break;
      if (mask.start > cursor) out.push({ start: cursor, end: Math.min(mask.start, interval.end) });
      cursor = Math.max(cursor, mask.end);
      if (cursor >= interval.end) break;
    }
    if (cursor < interval.end) out.push({ start: cursor, end: interval.end });
  }

  return out;
}

function overlaps(intervals: MinuteInterval[], slot: MinuteInterval) {
  return intervals.some((row) => row.start < slot.end && row.end > slot.start);
}

function addIntervalByLocalDays(
  target: Map<string, MinuteInterval[]>,
  startsAtIso: string,
  endsAtIso: string,
  timeZone: string,
  from: string,
  to: string,
) {
  const start = localParts(startsAtIso, timeZone);
  const end = localParts(endsAtIso, timeZone);
  if (end.dayKey < from || start.dayKey > to) return;

  if (start.dayKey === end.dayKey) {
    if (start.dayKey >= from && start.dayKey <= to && end.minutes > start.minutes) {
      target.set(start.dayKey, [...(target.get(start.dayKey) ?? []), { start: start.minutes, end: end.minutes }]);
    }
    return;
  }

  for (let day = start.dayKey; day <= end.dayKey; day = nextDateKey(day)) {
    if (day < from || day > to) continue;
    if (day === start.dayKey) target.set(day, [...(target.get(day) ?? []), { start: start.minutes, end: 1440 }]);
    else if (day === end.dayKey) {
      if (end.minutes > 0) target.set(day, [...(target.get(day) ?? []), { start: 0, end: end.minutes }]);
    } else target.set(day, [...(target.get(day) ?? []), { start: 0, end: 1440 }]);
  }
}

function weekdayLabel(value: number) {
  switch (value) {
    case 1:
      return 'Lunes';
    case 2:
      return 'Martes';
    case 3:
      return 'Miércoles';
    case 4:
      return 'Jueves';
    case 5:
      return 'Viernes';
    case 6:
      return 'Sábado';
    default:
      return 'Domingo';
  }
}

export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';
  const from = parseDateOnly(request.nextUrl.searchParams.get('from'));
  const to = parseDateOnly(request.nextUrl.searchParams.get('to'));
  const employeeId = (request.nextUrl.searchParams.get('employeeId') ?? '').trim() || null;
  const intervalMins = Number(request.nextUrl.searchParams.get('intervalMins') ?? '30');

  if (!userId || !tenantId) return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  if (!from || !to) return NextResponse.json({ message: 'from y to deben tener formato YYYY-MM-DD' }, { status: 400 });
  if (to < from) return NextResponse.json({ message: 'Rango inválido' }, { status: 400 });
  if (!VALID_INTERVALS.has(intervalMins)) return NextResponse.json({ message: 'intervalMins debe ser 15, 30 o 60' }, { status: 400 });
  if (dateToUtcMs(to) - dateToUtcMs(from) > 366 * DAY_MS) {
    return NextResponse.json({ message: 'Rango máximo: 366 días' }, { status: 400 });
  }

  const membership = await assertTenantAccess(userId, tenantId);
  if (!membership) return NextResponse.json({ message: 'Sin acceso al tenant' }, { status: 403 });
  if (membership.role !== 'OWNER' && membership.role !== 'MANAGER') {
    return NextResponse.json({ message: 'Solo owner y manager' }, { status: 403 });
  }
  if (membership.role === 'MANAGER') {
    const [canRead, canWrite] = await Promise.all([
      hasBranchPermission({ userId, tenantId, branchId, permission: 'APPOINTMENTS_READ' }),
      hasBranchPermission({ userId, tenantId, branchId, permission: 'APPOINTMENTS_WRITE' }),
    ]);
    if (!canRead && !canWrite) return NextResponse.json({ message: 'Sin permisos en esta sucursal' }, { status: 403 });
  }

  const branchRes = await db.query<{ id: string; name: string; slug: string | null; timeZone: string }>(
    `SELECT id, name, slug, "timeZone" FROM "Branch" WHERE id = $1 AND "tenantId" = $2 LIMIT 1`,
    [branchId, tenantId],
  );
  const branch = branchRes.rows[0];
  if (!branch) return NextResponse.json({ message: 'Sucursal no encontrada' }, { status: 404 });

  const employeesRes = await db.query<{ id: string; fullName: string }>(
    `
      SELECT id, "fullName"
      FROM "Employee"
      WHERE "tenantId" = $1 AND "branchId" = $2 AND "isActive" = TRUE
        AND ($3::text IS NULL OR id = $3)
      ORDER BY "fullName" ASC
    `,
    [tenantId, branchId, employeeId],
  );
  const employees = employeesRes.rows;
  if (employeeId && !employees.length) return NextResponse.json({ message: 'Trabajador no encontrado' }, { status: 404 });

  const employeeIds = employees.map((row) => row.id);
  const rangeStartIso = new Date(dateToUtcMs(from)).toISOString();
  const rangeEndIso = new Date(dateToUtcMs(to) + DAY_MS).toISOString();

  const [branchScheduleRes, branchExceptionRes, employeeScheduleRes, employeeTimeOffRes, appointmentRes] = await Promise.all([
    db.query<{ dayOfWeek: number; startTimeMin: number; endTimeMin: number }>(
      `SELECT "dayOfWeek", "startTimeMin", "endTimeMin" FROM "BranchSchedule" WHERE "branchId" = $1`,
      [branchId],
    ),
    db.query<{ date: Date; isClosed: boolean; startTimeMin: number | null; endTimeMin: number | null }>(
      `
        SELECT date, "isClosed", "startTimeMin", "endTimeMin"
        FROM "BranchException"
        WHERE "branchId" = $1 AND date::date BETWEEN $2::date AND $3::date
      `,
      [branchId, from, to],
    ),
    employeeIds.length
      ? db.query<{ employeeId: string; dayOfWeek: number; startTimeMin: number; endTimeMin: number }>(
          `SELECT "employeeId", "dayOfWeek", "startTimeMin", "endTimeMin" FROM "EmployeeSchedule" WHERE "employeeId" = ANY($1::text[])`,
          [employeeIds],
        )
      : Promise.resolve({ rows: [] as Array<{ employeeId: string; dayOfWeek: number; startTimeMin: number; endTimeMin: number }> }),
    employeeIds.length
      ? db.query<{ employeeId: string; startsAt: Date; endsAt: Date }>(
          `
            SELECT "employeeId", "startsAt", "endsAt"
            FROM "EmployeeTimeOff"
            WHERE "employeeId" = ANY($1::text[]) AND "startsAt" < $2 AND "endsAt" > $3
          `,
          [employeeIds, rangeEndIso, rangeStartIso],
        )
      : Promise.resolve({ rows: [] as Array<{ employeeId: string; startsAt: Date; endsAt: Date }> }),
    employeeIds.length
      ? db.query<{ employeeId: string; startsAt: Date; endsAt: Date }>(
          `
            SELECT "employeeId", "startsAt", "endsAt"
            FROM "Appointment"
            WHERE "tenantId" = $1 AND "branchId" = $2 AND "employeeId" = ANY($3::text[])
              AND status IN ('CONFIRMED','COMPLETED')
              AND "startsAt" < $4 AND "endsAt" > $5
          `,
          [tenantId, branchId, employeeIds, rangeEndIso, rangeStartIso],
        )
      : Promise.resolve({ rows: [] as Array<{ employeeId: string; startsAt: Date; endsAt: Date }> }),
  ]);

  const branchScheduleByWeekday = new Map<number, MinuteInterval[]>();
  for (const row of branchScheduleRes.rows) {
    branchScheduleByWeekday.set(row.dayOfWeek, [...(branchScheduleByWeekday.get(row.dayOfWeek) ?? []), { start: row.startTimeMin, end: row.endTimeMin }]);
  }
  for (const [k, v] of branchScheduleByWeekday) branchScheduleByWeekday.set(k, mergeIntervals(v));

  const branchExceptionByDate = new Map<string, { isClosed: boolean; intervals: MinuteInterval[] }>();
  for (const row of branchExceptionRes.rows) {
    const day = row.date.toISOString().slice(0, 10);
    const prev = branchExceptionByDate.get(day) ?? { isClosed: false, intervals: [] };
    const intervals =
      row.startTimeMin !== null && row.endTimeMin !== null
        ? [...prev.intervals, { start: Number(row.startTimeMin), end: Number(row.endTimeMin) }]
        : prev.intervals;
    branchExceptionByDate.set(day, { isClosed: prev.isClosed || Boolean(row.isClosed), intervals });
  }
  for (const [k, v] of branchExceptionByDate) branchExceptionByDate.set(k, { ...v, intervals: mergeIntervals(v.intervals) });

  const employeeScheduleByWeekday = new Map<string, Map<number, MinuteInterval[]>>();
  for (const row of employeeScheduleRes.rows) {
    const byDay = employeeScheduleByWeekday.get(row.employeeId) ?? new Map<number, MinuteInterval[]>();
    byDay.set(row.dayOfWeek, [...(byDay.get(row.dayOfWeek) ?? []), { start: row.startTimeMin, end: row.endTimeMin }]);
    employeeScheduleByWeekday.set(row.employeeId, byDay);
  }
  for (const [, byDay] of employeeScheduleByWeekday) {
    for (const [k, v] of byDay) byDay.set(k, mergeIntervals(v));
  }

  const timeOffByEmpDay = new Map<string, Map<string, MinuteInterval[]>>();
  for (const row of employeeTimeOffRes.rows) {
    const byDay = timeOffByEmpDay.get(row.employeeId) ?? new Map<string, MinuteInterval[]>();
    addIntervalByLocalDays(byDay, row.startsAt.toISOString(), row.endsAt.toISOString(), branch.timeZone, from, to);
    timeOffByEmpDay.set(row.employeeId, byDay);
  }
  for (const [, byDay] of timeOffByEmpDay) for (const [k, v] of byDay) byDay.set(k, mergeIntervals(v));

  const apptByEmpDay = new Map<string, Map<string, MinuteInterval[]>>();
  for (const row of appointmentRes.rows) {
    const byDay = apptByEmpDay.get(row.employeeId) ?? new Map<string, MinuteInterval[]>();
    addIntervalByLocalDays(byDay, row.startsAt.toISOString(), row.endsAt.toISOString(), branch.timeZone, from, to);
    apptByEmpDay.set(row.employeeId, byDay);
  }
  for (const [, byDay] of apptByEmpDay) for (const [k, v] of byDay) byDay.set(k, mergeIntervals(v));

  const allIntervals = [
    ...branchScheduleRes.rows.map((r) => ({ start: r.startTimeMin, end: r.endTimeMin })),
    ...employeeScheduleRes.rows.map((r) => ({ start: r.startTimeMin, end: r.endTimeMin })),
  ];
  let minMinute = 8 * 60;
  let maxMinute = 22 * 60;
  if (allIntervals.length) {
    minMinute = Math.min(...allIntervals.map((r) => r.start));
    maxMinute = Math.max(...allIntervals.map((r) => r.end));
  }
  minMinute = Math.floor(minMinute / intervalMins) * intervalMins;
  maxMinute = Math.ceil(maxMinute / intervalMins) * intervalMins;
  if (maxMinute <= minMinute) maxMinute = minMinute + intervalMins;

  const slots: number[] = [];
  for (let m = minMinute; m < maxMinute; m += intervalMins) slots.push(m);

  const days = listDays(from, to);
  const daysPerWeekday = new Map<number, number>();
  for (const w of WEEKDAYS) daysPerWeekday.set(w, 0);
  for (const day of days) daysPerWeekday.set(weekday(day), (daysPerWeekday.get(weekday(day)) ?? 0) + 1);

  const counters = new Map<string, { available: number; occupied: number }>();
  const key = (w: number, s: number) => `${w}:${s}`;

  for (const day of days) {
    const w = weekday(day);
    const exception = branchExceptionByDate.get(day);
    const branchOpen = exception?.isClosed
      ? []
      : exception && exception.intervals.length
        ? exception.intervals
        : (branchScheduleByWeekday.get(w) ?? []);

    for (const employee of employees) {
      const employeeOpen = employeeScheduleByWeekday.get(employee.id)?.get(w) ?? [];
      const availableBase = intersectIntervals(employeeOpen, branchOpen);
      if (!availableBase.length) continue;

      const timeOff = timeOffByEmpDay.get(employee.id)?.get(day) ?? [];
      const available = subtractIntervals(availableBase, timeOff);
      if (!available.length) continue;
      const occupied = apptByEmpDay.get(employee.id)?.get(day) ?? [];

      for (const slotStart of slots) {
        const slot = { start: slotStart, end: slotStart + intervalMins };
        if (!overlaps(available, slot)) continue;
        const current = counters.get(key(w, slotStart)) ?? { available: 0, occupied: 0 };
        current.available += 1;
        if (overlaps(occupied, slot)) current.occupied += 1;
        counters.set(key(w, slotStart), current);
      }
    }
  }

  const cells = WEEKDAYS.flatMap((w) =>
    slots.map((slotStart) => {
      const values = counters.get(key(w, slotStart)) ?? { available: 0, occupied: 0 };
      return {
        weekday: w,
        weekdayLabel: weekdayLabel(w),
        slotStartMin: slotStart,
        slotEndMin: slotStart + intervalMins,
        available: values.available,
        occupied: values.occupied,
        occupancyPct: values.available ? Math.round((values.occupied / values.available) * 100) : 0,
        analyzedDays: daysPerWeekday.get(w) ?? 0,
      };
    }),
  );

  return NextResponse.json({
    meta: {
      branch: { id: branch.id, name: branch.name, slug: branch.slug },
      timeZone: branch.timeZone,
      from,
      to,
      intervalMins,
      employeeId,
      generatedAt: new Date().toISOString(),
      historicalMode: 'best_effort',
    },
    employees,
    weekdays: WEEKDAYS.map((w) => ({ weekday: w, label: weekdayLabel(w), daysInRange: daysPerWeekday.get(w) ?? 0 })),
    slots,
    cells,
  });
}

