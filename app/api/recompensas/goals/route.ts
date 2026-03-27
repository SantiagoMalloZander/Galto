import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { createEmployeeRewardGoal } from '@/lib/server/employee-rewards-data';

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    const goal = await createEmployeeRewardGoal({
      userId,
      tenantId,
      name: String(body?.name ?? ''),
      metricType: String(body?.metricType ?? 'SERVICES') as any,
      targetValue: Number(body?.targetValue ?? 0),
      rewardTitle: String(body?.rewardTitle ?? ''),
      rewardNote: body?.rewardNote ? String(body.rewardNote) : null,
    });

    return NextResponse.json({ goal }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo crear objetivo' }, { status: 400 });
  }
}
