import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { getEmployeeRewardsContext } from '@/lib/server/employee-rewards-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';
  const month = request.nextUrl.searchParams.get('month') ?? undefined;
  const branchIdsRaw = request.nextUrl.searchParams.get('branchIds') ?? '';
  const branchIds = branchIdsRaw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    const context = await getEmployeeRewardsContext({
      userId,
      tenantId,
      month,
      branchIds,
    });

    return NextResponse.json(context);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo cargar recompensas' }, { status: 400 });
  }
}
