import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { createExternalEmployee } from '@/lib/server/cuentas-data';

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const branchId = String(body?.branchId ?? '');
  const fullName = String(body?.fullName ?? '');
  const serviceIds = Array.isArray(body?.serviceIds)
    ? body.serviceIds.filter((value: unknown): value is string => typeof value === 'string')
    : [];

  if (!userId || !tenantId || !branchId || fullName.trim().length < 2) {
    return NextResponse.json({ message: 'userId, tenantId, branchId y fullName son obligatorios' }, { status: 400 });
  }

  try {
    const result = await createExternalEmployee({
      actorUserId: userId,
      tenantId,
      branchId,
      fullName,
      serviceIds,
      isActive: body?.isActive !== false,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo crear el trabajador' }, { status: 400 });
  }
}
