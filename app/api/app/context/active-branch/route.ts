import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { setUserActiveBranch } from '@/lib/server/branch-context';

export async function PATCH(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');
  const branchId = String(body?.branchId ?? '');

  if (!userId || !tenantId || !branchId) {
    return NextResponse.json({ message: 'userId, tenantId y branchId son obligatorios' }, { status: 400 });
  }

  try {
    await setUserActiveBranch({ userId, tenantId, branchId });
    return NextResponse.json({ ok: true, branchId });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo guardar sucursal activa' }, { status: 400 });
  }
}
