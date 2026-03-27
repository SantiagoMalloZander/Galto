import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { updateExternalEmployee } from '@/lib/server/cuentas-data';

interface Params {
  params: Promise<{ employeeId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { employeeId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const fullName = String(body?.fullName ?? '');
  const schedules = Array.isArray(body?.schedules) ? body.schedules : [];
  const serviceIds = Array.isArray(body?.serviceIds)
    ? body.serviceIds.filter((value: unknown): value is string => typeof value === 'string')
    : [];

  if (!userId || !tenantId || !employeeId || fullName.trim().length < 2) {
    return NextResponse.json({ message: 'userId, tenantId, employeeId y fullName son obligatorios' }, { status: 400 });
  }

  try {
    const result = await updateExternalEmployee({
      actorUserId: userId,
      tenantId,
      employeeId,
      fullName,
      isActive: body?.isActive !== false,
      profile: {
        instagram: body?.profile?.instagram,
        bio: body?.profile?.bio,
        personalPhone: body?.profile?.personalPhone,
      },
      schedules,
      serviceIds,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo actualizar la trabajadora' }, { status: 400 });
  }
}

