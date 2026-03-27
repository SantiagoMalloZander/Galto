import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { listUserOwnedTenants, startDemoForTenant } from '@/lib/server/admin-data';

export async function POST(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => ({} as any));
  const userId = String(body?.userId ?? '');
  const tenantId = String(body?.tenantId ?? '');

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const memberships = await listUserOwnedTenants(userId);
  if (!memberships.some((membership) => membership.tenantId === tenantId)) {
    return NextResponse.json({ message: 'Sin acceso a este tenant' }, { status: 403 });
  }

  try {
    const plan = await startDemoForTenant(tenantId);
    return NextResponse.json({ plan });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo activar el plan gratis' }, { status: 400 });
  }
}
