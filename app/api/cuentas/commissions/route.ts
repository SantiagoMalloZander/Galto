import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { getTenantAccountAccessSnapshot } from '@/lib/server/admin-data';
import { updateTenantCommissionConfig } from '@/lib/server/cuentas-data';

export async function PATCH(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({} as any));

  const actorUserId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');

  if (!actorUserId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const accountAccess = await getTenantAccountAccessSnapshot(tenantId);
  if (!accountAccess.isPaid) {
    return NextResponse.json({ message: 'Comisiones está disponible solo en plan de pago.' }, { status: 402 });
  }

  try {
    await updateTenantCommissionConfig({
      actorUserId,
      tenantId,
      config: {
        inventoryPercent: body?.inventoryPercent,
        fixedCents: body?.fixedCents,
        categoryCommissions: Array.isArray(body?.categoryCommissions) ? body.categoryCommissions : [],
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo actualizar comisiones' }, { status: 400 });
  }
}
