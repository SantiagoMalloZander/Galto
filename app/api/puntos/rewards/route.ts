import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { createReward } from '@/lib/server/points-data';

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
    const id = await createReward({
      userId,
      tenantId,
      pointsRequired: Number(body?.pointsRequired ?? 0),
      title: String(body?.title ?? ''),
      imageUrl: body?.imageUrl ? String(body.imageUrl) : null,
      note: body?.note ? String(body.note) : null,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo crear recompensa' }, { status: 400 });
  }
}
