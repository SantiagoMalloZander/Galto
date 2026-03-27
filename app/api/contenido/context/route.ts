import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/lib/server/staff-guard';
import { getContentContext } from '@/lib/server/content-data';

export async function GET(request: NextRequest) {
  const unauthorized = requireStaffAuth(request);
  if (unauthorized) return unauthorized;

  const userId = request.nextUrl.searchParams.get('userId') ?? '';
  const tenantId = request.nextUrl.searchParams.get('tenantId') ?? '';
  if (!userId || !tenantId) {
    return NextResponse.json({ message: 'userId y tenantId son obligatorios' }, { status: 400 });
  }

  try {
    const context = await getContentContext({ userId, tenantId });
    return NextResponse.json(context);
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo cargar contenido' }, { status: 400 });
  }
}
