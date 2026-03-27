import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { getDashboardOverview } from '@/lib/server/dashboard-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';
  const modeRaw = request.nextUrl.searchParams.get('mode') ?? 'MONTHLY';
  const mode = modeRaw === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
  const month = request.nextUrl.searchParams.get('month') ?? undefined;
  const year = request.nextUrl.searchParams.get('year');
  const employeeId = request.nextUrl.searchParams.get('employeeId') ?? undefined;
  const branchIdsRaw = request.nextUrl.searchParams.get('branchIds') ?? '';
  const branchIds = branchIdsRaw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    const overview = await getDashboardOverview({
      userId,
      tenantId,
      mode,
      month,
      year: year ? Number(year) : undefined,
      branchIds,
      employeeId,
    });

    return NextResponse.json(overview);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo cargar dashboard' }, { status: 400 });
  }
}
