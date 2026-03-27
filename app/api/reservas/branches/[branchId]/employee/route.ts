import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { assertTenantAccess, createBranchEmployee, getBranchFullConfig } from '@/lib/server/reservas-data';

interface Params {
  params: Promise<{ branchId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { branchId } = await params;
  const body = await request.json().catch(() => ({} as any));

  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const fullName = String(body?.fullName ?? '');
  const serviceIds = Array.isArray(body?.serviceIds)
    ? body.serviceIds.filter((value: unknown): value is string => typeof value === 'string')
    : [];
  const schedules = Array.isArray(body?.schedules) ? body.schedules : [];

  if (!userId || !tenantId || fullName.trim().length < 2) {
    return NextResponse.json({ message: 'userId, tenantId y fullName son obligatorios' }, { status: 400 });
  }

  if (serviceIds.length === 0) {
    return NextResponse.json({ message: 'Debés asignar al menos un servicio' }, { status: 400 });
  }

  const access = await assertTenantAccess(userId, tenantId);
  if (!access) {
    return NextResponse.json({ message: 'Sin acceso al tenant' }, { status: 403 });
  }

  await createBranchEmployee({
    tenantId,
    branchId,
    fullName,
    isActive: body?.isActive !== false,
    serviceIds,
    schedules: schedules.map((row: any) => ({
      dayOfWeek: Number(row.dayOfWeek),
      startTimeMin: Number(row.startTimeMin),
      endTimeMin: Number(row.endTimeMin),
    })),
  });

  const config = await getBranchFullConfig(tenantId, branchId);
  return NextResponse.json({ config });
}
