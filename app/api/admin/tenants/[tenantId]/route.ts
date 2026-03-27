import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-guard';
import { deleteTenantById } from '@/lib/server/admin-data';

interface Params {
  params: Promise<{ tenantId: string }>;
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const { tenantId } = await params;
  if (!tenantId) {
    return NextResponse.json({ message: 'tenantId es obligatorio' }, { status: 400 });
  }

  try {
    const deleted = await deleteTenantById(tenantId);
    if (!deleted) {
      return NextResponse.json({ message: 'Tenant no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, tenant: deleted, action: 'deleted' });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'No se pudo borrar el tenant' }, { status: 400 });
  }
}
