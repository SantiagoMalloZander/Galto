import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { getCuentasContext } from '@/lib/server/cuentas-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';

  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  const context = await getCuentasContext({ userId, tenantId });
  if (!context) {
    return NextResponse.json({ message: 'Sin acceso al tenant' }, { status: 403 });
  }

  return NextResponse.json(context);
}
