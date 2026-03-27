import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { deleteEmployeeRewardGoal, updateEmployeeRewardGoal } from '@/lib/server/employee-rewards-data';

interface Params {
  params: Promise<{ goalId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { goalId } = await params;
  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    await updateEmployeeRewardGoal({
      userId,
      tenantId,
      goalId,
      name: String(body?.name ?? ''),
      metricType: String(body?.metricType ?? 'SERVICES') as any,
      targetValue: Number(body?.targetValue ?? 0),
      rewardTitle: String(body?.rewardTitle ?? ''),
      rewardNote: body?.rewardNote ? String(body.rewardNote) : null,
      isActive: Boolean(body?.isActive),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo actualizar objetivo' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { goalId } = await params;
  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    await deleteEmployeeRewardGoal({ userId, tenantId, goalId });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo borrar objetivo' }, { status: 400 });
  }
}
