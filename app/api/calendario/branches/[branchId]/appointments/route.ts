import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/server/db';
import { deletePosSaleById, ensurePosTables } from '@/lib/server/pos-data';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { hasBranchPermission, listBranchAppointments } from '@/lib/server/reservas-data';

interface Params {
  params: Promise<{ branchId: string }>;
}

function parseDateOnly(raw: string | null): Date | null {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const value = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(value.getTime())) return null;
  return value;
}

function parseDateKey(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function parseStartMinutes(value: unknown) {
  const minutes = Number(value);
  if (!Number.isInteger(minutes)) return null;
  if (minutes < 0 || minutes > 23 * 60 + 59) return null;
  return minutes;
}

function parseServiceIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
  if (!ids.length) return null;
  return Array.from(new Set(ids));
}

function isE164Phone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
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
  const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return {
    dayKey: `${map.year}-${map.month}-${map.day}`,
    minutes: Number(map.hour ?? '0') * 60 + Number(map.minute ?? '0'),
  };
}

function dateKeyToMinuteIndex(dateKey: string, minutes: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0) / 60000 + minutes;
}

function localDateTimeToUtc(dateKey: string, minutes: number, timeZone: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  let guess = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0);

  for (let index = 0; index < 4; index += 1) {
    const parts = localParts(new Date(guess).toISOString(), timeZone);
    const deltaMinutes = dateKeyToMinuteIndex(dateKey, minutes) - dateKeyToMinuteIndex(parts.dayKey, parts.minutes);
    if (deltaMinutes === 0) break;
    guess += deltaMinutes * 60_000;
  }

  return new Date(guess);
}

export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);
  if (!fromDate || !toDate) {
    return NextResponse.json({ message: 'from y to deben tener formato YYYY-MM-DD' }, { status: 400 });
  }

  const diff = toDate.getTime() - fromDate.getTime();
  if (diff < 0) {
    return NextResponse.json({ message: 'El rango de fechas es inválido' }, { status: 400 });
  }

  const maxRangeDays = 31;
  const dayMs = 24 * 60 * 60 * 1000;
  if (diff > maxRangeDays * dayMs) {
    return NextResponse.json({ message: 'El rango máximo es de 31 días' }, { status: 400 });
  }

  const [canReadAppointments, canWriteAppointments] = await Promise.all([
    hasBranchPermission({
      userId,
      tenantId,
      branchId,
      permission: 'APPOINTMENTS_READ',
    }),
    hasBranchPermission({
      userId,
      tenantId,
      branchId,
      permission: 'APPOINTMENTS_WRITE',
    }),
  ]);

  if (!canReadAppointments && !canWriteAppointments) {
    return NextResponse.json({ message: 'No tenés permisos para ver el calendario de esta sucursal' }, { status: 403 });
  }

  const fromIso = fromDate.toISOString();
  const toIso = new Date(toDate.getTime() + dayMs).toISOString();

  const [appointments, employeesRes, servicesRes] = await Promise.all([
    listBranchAppointments({
      tenantId,
      branchId,
      fromIso,
      toIso,
      limit: 2000,
    }),
    db.query<{ id: string; fullName: string; serviceIds: string[] }>(
      `
        SELECT
          e.id,
          e."fullName",
          COALESCE(array_agg(sa."serviceId") FILTER (WHERE sa."serviceId" IS NOT NULL), '{}'::text[]) AS "serviceIds"
        FROM "Employee" e
        LEFT JOIN "ServiceAssignment" sa ON sa."employeeId" = e.id
        WHERE e."tenantId" = $1
          AND e."branchId" = $2
          AND e."isActive" = TRUE
        GROUP BY e.id, e."fullName"
        ORDER BY e."fullName" ASC, e.id ASC
      `,
      [tenantId, branchId],
    ),
    db.query<{ id: string; name: string; durationMins: number; priceCents: number }>(
      `
        SELECT id, name, "durationMins", "priceCents"
        FROM "Service"
        WHERE "tenantId" = $1
          AND "branchId" = $2
          AND "isActive" = TRUE
        ORDER BY name ASC, id ASC
      `,
      [tenantId, branchId],
    ),
  ]);

  return NextResponse.json({
    appointments,
    employees: employeesRes.rows,
    services: servicesRes.rows,
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const employeeId = String(body?.employeeId ?? '');
  const serviceId = String(body?.serviceId ?? '');
  const date = parseDateKey(body?.date);
  const startMinutes = parseStartMinutes(body?.startMinutes);
  const customerFullName = String(body?.customerFullName ?? '').trim();
  const customerPhone = String(body?.customerPhone ?? '').trim();
  const notesRaw = typeof body?.notes === 'string' ? body.notes.trim() : '';
  const notes = notesRaw.length ? notesRaw : null;

  if (!userId || !tenantId || !employeeId || !serviceId || !date || startMinutes === null) {
    return NextResponse.json(
      { message: 'userId, tenantId, employeeId, serviceId, date y startMinutes son obligatorios' },
      { status: 400 },
    );
  }

  if (customerFullName.length < 2) {
    return NextResponse.json({ message: 'Ingresá nombre del cliente' }, { status: 400 });
  }

  if (!isE164Phone(customerPhone)) {
    return NextResponse.json({ message: 'El teléfono debe estar en formato E.164' }, { status: 400 });
  }

  const canWriteAppointments = await hasBranchPermission({
    userId,
    tenantId,
    branchId,
    permission: 'APPOINTMENTS_WRITE',
  });

  if (!canWriteAppointments) {
    return NextResponse.json({ message: 'No tenés permisos para crear turnos en esta sucursal' }, { status: 403 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const branchRes = await client.query<{ id: string; timeZone: string }>(
      `
        SELECT id, "timeZone"
        FROM "Branch"
        WHERE id = $1
          AND "tenantId" = $2
        LIMIT 1
      `,
      [branchId, tenantId],
    );
    const branch = branchRes.rows[0];
    if (!branch) {
      throw new Error('Sucursal no encontrada');
    }

    const employeeRes = await client.query<{ id: string; fullName: string }>(
      `
        SELECT id, "fullName"
        FROM "Employee"
        WHERE id = $1
          AND "tenantId" = $2
          AND "branchId" = $3
          AND "isActive" = TRUE
        FOR UPDATE
      `,
      [employeeId, tenantId, branchId],
    );
    const employee = employeeRes.rows[0];
    if (!employee) {
      throw new Error('Trabajador no disponible');
    }

    const serviceRes = await client.query<{ id: string; name: string; durationMins: number; priceCents: number }>(
      `
        SELECT id, name, "durationMins", "priceCents"
        FROM "Service"
        WHERE id = $1
          AND "tenantId" = $2
          AND "branchId" = $3
          AND "isActive" = TRUE
        LIMIT 1
      `,
      [serviceId, tenantId, branchId],
    );
    const service = serviceRes.rows[0];
    if (!service) {
      throw new Error('Servicio no disponible');
    }

    const assignmentRes = await client.query<{ serviceId: string }>(
      `
        SELECT "serviceId"
        FROM "ServiceAssignment"
        WHERE "employeeId" = $1
          AND "serviceId" = $2
        LIMIT 1
      `,
      [employeeId, serviceId],
    );
    if (!assignmentRes.rows[0]) {
      throw new Error(`El trabajador ${employee.fullName} no ofrece este servicio`);
    }

    const startsAt = localDateTimeToUtc(date, startMinutes, branch.timeZone || 'America/Argentina/Buenos_Aires');
    const durationMins = Math.max(1, Number(service.durationMins ?? 30));
    const endsAt = new Date(startsAt.getTime() + durationMins * 60 * 1000);

    const overlapRes = await client.query<{ id: string }>(
      `
        SELECT id
        FROM "Appointment"
        WHERE "employeeId" = $1
          AND status <> 'CANCELLED'
          AND "startsAt" < $2
          AND "endsAt" > $3
        LIMIT 1
      `,
      [employeeId, endsAt.toISOString(), startsAt.toISOString()],
    );
    if (overlapRes.rows[0]) {
      return NextResponse.json({ message: 'Ese horario ya está ocupado para este trabajador' }, { status: 409 });
    }

    let customerId: string | null = null;
    const existingCustomerRes = await client.query<{ id: string }>(
      `
        SELECT id
        FROM "Customer"
        WHERE "tenantId" = $1
          AND phone = $2
        ORDER BY "updatedAt" DESC
        LIMIT 1
      `,
      [tenantId, customerPhone],
    );

    if (existingCustomerRes.rows[0]) {
      customerId = existingCustomerRes.rows[0].id;
      await client.query(
        `
          UPDATE "Customer"
          SET "fullName" = $1,
              "archivedAt" = NULL,
              "updatedAt" = NOW()
          WHERE id = $2
        `,
        [customerFullName, customerId],
      );
    } else {
      const customerInsertRes = await client.query<{ id: string }>(
        `
          INSERT INTO "Customer" (
            id, "tenantId", "fullName", phone, email, notes, "createdAt", "updatedAt", "archivedAt"
          )
          VALUES (
            gen_random_uuid()::text, $1, $2, $3, NULL, NULL, NOW(), NOW(), NULL
          )
          RETURNING id
        `,
        [tenantId, customerFullName, customerPhone],
      );
      customerId = customerInsertRes.rows[0].id;
    }

    const nowUtc = new Date();
    const isPastOrNow = startsAt.getTime() <= nowUtc.getTime();
    const nextStatus = isPastOrNow ? 'COMPLETED' : 'PENDING';
    const createdBy = isPastOrNow ? 'STAFF' : 'CUSTOMER';

    const appointmentRes = await client.query<{ id: string }>(
      `
        INSERT INTO "Appointment" (
          id,
          "tenantId",
          "branchId",
          "employeeId",
          "customerId",
          "customerUserId",
          "createdBy",
          status,
          "startsAt",
          "endsAt",
          "totalChargedCents",
          notes,
          "createdAt",
          "updatedAt"
        )
        VALUES (
          gen_random_uuid()::text,
          $1,
          $2,
          $3,
          $4,
          NULL,
          $9,
          $10,
          $5,
          $6,
          $7,
          $8,
          NOW(),
          NOW()
        )
        RETURNING id
      `,
      [
        tenantId,
        branchId,
        employeeId,
        customerId,
        startsAt.toISOString(),
        endsAt.toISOString(),
        Number(service.priceCents ?? 0),
        notes,
        createdBy,
        nextStatus,
      ],
    );

    await client.query(
      `
        INSERT INTO "AppointmentLine" (
          id,
          "appointmentId",
          "serviceId",
          "serviceNameSnapshot",
          "durationMins",
          "priceCents",
          "createdAt"
        )
        VALUES (
          gen_random_uuid()::text,
          $1,
          $2,
          $3,
          $4,
          $5,
          NOW()
        )
      `,
      [appointmentRes.rows[0].id, service.id, service.name, durationMins, Number(service.priceCents ?? 0)],
    );

    await client.query('COMMIT');
    return NextResponse.json(
      {
        ok: true,
        appointmentId: appointmentRes.rows[0].id,
        status: nextStatus,
        paymentState: isPastOrNow ? 'PAID' : 'PENDING_CONFIRMATION',
      },
      { status: 201 },
    );
  } catch (error: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({ message: error?.message ?? 'No se pudo crear el turno' }, { status: 400 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const appointmentId = String(body?.appointmentId ?? '');

  if (!userId || !tenantId || !appointmentId) {
    return NextResponse.json({ message: 'userId, tenantId y appointmentId son obligatorios' }, { status: 400 });
  }

  const canWriteAppointments = await hasBranchPermission({
    userId,
    tenantId,
    branchId,
    permission: 'APPOINTMENTS_WRITE',
  });

  if (!canWriteAppointments) {
    return NextResponse.json({ message: 'No tenés permisos para borrar turnos de esta sucursal' }, { status: 403 });
  }

  try {
    await ensurePosTables();

    const appointmentRes = await db.query<{
      appointmentId: string;
      linkedSaleId: string | null;
    }>(
      `
        SELECT
          a.id AS "appointmentId",
          COALESCE(a."posSaleId", ps.id) AS "linkedSaleId"
        FROM "Appointment" a
        LEFT JOIN "PosSale" ps
          ON ps."appointmentId" = a.id
         AND ps."tenantId" = a."tenantId"
         AND ps."branchId" = a."branchId"
        WHERE a.id = $1
          AND a."tenantId" = $2
          AND a."branchId" = $3
        LIMIT 1
      `,
      [appointmentId, tenantId, branchId],
    );

    const appointment = appointmentRes.rows[0];
    if (!appointment) {
      return NextResponse.json({ message: 'Turno no encontrado' }, { status: 404 });
    }

    if (appointment.linkedSaleId) {
      const result = await deletePosSaleById({
        tenantId,
        branchId,
        saleId: appointment.linkedSaleId,
      });
      return NextResponse.json({ ok: true, deletedViaSale: true, ...result });
    }

    await db.query(
      `
        DELETE FROM "Appointment"
        WHERE id = $1
          AND "tenantId" = $2
          AND "branchId" = $3
      `,
      [appointmentId, tenantId, branchId],
    );

    return NextResponse.json({ ok: true, appointmentId, deletedViaSale: false });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo borrar el turno' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const appointmentId = String(body?.appointmentId ?? '');
  const action = String(body?.action ?? '');
  const serviceIds = parseServiceIds(body?.serviceIds);

  if (!userId || !tenantId || !appointmentId || !action) {
    return NextResponse.json({ message: 'userId, tenantId, appointmentId y action son obligatorios' }, { status: 400 });
  }

  const canWriteAppointments = await hasBranchPermission({
    userId,
    tenantId,
    branchId,
    permission: 'APPOINTMENTS_WRITE',
  });

  if (!canWriteAppointments) {
    return NextResponse.json({ message: 'No tenés permisos para editar turnos de esta sucursal' }, { status: 403 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const appointmentRes = await client.query<{
      id: string;
      status: string;
      employeeId: string;
      startsAt: string;
      endsAt: string;
    }>(
      `
        SELECT
          a.id,
          a.status,
          a."employeeId" AS "employeeId",
          a."startsAt" AS "startsAt",
          a."endsAt" AS "endsAt"
        FROM "Appointment" a
        WHERE a.id = $1
          AND a."tenantId" = $2
          AND a."branchId" = $3
        LIMIT 1
        FOR UPDATE
      `,
      [appointmentId, tenantId, branchId],
    );
    const appointment = appointmentRes.rows[0];
    if (!appointment) {
      return NextResponse.json({ message: 'Turno no encontrado' }, { status: 404 });
    }

    if (action === 'confirm') {
      if (appointment.status === 'PENDING') {
        await client.query(
          `
            UPDATE "Appointment"
            SET status = 'CONFIRMED',
                "updatedAt" = NOW()
            WHERE id = $1
          `,
          [appointmentId],
        );
      }
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, appointmentId, status: 'CONFIRMED' });
    }

    if (action === 'update_services') {
      if (!serviceIds || serviceIds.length === 0) {
        return NextResponse.json({ message: 'Seleccioná al menos un servicio' }, { status: 400 });
      }

      const serviceRowsRes = await client.query<{
        id: string;
        name: string;
        durationMins: number;
        priceCents: number;
      }>(
        `
          SELECT s.id, s.name, s."durationMins", s."priceCents"
          FROM "Service" s
          WHERE s."tenantId" = $1
            AND s."branchId" = $2
            AND s."isActive" = TRUE
            AND s.id = ANY($3::text[])
        `,
        [tenantId, branchId, serviceIds],
      );
      const serviceRows = serviceRowsRes.rows;
      if (serviceRows.length !== serviceIds.length) {
        return NextResponse.json({ message: 'Hay servicios inválidos o inactivos' }, { status: 400 });
      }

      const assignmentRes = await client.query<{ serviceId: string }>(
        `
          SELECT sa."serviceId" AS "serviceId"
          FROM "ServiceAssignment" sa
          WHERE sa."employeeId" = $1
            AND sa."serviceId" = ANY($2::text[])
        `,
        [appointment.employeeId, serviceIds],
      );
      const assignedIds = new Set(assignmentRes.rows.map((row) => row.serviceId));
      const firstUnassigned = serviceIds.find((id) => !assignedIds.has(id));
      if (firstUnassigned) {
        return NextResponse.json({ message: 'El trabajador no ofrece uno de los servicios seleccionados' }, { status: 400 });
      }

      const totalDuration = serviceRows.reduce((acc, row) => acc + Math.max(1, Number(row.durationMins ?? 0)), 0);
      const totalChargedCents = serviceRows.reduce((acc, row) => acc + Math.max(0, Number(row.priceCents ?? 0)), 0);
      const startsAtDate = new Date(appointment.startsAt);
      const nextEndsAt = new Date(startsAtDate.getTime() + totalDuration * 60 * 1000);

      const overlapRes = await client.query<{ id: string }>(
        `
          SELECT id
          FROM "Appointment"
          WHERE "employeeId" = $1
            AND id <> $2
            AND status <> 'CANCELLED'
            AND "startsAt" < $3
            AND "endsAt" > $4
          LIMIT 1
        `,
        [appointment.employeeId, appointmentId, nextEndsAt.toISOString(), startsAtDate.toISOString()],
      );
      if (overlapRes.rows[0]) {
        return NextResponse.json({ message: 'Con esos servicios se superpone con otro turno' }, { status: 409 });
      }

      await client.query(
        `
          UPDATE "Appointment"
          SET "endsAt" = $2,
              "totalChargedCents" = $3,
              "updatedAt" = NOW()
          WHERE id = $1
        `,
        [appointmentId, nextEndsAt.toISOString(), totalChargedCents],
      );

      await client.query(
        `
          DELETE FROM "AppointmentLine"
          WHERE "appointmentId" = $1
        `,
        [appointmentId],
      );

      for (const serviceId of serviceIds) {
        const service = serviceRows.find((row) => row.id === serviceId);
        if (!service) continue;
        await client.query(
          `
            INSERT INTO "AppointmentLine" (
              id,
              "appointmentId",
              "serviceId",
              "serviceNameSnapshot",
              "durationMins",
              "priceCents",
              "createdAt"
            )
            VALUES (
              gen_random_uuid()::text,
              $1,
              $2,
              $3,
              $4,
              $5,
              NOW()
            )
          `,
          [appointmentId, service.id, service.name, Number(service.durationMins ?? 0), Number(service.priceCents ?? 0)],
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({ ok: true, appointmentId, updated: true });
    }

    return NextResponse.json({ message: 'Acción inválida' }, { status: 400 });
  } catch (error: any) {
    await client.query('ROLLBACK');
    return NextResponse.json({ message: error?.message ?? 'No se pudo actualizar el turno' }, { status: 400 });
  } finally {
    client.release();
  }
}
