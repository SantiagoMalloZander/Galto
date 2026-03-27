import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { getPointsContext, updatePointsConfig } from '@/lib/server/points-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    const context = await getPointsContext({ userId, tenantId });
    return NextResponse.json(context);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo cargar puntos' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const mode = body?.mode === 'SPEND' ? 'SPEND' : 'VISIT';
  const pointsPerVisit = Number(body?.pointsPerVisit ?? 1);
  const spendAmountCentsPerPoint = Number(body?.spendAmountCentsPerPoint ?? 1000);

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    await updatePointsConfig({
      userId,
      tenantId,
      mode,
      pointsPerVisit,
      spendAmountCentsPerPoint,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo guardar configuración' }, { status: 400 });
  }
}
