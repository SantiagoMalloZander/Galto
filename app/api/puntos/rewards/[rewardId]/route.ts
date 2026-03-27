import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { deleteReward, updateReward } from '@/lib/server/points-data';

interface Params {
  params: Promise<{ rewardId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { rewardId } = await params;
  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    await updateReward({
      userId,
      tenantId,
      rewardId,
      pointsRequired: Number(body?.pointsRequired ?? 0),
      title: String(body?.title ?? ''),
      imageUrl: body?.imageUrl ? String(body.imageUrl) : null,
      note: body?.note ? String(body.note) : null,
      isActive: body?.isActive !== false,
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo actualizar recompensa' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const { rewardId } = await params;
  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    await deleteReward({ userId, tenantId, rewardId });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo eliminar recompensa' }, { status: 400 });
  }
}
