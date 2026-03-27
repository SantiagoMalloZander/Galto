import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { createInvitation } from '@/lib/server/cuentas-data';

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

function isLocalHost(hostOrUrl: string) {
  const value = hostOrUrl.trim().toLowerCase();
  if (!value) return true;
  return (
    value.includes('localhost') ||
    value.includes('127.0.0.1') ||
    value.includes('0.0.0.0') ||
    value.includes('::1')
  );
}

function toHost(value: string | null | undefined) {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).host;
  } catch {
    return trimmed;
  }
}

function resolvePublicOrigin(request: NextRequest) {
  const forwardedProto = (request.headers.get('x-forwarded-proto') ?? '').split(',')[0]?.trim();
  const candidates = [
    request.headers.get('x-forwarded-host'),
    request.headers.get('host'),
    request.nextUrl.host,
    toHost(process.env.NEXT_PUBLIC_APP_URL),
    toHost(process.env.APP_PUBLIC_URL),
    toHost(process.env.BOOKING_PUBLIC_BASE_URL),
  ]
    .map((item) => (item ?? '').split(',')[0]?.trim())
    .filter((item): item is string => Boolean(item));

  const publicHost = candidates.find((host) => !isLocalHost(host)) ?? candidates[0] ?? 'localhost:3000';
  const protocol = forwardedProto || (request.nextUrl.protocol || 'http:').replace(':', '');
  return `${protocol}://${publicHost}`;
}

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));

  const actorUserId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const invitedEmail = normalizeEmail(body?.invitedEmail);
  const role = String(body?.role ?? '');
  const workerType = String(body?.workerType ?? '');
  const branchAccesses = Array.isArray(body?.branchAccesses) ? body.branchAccesses : [];

  if (!actorUserId || !tenantId || !role || !workerType) {
    return NextResponse.json({ message: 'userId, tenantId, role y workerType son obligatorios' }, { status: 400 });
  }

  if (role !== 'MANAGER' && role !== 'EMPLOYEE') {
    return NextResponse.json({ message: 'role inválido' }, { status: 400 });
  }

  if (
    workerType !== 'TOTAL_POWER' &&
    workerType !== 'ADMIN_GENERAL' &&
    workerType !== 'ADMIN_BRANCH' &&
    workerType !== 'WORKER'
  ) {
    return NextResponse.json({ message: 'workerType inválido' }, { status: 400 });
  }

  try {
    const origin = resolvePublicOrigin(request);
    const invitation = await createInvitation({
      actorUserId,
      tenantId,
      invitedEmail,
      role: role as 'MANAGER' | 'EMPLOYEE',
      workerType: workerType as 'TOTAL_POWER' | 'ADMIN_GENERAL' | 'ADMIN_BRANCH' | 'WORKER',
      branchAccesses,
      origin,
    });

    return NextResponse.json(invitation, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo crear la invitación' }, { status: 400 });
  }
}
