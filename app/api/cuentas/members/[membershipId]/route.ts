import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { getTenantAccountAccessSnapshot } from '@/lib/server/admin-data';
import { deleteMembershipFromTenant, updateMembershipConfig } from '@/lib/server/cuentas-data';

interface Params {
  params: Promise<{ membershipId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { membershipId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const actorUserId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const role = String(body?.role ?? '');
  const branchAccesses = Array.isArray(body?.branchAccesses) ? body.branchAccesses : [];
  const employeeSchedules = Array.isArray(body?.employeeSchedules) ? body.employeeSchedules : [];
  const employeeServices = Array.isArray(body?.employeeServices) ? body.employeeServices : [];
  const hasCommissionPayload = Boolean(body?.commissions);
  const categoryCommissions = Array.isArray(body?.commissions?.categoryCommissions)
    ? body.commissions.categoryCommissions
    : [];

  if (!actorUserId || !tenantId || !role) {
    return NextResponse.json({ message: 'userId, tenantId y role son obligatorios' }, { status: 400 });
  }

  if (role !== 'MANAGER' && role !== 'EMPLOYEE') {
    return NextResponse.json({ message: 'role inválido' }, { status: 400 });
  }

  if (hasCommissionPayload) {
    const accountAccess = await getTenantAccountAccessSnapshot(tenantId);
    if (!accountAccess.isPaid) {
      return NextResponse.json({ message: 'Comisiones está disponible solo en plan de pago.' }, { status: 402 });
    }
  }

  try {
    await updateMembershipConfig({
      actorUserId,
      tenantId,
      membershipId,
      role: role as 'MANAGER' | 'EMPLOYEE',
      branchAccesses,
      profile: {
        instagram: body?.profile?.instagram,
        bio: body?.profile?.bio,
        personalPhone: body?.profile?.personalPhone,
      },
      employeeSchedules,
      employeeServices,
      commissions: hasCommissionPayload
        ? {
            inventoryPercent: body?.commissions?.inventoryPercent,
            fixedCents: body?.commissions?.fixedCents,
            categoryCommissions,
          }
        : undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo actualizar el miembro' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { membershipId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const actorUserId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');

  if (!actorUserId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    const result = await deleteMembershipFromTenant({
      actorUserId,
      tenantId,
      membershipId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo borrar el usuario' }, { status: 400 });
  }
}
