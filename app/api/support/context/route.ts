import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { getSupportContext } from '@/lib/server/support-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';
  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    const context = await getSupportContext({ userId, tenantId });
    return NextResponse.json(context);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo cargar soporte' }, { status: 400 });
  }
}
